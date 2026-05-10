-- ============================================================================
-- subasta — room creation/join RPCs
-- ============================================================================
-- Per the project convention (CLAUDE.md): every state mutation goes through
-- a SECURITY DEFINER RPC, never a direct INSERT/UPDATE from the client. This
-- migration converts createRoom/joinRoom (previously TypeScript wrappers
-- doing direct .from('rooms').insert) into proper Postgres functions.
-- ============================================================================

-- =============================================================================
-- create_room: caller becomes host, gets a fresh 6-char code, joins as member.
-- =============================================================================
create or replace function public.create_room(p_theme_id uuid)
returns table (room_id uuid, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user_id uuid := auth.uid();
	v_code text;
	v_room_id uuid;
	v_attempts int := 0;
	v_starting_budget bigint;
	v_settings jsonb;
	v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
	if v_user_id is null then raise exception 'not authenticated'; end if;

	if not exists (
		select 1 from public.themes where id = p_theme_id and is_published = true
	) then
		raise exception 'theme not found or not published';
	end if;

	-- Mirrors src/lib/auction/settings.ts DEFAULT_ROOM_SETTINGS.
	v_settings := jsonb_build_object(
		'formation', jsonb_build_object('GK',1,'LB',1,'RB',1,'CB',2,'CM',3,'LW',1,'RW',1,'ST',1),
		'extra_per_position', 1,
		'starting_budget_cents', 100000000000,
		'auction_type', 'open_timer',
		'timer_seconds', 60,
		'min_bid_increment_cents', 100000000,
		'min_opening_bid_cents', 100000000,
		'max_members', 5
	);
	v_starting_budget := (v_settings ->> 'starting_budget_cents')::bigint;

	loop
		v_attempts := v_attempts + 1;
		if v_attempts > 5 then raise exception 'could not generate unique room code'; end if;

		v_code := '';
		for i in 1..6 loop
			v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
		end loop;

		begin
			insert into public.rooms (code, host_id, theme_id, settings)
			values (v_code, v_user_id, p_theme_id, v_settings)
			returning id into v_room_id;
			exit;
		exception when unique_violation then
			continue;
		end;
	end loop;

	insert into public.room_members (room_id, user_id, budget_remaining_cents)
	values (v_room_id, v_user_id, v_starting_budget);

	return query select v_room_id, v_code;
end;
$$;

-- =============================================================================
-- join_room: caller joins by code if room is in lobby and not full. Idempotent.
-- =============================================================================
create or replace function public.join_room(p_code text)
returns table (room_id uuid, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user_id uuid := auth.uid();
	v_room rooms%rowtype;
	v_max_members int;
	v_count int;
	v_starting_budget bigint;
	v_already_member boolean;
begin
	if v_user_id is null then raise exception 'not authenticated'; end if;

	select * into v_room from public.rooms where rooms.code = p_code;
	if not found then raise exception 'room not found'; end if;
	if v_room.status <> 'lobby' then raise exception 'room not in lobby'; end if;

	v_max_members := coalesce((v_room.settings ->> 'max_members')::int, 5);
	v_starting_budget := coalesce(
		(v_room.settings ->> 'starting_budget_cents')::bigint, 100000000000
	);

	select exists (
		select 1 from public.room_members
		where public.room_members.room_id = v_room.id and user_id = v_user_id
	) into v_already_member;

	if not v_already_member then
		select count(*) into v_count from public.room_members where public.room_members.room_id = v_room.id;
		if v_count >= v_max_members then raise exception 'room is full'; end if;

		insert into public.room_members (room_id, user_id, budget_remaining_cents)
		values (v_room.id, v_user_id, v_starting_budget);
	end if;

	return query select v_room.id, v_room.code;
end;
$$;

grant execute on function public.create_room(uuid) to authenticated;
grant execute on function public.join_room(text) to authenticated;
