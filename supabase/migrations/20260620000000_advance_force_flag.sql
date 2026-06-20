-- Fix "SENSE PUJADES": a non-forced advance must NOT skip a live (non-expired)
-- auction. The client auto-advances when its local timer hits 0; across client
-- races / clock skew a freshly-activated auction (ends_at in the future, no
-- bids) was skipped before anyone could bid. p_force=false (auto-advance) is a
-- no-op on a live auction; only the host's explicit "force" skip passes true.

drop function if exists public.advance_auction(uuid);

create or replace function public.advance_auction(p_room_id uuid, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user_id uuid := auth.uid();
	v_room rooms%rowtype;
	v_active auctions%rowtype;
	v_active_found boolean := false;
	v_is_expired boolean := false;
	v_settings jsonb;
	v_timer int;
	v_next_id uuid;
	v_winner_id uuid;
	v_final_price bigint;
begin
	if v_user_id is null then raise exception 'not authenticated'; end if;

	select * into v_room from public.rooms where id = p_room_id for update;
	if not found then raise exception 'room not found'; end if;

	if v_room.status in ('voting', 'finished') then
		return jsonb_build_object('next_auction_id', null, 'phase', v_room.status::text);
	end if;
	if v_room.status <> 'drafting' then raise exception 'room not drafting'; end if;

	if not public.is_room_member(p_room_id, v_user_id) then
		raise exception 'not a room member';
	end if;

	v_settings := v_room.settings;
	v_timer := coalesce((v_settings ->> 'timer_seconds')::int, 60);

	select * into v_active
	from public.auctions
	where room_id = p_room_id and status = 'active'
	for update;
	v_active_found := found;
	if v_active_found then
		v_is_expired := v_active.ends_at is not null and v_active.ends_at <= now();
	end if;

	-- A still-live auction is closed early ONLY on an explicit force (host's
	-- "Següent (forçar)"). A non-forced advance (auto-advance) no-ops here,
	-- preventing client-race / clock-skew skips of a freshly-activated auction.
	if v_active_found and not v_is_expired then
		if not p_force then
			return jsonb_build_object('next_auction_id', v_active.id, 'phase', 'drafting');
		end if;
		if v_room.host_id <> v_user_id then
			raise exception 'only host can advance a live auction';
		end if;
	end if;

	if v_active_found then
		if v_active.current_bidder_id is not null then
			v_winner_id := v_active.current_bidder_id;
			v_final_price := v_active.current_bid_cents;

			update public.room_members
			set budget_remaining_cents = budget_remaining_cents - v_final_price
			where room_id = p_room_id and user_id = v_winner_id;

			update public.auctions
			set status = 'closed', winner_id = v_winner_id,
				final_price_cents = v_final_price, closed_at = now()
			where id = v_active.id;
		else
			update public.auctions
			set status = 'skipped', closed_at = now()
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
		set status = 'active', started_at = now(),
			ends_at = now() + (v_timer || ' seconds')::interval
		where id = v_next_id;
		return jsonb_build_object('next_auction_id', v_next_id, 'phase', 'drafting');
	else
		perform public.auto_assign_scrubs(p_room_id);
		update public.rooms set status = 'voting' where id = p_room_id;
		return jsonb_build_object('next_auction_id', null, 'phase', 'voting');
	end if;
end;
$$;

grant execute on function public.advance_auction(uuid, boolean) to authenticated;
