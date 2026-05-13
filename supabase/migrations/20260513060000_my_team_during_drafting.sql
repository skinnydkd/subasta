-- Show the calling user's own team during drafting so they can plan bids.
-- Before: teams populated only on voting/finished (all teams visible).
-- Now: teams populated during drafting too, but only with auth.uid()'s
--      closed auctions (privacy — opponents' picks stay hidden).
-- Voting/finished behavior unchanged (all teams).

create or replace function public.get_room_view(p_code text)
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
	v_active jsonb := null;
	v_active_player jsonb := null;
	v_recent_bids jsonb := '[]'::jsonb;
	v_upcoming jsonb := '[]'::jsonb;
	v_teams jsonb := '{}'::jsonb;
	v_tally jsonb := '[]'::jsonb;
begin
	select * into v_room from public.rooms where code = upper(p_code);
	if not found then return null; end if;

	select display_name into v_theme_name from public.themes where id = v_room.theme_id;

	select coalesce(jsonb_agg(jsonb_build_object(
		'user_id', rm.user_id,
		'display_name', p.display_name,
		'budget_remaining_cents', rm.budget_remaining_cents,
		'joined_at', rm.joined_at
	) order by rm.joined_at), '[]'::jsonb)
	into v_members
	from public.room_members rm
	join public.profiles p on p.id = rm.user_id
	where rm.room_id = v_room.id;

	if v_room.status = 'drafting' then
		select jsonb_build_object(
			'id', a.id,
			'sequence_number', a.sequence_number,
			'status', a.status,
			'current_bid_cents', a.current_bid_cents,
			'current_bidder_id', a.current_bidder_id,
			'ends_at', a.ends_at,
			'started_at', a.started_at,
			'position_slot', a.position_slot,
			'player_id', a.player_id
		),
		jsonb_build_object(
			'id', pl.id,
			'name', pl.name,
			'photo_url', pl.photo_url,
			'primary_position', pl.primary_position,
			'secondary_positions', pl.secondary_positions,
			'market_value_cents', pl.market_value_cents,
			'metadata', pl.metadata
		)
		into v_active, v_active_player
		from public.auctions a
		join public.players pl on pl.id = a.player_id
		where a.room_id = v_room.id and a.status = 'active'
		limit 1;

		if v_active is not null then
			select coalesce(jsonb_agg(jsonb_build_object(
				'id', b.id,
				'amount_cents', b.amount_cents,
				'created_at', b.created_at,
				'user_id', b.user_id,
				'profile', jsonb_build_object('display_name', p.display_name)
			) order by b.created_at desc), '[]'::jsonb)
			into v_recent_bids
			from public.bids b
			join public.profiles p on p.id = b.user_id
			where b.auction_id = (v_active ->> 'id')::uuid;
		end if;

		select coalesce(jsonb_agg(jsonb_build_object(
			'sequence_number', a.sequence_number,
			'position_slot', a.position_slot,
			'player_name', pl.name,
			'team', pl.metadata ->> 'team'
		) order by a.sequence_number), '[]'::jsonb)
		into v_upcoming
		from (
			select a2.sequence_number, a2.position_slot, a2.player_id
			from public.auctions a2
			where a2.room_id = v_room.id and a2.status = 'pending'
			order by a2.sequence_number
			limit 3
		) a
		join public.players pl on pl.id = a.player_id;
	end if;

	-- Teams: during drafting only auth.uid()'s own picks; during voting and
	-- finished, every member's team (already-completed game).
	if v_room.status in ('drafting', 'voting', 'finished') then
		select coalesce(jsonb_object_agg(winner_id, players), '{}'::jsonb)
		into v_teams
		from (
			select
				a.winner_id::text as winner_id,
				jsonb_agg(jsonb_build_object(
					'auction_id', a.id,
					'position_slot', a.position_slot,
					'player_id', a.player_id,
					'player_name', pl.name,
					'player_position', pl.primary_position,
					'final_price_cents', a.final_price_cents,
					'auction_status', a.status
				) order by a.position_slot, a.sequence_number) as players
			from public.auctions a
			join public.players pl on pl.id = a.player_id
			where a.room_id = v_room.id
				and a.winner_id is not null
				and (v_room.status <> 'drafting' or a.winner_id = auth.uid())
			group by a.winner_id
		) t;
	end if;

	if v_room.status = 'finished' then
		select coalesce(jsonb_agg(jsonb_build_object(
			'user_id', user_id,
			'total_points', total_points,
			'votes_received', votes_received
		)), '[]'::jsonb)
		into v_tally
		from public.vote_tally
		where room_id = v_room.id;
	end if;

	return jsonb_build_object(
		'room', jsonb_build_object(
			'id', v_room.id,
			'code', v_room.code,
			'host_id', v_room.host_id,
			'status', v_room.status,
			'settings', v_room.settings,
			'theme', jsonb_build_object('id', v_room.theme_id, 'display_name', v_theme_name)
		),
		'members', v_members,
		'active_auction', v_active,
		'active_player', v_active_player,
		'recent_bids', v_recent_bids,
		'upcoming_auctions', v_upcoming,
		'teams', v_teams,
		'tally', v_tally
	);
end;
$$;

grant execute on function public.get_room_view(text) to anon, authenticated;
