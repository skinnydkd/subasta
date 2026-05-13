-- Change place_bid timer behavior:
-- Was: every bid RESET ends_at to now() + room.timer_seconds (default 60s),
--      so a bid at 5s remaining bumped the clock back to a full 60s.
-- Now: every bid EXTENDS ends_at by exactly 5 seconds. The initial timer
--      (set when the auction first goes active) still uses room.timer_seconds;
--      this only changes the on-bid behavior.

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
		ends_at = ends_at + interval '5 seconds'
	where id = p_auction_id;

	insert into public.bids (auction_id, user_id, amount_cents)
	values (p_auction_id, v_user_id, p_amount_cents);
end;
$$;
