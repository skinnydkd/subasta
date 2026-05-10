-- ============================================================================
-- subasta — auto-assign scrubs + bid rate-limit
-- ============================================================================
-- Closes two gaps after end-to-end smoke test:
--   1. When the auction queue ends, members can have empty slots. Now we
--      auto-fill those with scrub players (is_scrub=true) before voting.
--   2. place_bid had no rate limit — a fast client could spam.
-- ============================================================================

-- =============================================================================
-- auto_assign_scrubs: for each member, fills positions where they're below
-- the formation count by inserting auctions with status='auto_assigned',
-- final_price_cents=0, winner=member. Picks scrubs matching the theme's
-- scrub_filter_config (or just is_scrub=true if no filter is configured).
-- =============================================================================
create or replace function public.auto_assign_scrubs(p_room_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
	v_room rooms%rowtype;
	v_settings jsonb;
	v_formation jsonb;
	v_scrub_filter jsonb;
	v_member_id uuid;
	v_pos text;
	v_needed int;
	v_owned int;
	v_to_assign int;
	v_player_id uuid;
	v_seq int;
	v_inserted int := 0;
begin
	select * into v_room from public.rooms where id = p_room_id for update;
	if not found then raise exception 'room not found'; end if;

	v_settings := v_room.settings;
	v_formation := v_settings -> 'formation';

	select scrub_filter_config into v_scrub_filter from public.themes where id = v_room.theme_id;
	if v_scrub_filter is null then v_scrub_filter := '{}'::jsonb; end if;

	-- Start sequence_number after the regular queue.
	select coalesce(max(sequence_number), 0) into v_seq
	from public.auctions where room_id = p_room_id;

	for v_member_id in
		select user_id from public.room_members where room_id = p_room_id order by joined_at
	loop
		for v_pos, v_needed in
			select key, value::int from jsonb_each_text(v_formation)
		loop
			select count(*) into v_owned
			from public.auctions
			where room_id = p_room_id
				and winner_id = v_member_id
				and position_slot = v_pos::position_code;

			v_to_assign := v_needed - v_owned;
			if v_to_assign <= 0 then continue; end if;

			while v_to_assign > 0 loop
				select p.id into v_player_id
				from public.players p
				where p.is_scrub = true
					and p.primary_position = v_pos::position_code
					and (
						coalesce(jsonb_array_length(v_scrub_filter -> 'include_tags'), 0) = 0
						or exists (
							select 1 from public.player_tags pt
							join public.tags t on t.id = pt.tag_id
							where pt.player_id = p.id
								and t.slug in (
									select jsonb_array_elements_text(v_scrub_filter -> 'include_tags')
								)
						)
					)
					and not exists (
						select 1 from public.auctions a
						where a.room_id = p_room_id and a.player_id = p.id
					)
				order by random()
				limit 1;

				if v_player_id is null then
					raise exception 'not enough scrubs for position %: each member needs %', v_pos, v_needed;
				end if;

				v_seq := v_seq + 1;
				insert into public.auctions (
					room_id, player_id, position_slot, sequence_number,
					status, winner_id, final_price_cents,
					started_at, closed_at
				) values (
					p_room_id, v_player_id, v_pos::position_code, v_seq,
					'auto_assigned', v_member_id, 0,
					now(), now()
				);

				v_inserted := v_inserted + 1;
				v_to_assign := v_to_assign - 1;
			end loop;
		end loop;
	end loop;

	return v_inserted;
end;
$$;

grant execute on function public.auto_assign_scrubs(uuid) to authenticated;

-- =============================================================================
-- advance_auction: re-deployed to call auto_assign_scrubs before transitioning
-- to 'voting'. Rest of behaviour unchanged from 20260102000001.
-- =============================================================================
create or replace function public.advance_auction(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user_id uuid := auth.uid();
	v_room rooms%rowtype;
	v_active auctions%rowtype;
	v_settings jsonb;
	v_timer int;
	v_next_id uuid;
	v_winner_id uuid;
	v_final_price bigint;
begin
	if v_user_id is null then raise exception 'not authenticated'; end if;

	select * into v_room from public.rooms where id = p_room_id for update;
	if not found then raise exception 'room not found'; end if;
	if v_room.host_id <> v_user_id then raise exception 'only host can advance'; end if;
	if v_room.status <> 'drafting' then raise exception 'room not drafting'; end if;

	v_settings := v_room.settings;
	v_timer := coalesce((v_settings ->> 'timer_seconds')::int, 60);

	select * into v_active
	from public.auctions
	where room_id = p_room_id and status = 'active'
	for update;

	if found then
		if v_active.current_bidder_id is not null then
			v_winner_id := v_active.current_bidder_id;
			v_final_price := v_active.current_bid_cents;

			update public.room_members
			set budget_remaining_cents = budget_remaining_cents - v_final_price
			where room_id = p_room_id and user_id = v_winner_id;

			update public.auctions
			set status = 'closed',
				winner_id = v_winner_id,
				final_price_cents = v_final_price,
				closed_at = now()
			where id = v_active.id;
		else
			update public.auctions
			set status = 'skipped',
				closed_at = now()
			where id = v_active.id;
		end if;
	end if;

	select id into v_next_id
	from public.auctions
	where room_id = p_room_id and status = 'pending'
	order by sequence_number
	limit 1;

	if v_next_id is not null then
		update public.auctions
		set status = 'active',
			started_at = now(),
			ends_at = now() + (v_timer || ' seconds')::interval
		where id = v_next_id;
		return jsonb_build_object('next_auction_id', v_next_id, 'phase', 'drafting');
	else
		-- Auction queue done → fill empty slots with scrubs, then transition.
		perform public.auto_assign_scrubs(p_room_id);
		update public.rooms set status = 'voting' where id = p_room_id;
		return jsonb_build_object('next_auction_id', null, 'phase', 'voting');
	end if;
end;
$$;

-- =============================================================================
-- place_bid: re-deployed with a 200ms-per-user rate limit. Rest unchanged.
-- =============================================================================
create or replace function public.place_bid(p_auction_id uuid, p_amount_cents bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user_id uuid := auth.uid();
	v_auction auctions%rowtype;
	v_room rooms%rowtype;
	v_settings jsonb;
	v_min_open bigint;
	v_min_inc bigint;
	v_timer int;
	v_budget bigint;
	v_min_next bigint;
begin
	if v_user_id is null then raise exception 'not authenticated'; end if;
	if p_amount_cents is null or p_amount_cents <= 0 then
		raise exception 'amount must be positive';
	end if;

	-- Rate-limit: max one bid per 200ms per user, room-wide.
	if exists (
		select 1 from public.bids b
		join public.auctions a on a.id = b.auction_id
		where b.user_id = v_user_id
			and a.id = p_auction_id
			and b.created_at > now() - interval '200 milliseconds'
	) then
		raise exception 'rate limit: too fast';
	end if;

	select * into v_auction from public.auctions where id = p_auction_id for update;
	if not found then raise exception 'auction not found'; end if;

	if v_auction.status <> 'active' then raise exception 'auction not active'; end if;
	if v_auction.ends_at is not null and v_auction.ends_at <= now() then
		raise exception 'auction expired';
	end if;
	if v_auction.current_bidder_id = v_user_id then
		raise exception 'cannot outbid yourself';
	end if;

	select budget_remaining_cents into v_budget
	from public.room_members
	where room_id = v_auction.room_id and user_id = v_user_id;
	if not found then raise exception 'not a room member'; end if;

	select * into v_room from public.rooms where id = v_auction.room_id;
	if v_room.status <> 'drafting' then raise exception 'room not drafting'; end if;

	v_settings := v_room.settings;
	v_min_open := coalesce((v_settings ->> 'min_opening_bid_cents')::bigint, 100000000);
	v_min_inc := coalesce((v_settings ->> 'min_bid_increment_cents')::bigint, 100000000);
	v_timer := coalesce((v_settings ->> 'timer_seconds')::int, 60);

	if v_auction.current_bid_cents is null then
		v_min_next := v_min_open;
	else
		v_min_next := v_auction.current_bid_cents + v_min_inc;
	end if;

	if p_amount_cents < v_min_next then
		raise exception 'bid % below minimum %', p_amount_cents, v_min_next;
	end if;

	if p_amount_cents > v_budget then
		raise exception 'bid exceeds budget (% > %)', p_amount_cents, v_budget;
	end if;

	update public.auctions
	set current_bid_cents = p_amount_cents,
		current_bidder_id = v_user_id,
		ends_at = now() + (v_timer || ' seconds')::interval
	where id = p_auction_id;

	insert into public.bids (auction_id, user_id, amount_cents)
	values (p_auction_id, v_user_id, p_amount_cents);
end;
$$;
