-- Improve auto_assign_scrubs: when a position needs to be filled, first try
-- to reclaim a SKIPPED auction from the same room (real theme player nobody
-- bid on). Only fall back to generic scrubs if no skipped auctions are
-- available for that position.
--
-- Effect: losers get real theme players (the unwanted ones) instead of
-- "Scrub CB01". Matches user request: "deurien ser jugador del tema que
-- es jugui pero roïns o no tant coneguts".

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
	v_skipped_id uuid;
	v_seq int;
	v_inserted int := 0;
begin
	select * into v_room from public.rooms where id = p_room_id for update;
	if not found then raise exception 'room not found'; end if;

	v_settings := v_room.settings;
	v_formation := v_settings -> 'formation';

	select scrub_filter_config into v_scrub_filter from public.themes where id = v_room.theme_id;
	if v_scrub_filter is null then v_scrub_filter := '{}'::jsonb; end if;

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
				v_player_id := null;
				v_skipped_id := null;

				-- 1) Try to reclaim an existing SKIPPED auction at this position.
				--    Picks the cheapest (least-known) one first.
				select a.id, a.player_id
				into v_skipped_id, v_player_id
				from public.auctions a
				join public.players pl on pl.id = a.player_id
				where a.room_id = p_room_id
					and a.status = 'skipped'
					and a.position_slot = v_pos::position_code
				order by pl.market_value_cents asc nulls first, random()
				limit 1
				for update of a;

				if v_skipped_id is not null then
					update public.auctions
					set status = 'auto_assigned',
						winner_id = v_member_id,
						final_price_cents = 0,
						closed_at = now()
					where id = v_skipped_id;

					v_inserted := v_inserted + 1;
					v_to_assign := v_to_assign - 1;
					continue;
				end if;

				-- 2) Fall back to a generic scrub from theme.scrub_filter_config
				--    (or any scrub if the theme has no filter set).
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
