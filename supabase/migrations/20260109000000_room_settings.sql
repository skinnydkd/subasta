-- ============================================================================
-- subasta — customizable room settings
-- ============================================================================
-- Two changes:
--   1. create_room now accepts an optional p_settings jsonb parameter so the
--      host can pick formation, timer, max_members, etc. when creating the
--      room. NULL falls back to the default settings (mirror of
--      DEFAULT_ROOM_SETTINGS in src/lib/auction/settings.ts).
--   2. update_room_settings RPC for the host to tweak settings while the
--      room is still in lobby (full replace) or drafting (timer_seconds
--      only — the active auction's ends_at is not retroactively changed,
--      so the new timer takes effect on the next auction).
-- ============================================================================

create or replace function public.create_room(
	p_theme_id uuid,
	p_settings jsonb default null
)
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
	v_default_settings jsonb := jsonb_build_object(
		'formation', jsonb_build_object('GK',1,'LB',1,'RB',1,'CB',2,'CM',3,'LW',1,'RW',1,'ST',1),
		'extra_per_position', 1,
		'starting_budget_cents', 100000000000,
		'auction_type', 'open_timer',
		'timer_seconds', 60,
		'min_bid_increment_cents', 100000000,
		'min_opening_bid_cents', 100000000,
		'max_members', 5
	);
begin
	if v_user_id is null then raise exception 'not authenticated'; end if;

	if not exists (
		select 1 from public.themes where id = p_theme_id and is_published = true
	) then
		raise exception 'theme not found or not published';
	end if;

	-- Merge caller-provided patch onto defaults (caller wins).
	v_settings := v_default_settings || coalesce(p_settings, '{}'::jsonb);

	-- Sanity-check the merged settings.
	if not (v_settings ? 'formation' and jsonb_typeof(v_settings -> 'formation') = 'object') then
		raise exception 'settings.formation must be an object';
	end if;
	if (v_settings ->> 'timer_seconds')::int not between 10 and 600 then
		raise exception 'settings.timer_seconds must be between 10 and 600';
	end if;
	if (v_settings ->> 'max_members')::int not between 2 and 8 then
		raise exception 'settings.max_members must be between 2 and 8';
	end if;
	if (v_settings ->> 'extra_per_position')::int not between 0 and 3 then
		raise exception 'settings.extra_per_position must be between 0 and 3';
	end if;

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

grant execute on function public.create_room(uuid, jsonb) to authenticated;

-- =============================================================================
-- update_room_settings: host edits settings.
-- - In lobby: full replace (with the same validation as create_room).
-- - In drafting: only timer_seconds may change (takes effect next auction).
-- - In voting/finished: rejected.
-- =============================================================================
create or replace function public.update_room_settings(
	p_room_id uuid,
	p_settings jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user_id uuid := auth.uid();
	v_room rooms%rowtype;
	v_new jsonb;
	v_new_timer int;
begin
	if v_user_id is null then raise exception 'not authenticated'; end if;
	if p_settings is null then raise exception 'settings cannot be null'; end if;

	select * into v_room from public.rooms where id = p_room_id for update;
	if not found then raise exception 'room not found'; end if;
	if v_room.host_id <> v_user_id then raise exception 'only host can edit settings'; end if;

	if v_room.status = 'lobby' then
		v_new := v_room.settings || p_settings;

		if (v_new ->> 'timer_seconds')::int not between 10 and 600 then
			raise exception 'settings.timer_seconds must be between 10 and 600';
		end if;
		if (v_new ->> 'max_members')::int not between 2 and 8 then
			raise exception 'settings.max_members must be between 2 and 8';
		end if;
		if (v_new ->> 'extra_per_position')::int not between 0 and 3 then
			raise exception 'settings.extra_per_position must be between 0 and 3';
		end if;

		update public.rooms set settings = v_new where id = p_room_id;
	elsif v_room.status = 'drafting' then
		if not (p_settings ? 'timer_seconds') then
			raise exception 'only timer_seconds may change after start';
		end if;
		v_new_timer := (p_settings ->> 'timer_seconds')::int;
		if v_new_timer not between 10 and 600 then
			raise exception 'timer_seconds must be between 10 and 600';
		end if;
		update public.rooms
		set settings = v_room.settings || jsonb_build_object('timer_seconds', v_new_timer)
		where id = p_room_id;
	else
		raise exception 'cannot edit settings after drafting';
	end if;
end;
$$;

grant execute on function public.update_room_settings(uuid, jsonb) to authenticated;
