-- ============================================================================
-- subasta — public read of finished rooms
-- ============================================================================
-- Anonymous users (and members who lost their cookies) need a way to see the
-- final results of a room they participated in. This RPC returns the same
-- shape as the regular load function expects, but bypasses RLS — allowed
-- because finished rooms are intentionally shareable.
--
-- Returns null if the code matches no room or the room is not finished.
-- ============================================================================

create or replace function public.get_finished_room(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
	v_room rooms%rowtype;
	v_theme_name text;
	v_members jsonb;
	v_teams jsonb;
	v_tally jsonb;
begin
	select * into v_room from public.rooms where code = upper(p_code);
	if not found then return null; end if;
	if v_room.status <> 'finished' then return null; end if;

	select display_name into v_theme_name from public.themes where id = v_room.theme_id;

	-- Members + display name + final budget
	select coalesce(jsonb_agg(jsonb_build_object(
		'user_id', rm.user_id,
		'display_name', p.display_name,
		'budget_remaining_cents', rm.budget_remaining_cents
	) order by rm.joined_at), '[]'::jsonb)
	into v_members
	from public.room_members rm
	join public.profiles p on p.id = rm.user_id
	where rm.room_id = v_room.id;

	-- Teams: { winner_id: [ { position_slot, player_name, final_price_cents, status } ] }
	select coalesce(jsonb_object_agg(winner_id, players), '{}'::jsonb)
	into v_teams
	from (
		select
			a.winner_id::text as winner_id,
			jsonb_agg(jsonb_build_object(
				'position_slot', a.position_slot,
				'player_name', pl.name,
				'final_price_cents', a.final_price_cents,
				'auction_status', a.status
			) order by a.position_slot, a.sequence_number) as players
		from public.auctions a
		join public.players pl on pl.id = a.player_id
		where a.room_id = v_room.id and a.winner_id is not null
		group by a.winner_id
	) t;

	-- Tally
	select coalesce(jsonb_agg(jsonb_build_object(
		'user_id', user_id,
		'total_points', total_points,
		'votes_received', votes_received
	)), '[]'::jsonb)
	into v_tally
	from public.vote_tally
	where room_id = v_room.id;

	return jsonb_build_object(
		'room', jsonb_build_object(
			'id', v_room.id,
			'code', v_room.code,
			'status', v_room.status,
			'host_id', v_room.host_id,
			'started_at', v_room.started_at,
			'finished_at', v_room.finished_at,
			'settings', v_room.settings,
			'theme', jsonb_build_object('display_name', v_theme_name)
		),
		'members', v_members,
		'teams', v_teams,
		'tally', v_tally
	);
end;
$$;

grant execute on function public.get_finished_room(text) to anon, authenticated;
