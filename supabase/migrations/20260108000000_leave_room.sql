-- ============================================================================
-- subasta — leave_room RPC
-- ============================================================================
-- Allows a non-host member to leave a room while it's still in the lobby.
-- Host departure is intentionally not supported — the host either deletes
-- the room entirely (future feature) or just abandons it. Rooms in
-- drafting/voting/finished cannot be left because that would corrupt the
-- in-flight game state.
-- ============================================================================

create or replace function public.leave_room(p_room_id uuid)
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

	if v_room.host_id = v_user_id then
		raise exception 'host cannot leave (close the room instead)';
	end if;
	if v_room.status <> 'lobby' then
		raise exception 'cannot leave after the auction has started';
	end if;

	delete from public.room_members
	where room_id = p_room_id and user_id = v_user_id;
end;
$$;

grant execute on function public.leave_room(uuid) to authenticated;
