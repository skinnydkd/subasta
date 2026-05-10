-- ============================================================================
-- subasta — kick_member + transfer_host RPCs
-- ============================================================================
-- Two host-only operations:
--   * kick_member: lobby only. Removes a non-host member from room_members.
--   * transfer_host: any non-finished phase. Hands the host role to another
--     existing member of the same room. The previous host stays as a member.
-- ============================================================================

create or replace function public.kick_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_caller uuid := auth.uid();
	v_room rooms%rowtype;
begin
	if v_caller is null then raise exception 'not authenticated'; end if;
	if p_user_id is null then raise exception 'user_id required'; end if;

	select * into v_room from public.rooms where id = p_room_id for update;
	if not found then raise exception 'room not found'; end if;
	if v_room.host_id <> v_caller then raise exception 'only host can kick'; end if;
	if v_room.status <> 'lobby' then
		raise exception 'cannot kick after the auction has started';
	end if;
	if p_user_id = v_caller then
		raise exception 'host cannot kick themselves (close the room instead)';
	end if;

	delete from public.room_members where room_id = p_room_id and user_id = p_user_id;
end;
$$;

create or replace function public.transfer_host(p_room_id uuid, p_new_host_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_caller uuid := auth.uid();
	v_room rooms%rowtype;
begin
	if v_caller is null then raise exception 'not authenticated'; end if;
	if p_new_host_user_id is null then raise exception 'new_host required'; end if;

	select * into v_room from public.rooms where id = p_room_id for update;
	if not found then raise exception 'room not found'; end if;
	if v_room.host_id <> v_caller then raise exception 'only the current host can transfer'; end if;
	if v_room.status = 'finished' then raise exception 'cannot transfer host on a finished room'; end if;
	if p_new_host_user_id = v_caller then
		raise exception 'cannot transfer host to yourself';
	end if;

	if not exists (
		select 1 from public.room_members
		where room_id = p_room_id and user_id = p_new_host_user_id
	) then
		raise exception 'new host must already be a room member';
	end if;

	update public.rooms set host_id = p_new_host_user_id where id = p_room_id;
end;
$$;

grant execute on function public.kick_member(uuid, uuid) to authenticated;
grant execute on function public.transfer_host(uuid, uuid) to authenticated;
