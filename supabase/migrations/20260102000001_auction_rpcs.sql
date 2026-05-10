-- ============================================================================
-- subasta — auction engine RPCs
-- ============================================================================
-- All state mutations during a draft go through these functions. RLS prevents
-- direct UPDATE/INSERT on auctions and bids; clients can only read. The RPCs
-- are SECURITY DEFINER and validate everything atomically with row locks.
-- ============================================================================

-- ----------------------------------------------------------------- check relax
-- The 'skipped' enum value was added in 20260102000000_add_skipped_enum.sql.
-- Now we relax the original check constraint to permit winner_id NULL when
-- status is pending/active/skipped.
do $$
declare
	v_cname text;
begin
	select conname into v_cname
	from pg_constraint
	where conrelid = 'public.auctions'::regclass
		and contype = 'c'
		and pg_get_constraintdef(oid) ilike '%auto_assigned%';
	if v_cname is not null then
		execute format('alter table public.auctions drop constraint %I', v_cname);
	end if;
end $$;

alter table public.auctions add constraint auctions_winner_required check (
	-- closed and auto_assigned must have a winner; skipped/pending/active must NOT
	(status in ('closed', 'auto_assigned') and winner_id is not null)
	or (status in ('pending', 'active', 'skipped') and winner_id is null)
);

-- =============================================================================
-- start_room: host starts the draft. Validates state, builds auction queue.
-- =============================================================================
create or replace function public.start_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user_id uuid := auth.uid();
	v_room rooms%rowtype;
	v_settings jsonb;
	v_formation jsonb;
	v_filter jsonb;
	v_member_count int;
	v_extras int;
	v_timer int;
	v_pos text;
	v_count_for_pos int;
	v_total_slots int;
	v_inserted_count int;
	v_first_id uuid;
begin
	if v_user_id is null then raise exception 'not authenticated'; end if;

	select * into v_room from public.rooms where id = p_room_id for update;
	if not found then raise exception 'room not found'; end if;
	if v_room.host_id <> v_user_id then raise exception 'only host can start'; end if;
	if v_room.status <> 'lobby' then raise exception 'room not in lobby'; end if;

	select count(*) into v_member_count from public.room_members where room_id = p_room_id;
	if v_member_count < 2 then raise exception 'need at least 2 members to start'; end if;

	v_settings := v_room.settings;
	v_formation := v_settings -> 'formation';
	v_extras := coalesce((v_settings ->> 'extra_per_position')::int, 1);
	v_timer := coalesce((v_settings ->> 'timer_seconds')::int, 60);

	select filter_config into v_filter from public.themes where id = v_room.theme_id;
	if v_filter is null then v_filter := '{}'::jsonb; end if;

	-- For each position in the formation, pick (members + extras) * formation[pos]
	-- random non-scrub players matching the theme filter.
	-- We accumulate everything into a temp table, shuffle once globally, and
	-- assign sequence_numbers in random order (decision: random across positions).
	create temp table tmp_queue (
		player_id uuid,
		position_slot position_code,
		rnd double precision
	) on commit drop;

	for v_pos, v_count_for_pos in
		select key, value::int from jsonb_each_text(v_formation)
	loop
		v_total_slots := v_count_for_pos * (v_member_count + v_extras);
		if v_total_slots <= 0 then continue; end if;

		insert into tmp_queue (player_id, position_slot, rnd)
		select p.id, v_pos::position_code, random()
		from public.players p
		where p.primary_position = v_pos::position_code
			and p.is_scrub = false
			and (
				coalesce(jsonb_array_length(v_filter -> 'include_tags'), 0) = 0
				or exists (
					select 1 from public.player_tags pt
					join public.tags t on t.id = pt.tag_id
					where pt.player_id = p.id
						and t.slug in (
							select jsonb_array_elements_text(v_filter -> 'include_tags')
						)
				)
			)
			and (
				coalesce(jsonb_array_length(v_filter -> 'exclude_tags'), 0) = 0
				or not exists (
					select 1 from public.player_tags pt
					join public.tags t on t.id = pt.tag_id
					where pt.player_id = p.id
						and t.slug in (
							select jsonb_array_elements_text(v_filter -> 'exclude_tags')
						)
				)
			)
		order by random()
		limit v_total_slots;

		get diagnostics v_inserted_count = row_count;
		if v_inserted_count < v_total_slots then
			raise exception 'not enough players for position %: need %, have %',
				v_pos, v_total_slots, v_inserted_count;
		end if;
	end loop;

	-- Insert into auctions with random global sequence (decision: order=random).
	with ordered as (
		select player_id, position_slot, row_number() over (order by rnd) as seq
		from tmp_queue
	)
	insert into public.auctions (room_id, player_id, position_slot, sequence_number, status)
	select p_room_id, player_id, position_slot, seq, 'pending'
	from ordered;

	-- Activate the first one and flip room status.
	update public.auctions
	set status = 'active', started_at = now(), ends_at = now() + (v_timer || ' seconds')::interval
	where room_id = p_room_id and sequence_number = 1
	returning id into v_first_id;

	update public.rooms set status = 'drafting', started_at = now() where id = p_room_id;
end;
$$;

-- =============================================================================
-- place_bid: caller bids on the active auction. Atomic via row lock.
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

	-- Lock the auction row to serialize concurrent bidders.
	select * into v_auction from public.auctions where id = p_auction_id for update;
	if not found then raise exception 'auction not found'; end if;

	if v_auction.status <> 'active' then raise exception 'auction not active'; end if;
	if v_auction.ends_at is not null and v_auction.ends_at <= now() then
		raise exception 'auction expired';
	end if;
	if v_auction.current_bidder_id = v_user_id then
		raise exception 'cannot outbid yourself';
	end if;

	-- Caller must be a room member (also fetches budget).
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

	-- Update auction state + reset timer.
	update public.auctions
	set current_bid_cents = p_amount_cents,
		current_bidder_id = v_user_id,
		ends_at = now() + (v_timer || ' seconds')::interval
	where id = p_auction_id;

	insert into public.bids (auction_id, user_id, amount_cents)
	values (p_auction_id, v_user_id, p_amount_cents);
end;
$$;

-- =============================================================================
-- advance_auction: host closes the current active auction and opens the next.
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
	v_new_status auction_status;
begin
	if v_user_id is null then raise exception 'not authenticated'; end if;

	select * into v_room from public.rooms where id = p_room_id for update;
	if not found then raise exception 'room not found'; end if;
	if v_room.host_id <> v_user_id then raise exception 'only host can advance'; end if;
	if v_room.status <> 'drafting' then raise exception 'room not drafting'; end if;

	v_settings := v_room.settings;
	v_timer := coalesce((v_settings ->> 'timer_seconds')::int, 60);

	-- Find current active auction (there should be exactly one).
	select * into v_active
	from public.auctions
	where room_id = p_room_id and status = 'active'
	for update;

	if found then
		if v_active.current_bidder_id is not null then
			-- Real winner: deduct budget, record price.
			v_winner_id := v_active.current_bidder_id;
			v_final_price := v_active.current_bid_cents;
			v_new_status := 'closed';

			update public.room_members
			set budget_remaining_cents = budget_remaining_cents - v_final_price
			where room_id = p_room_id and user_id = v_winner_id;

			update public.auctions
			set status = v_new_status,
				winner_id = v_winner_id,
				final_price_cents = v_final_price,
				closed_at = now()
			where id = v_active.id;
		else
			-- Nobody bid → skip (decision: salta el jugador, no s'assigna).
			update public.auctions
			set status = 'skipped',
				closed_at = now()
			where id = v_active.id;
		end if;
	end if;

	-- Open the next pending auction by sequence_number.
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
		-- No more auctions → transition to voting phase.
		-- (Scrub auto-assignment will be implemented in a follow-up migration.)
		update public.rooms set status = 'voting' where id = p_room_id;
		return jsonb_build_object('next_auction_id', null, 'phase', 'voting');
	end if;
end;
$$;

-- =============================================================================
-- Permissions: allow authenticated users to call the RPCs.
-- =============================================================================
grant execute on function public.start_room(uuid) to authenticated;
grant execute on function public.place_bid(uuid, bigint) to authenticated;
grant execute on function public.advance_auction(uuid) to authenticated;
