-- Improve the auction queue built by start_room:
--   1. DEDUPE players GLOBALLY by identity (lower(name), birth_year), keeping the
--      most valuable row. Multi-era themes (e.g. "Barça històric") previously
--      seeded one row per era, so Messi/Iniesta/Piqué showed up 2-3x in a single
--      room. Dedup is global (not per-position) because a player's seeded
--      primary_position can differ across eras (e.g. Mascherano CB vs CM), so a
--      per-position dedup still let them appear in two positions.
--   2. VALUE-WEIGHTED selection (Efraimidis-Spirakis): pick is biased toward
--      higher market value (weight = (€M)^2), so well-known players appear almost
--      always while some lesser-known/classic players still get in (~18% tail).
--   3. RESILIENT fill: dedupe shrinks small/multi-era pools below demand, so we
--      now insert min(demand, available) per position instead of raising
--      'not enough players'. Missing roster slots are filled later by
--      auto_assign_scrubs, exactly as for any other under-filled position.

create or replace function public.start_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user_id uuid := auth.uid();
	v_room rooms%rowtype;
	v_settings jsonb;
	v_formation jsonb;
	v_filter jsonb;
	v_member_count int;
	v_extras int;
	v_timer int;
	v_pos text;
	v_count_for_pos int;
	v_total_slots int;
begin
	if v_user_id is null then raise exception 'not authenticated'; end if;

	select * into v_room from public.rooms where id = p_room_id for update;
	if not found then raise exception 'room not found'; end if;
	if v_room.host_id <> v_user_id then raise exception 'only host can start'; end if;
	if v_room.status <> 'lobby' then raise exception 'room not in lobby'; end if;

	select count(*) into v_member_count from public.room_members where room_id = p_room_id;
	if v_member_count < 2 then raise exception 'need at least 2 members to start'; end if;

	v_settings := v_room.settings;
	v_formation := v_settings -> 'formation';
	v_extras := coalesce((v_settings ->> 'extra_per_position')::int, 1);
	v_timer := coalesce((v_settings ->> 'timer_seconds')::int, 60);

	select filter_config into v_filter from public.themes where id = v_room.theme_id;
	if v_filter is null then v_filter := '{}'::jsonb; end if;

	-- 1) Global deduped candidate pool: one row per real player (lower(name),
	--    birth_year), keeping the highest-valued row and ITS primary_position.
	create temp table tmp_pool on commit drop as
	select distinct on (lower(p.name), p.birth_year)
		p.id, p.primary_position, p.market_value_cents
	from public.players p
	where p.is_scrub = false
		and (
			coalesce(jsonb_array_length(v_filter -> 'include_tags'), 0) = 0
			or exists (
				select 1 from public.player_tags pt
				join public.tags t on t.id = pt.tag_id
				where pt.player_id = p.id
					and t.slug in (select jsonb_array_elements_text(v_filter -> 'include_tags'))
			)
		)
		and (
			coalesce(jsonb_array_length(v_filter -> 'exclude_tags'), 0) = 0
			or not exists (
				select 1 from public.player_tags pt
				join public.tags t on t.id = pt.tag_id
				where pt.player_id = p.id
					and t.slug in (select jsonb_array_elements_text(v_filter -> 'exclude_tags'))
			)
		)
	order by lower(p.name), p.birth_year, p.market_value_cents desc nulls last;

	create temp table tmp_queue (
		player_id uuid,
		position_slot position_code,
		rnd double precision
	) on commit drop;

	-- 2) Per position, value-weighted selection from the deduped pool. rnd stays
	--    uniform random (global sequence order = random across positions).
	for v_pos, v_count_for_pos in
		select key, value::int from jsonb_each_text(v_formation)
	loop
		v_total_slots := v_count_for_pos * (v_member_count + v_extras);
		if v_total_slots <= 0 then continue; end if;

		insert into tmp_queue (player_id, position_slot, rnd)
		select id, v_pos::position_code, random()
		from (
			select id, market_value_cents
			from tmp_pool
			where primary_position = v_pos::position_code
			-- Efraimidis-Spirakis weighted sampling without replacement: key =
			-- random()^(1/weight), take the largest keys. weight = (€M)^2.
			order by power(
				random(),
				1.0 / greatest(power(coalesce(market_value_cents, 0) / 100000000.0, 2), 1e-6)
			) desc
			limit v_total_slots          -- resilient: fewer rows if pool is small
		) chosen;
	end loop;

	if (select count(*) from tmp_queue) = 0 then
		raise exception 'theme has no eligible players';
	end if;

	-- Insert into auctions with random global sequence (decision: order=random).
	with ordered as (
		select player_id, position_slot, row_number() over (order by rnd) as seq
		from tmp_queue
	)
	insert into public.auctions (room_id, player_id, position_slot, sequence_number, status)
	select p_room_id, player_id, position_slot, seq, 'pending'
	from ordered;

	-- Activate the first one and flip room status.
	update public.auctions
	set status = 'active', started_at = now(), ends_at = now() + (v_timer || ' seconds')::interval
	where room_id = p_room_id and sequence_number = 1;

	update public.rooms set status = 'drafting', started_at = now() where id = p_room_id;
end;
$$;

grant execute on function public.start_room(uuid) to authenticated;
