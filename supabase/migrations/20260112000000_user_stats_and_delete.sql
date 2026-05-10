-- ============================================================================
-- subasta — get_user_stats + delete_room
-- ============================================================================
-- Two small RPCs:
--   1. get_user_stats(uid): aggregates a player's history across all rooms
--      they participated in — placings, total spent, players won, favourite
--      position.
--   2. delete_room(room_id): host-only, lobby-only. Removes the room and
--      cascades through room_members. Drafting / voting / finished rooms
--      are intentionally not deletable so history survives.
-- ============================================================================

create or replace function public.get_user_stats(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
	v_rooms_played int := 0;
	v_first int := 0;
	v_second int := 0;
	v_third int := 0;
	v_total_spent bigint := 0;
	v_players_won int := 0;
	v_top_position text;
	v_top_position_count int := 0;
begin
	if p_user_id is null then return null; end if;

	select count(*) into v_rooms_played
	from public.room_members
	where user_id = p_user_id;

	-- Final placings: rank by points (desc) then votes_received (desc) per room.
	with finished as (
		select rm.room_id
		from public.room_members rm
		join public.rooms r on r.id = rm.room_id
		where rm.user_id = p_user_id and r.status = 'finished'
	),
	rankings as (
		select
			vt.room_id,
			vt.user_id,
			rank() over (partition by vt.room_id order by vt.total_points desc, vt.votes_received desc) as rnk
		from public.vote_tally vt
		where vt.room_id in (select room_id from finished)
	)
	select
		coalesce(count(*) filter (where rnk = 1), 0),
		coalesce(count(*) filter (where rnk = 2), 0),
		coalesce(count(*) filter (where rnk = 3), 0)
	into v_first, v_second, v_third
	from rankings where user_id = p_user_id;

	select
		coalesce(sum(coalesce(final_price_cents, 0)), 0),
		coalesce(count(*) filter (where status = 'closed' or status = 'auto_assigned'), 0)
	into v_total_spent, v_players_won
	from public.auctions
	where winner_id = p_user_id;

	select position_slot::text, count(*)
	into v_top_position, v_top_position_count
	from public.auctions
	where winner_id = p_user_id and status = 'closed'
	group by position_slot
	order by count(*) desc
	limit 1;

	return jsonb_build_object(
		'rooms_played', v_rooms_played,
		'first_places', v_first,
		'second_places', v_second,
		'third_places', v_third,
		'total_spent_cents', v_total_spent,
		'players_won', v_players_won,
		'top_position', v_top_position,
		'top_position_count', v_top_position_count
	);
end;
$$;

grant execute on function public.get_user_stats(uuid) to authenticated;

-- =============================================================================
-- delete_room: host removes their lobby. Drafting/voting/finished rooms are
-- preserved (history matters). Cascades through room_members.
-- =============================================================================
create or replace function public.delete_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user_id uuid := auth.uid();
	v_room rooms%rowtype;
begin
	if v_user_id is null then raise exception 'not authenticated'; end if;

	select * into v_room from public.rooms where id = p_room_id for update;
	if not found then raise exception 'room not found'; end if;
	if v_room.host_id <> v_user_id then raise exception 'only host can close the room'; end if;
	if v_room.status <> 'lobby' then
		raise exception 'cannot delete a room after it has started';
	end if;

	delete from public.rooms where id = p_room_id;
end;
$$;

grant execute on function public.delete_room(uuid) to authenticated;
