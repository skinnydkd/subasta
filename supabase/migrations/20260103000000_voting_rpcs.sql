-- ============================================================================
-- subasta — voting phase RPCs + tally view
-- ============================================================================
-- Each member ranks their top-3 OTHER members (3-2-1 points).
-- When every member has voted, the room auto-transitions to 'finished'.
-- ============================================================================

-- =============================================================================
-- cast_vote: caller submits/updates their ranking. Allows changing the vote
-- until the room transitions to 'finished'.
-- =============================================================================
create or replace function public.cast_vote(
	p_room_id uuid,
	p_rank_1 uuid,
	p_rank_2 uuid default null,
	p_rank_3 uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user_id uuid := auth.uid();
	v_room rooms%rowtype;
	v_member_count int;
	v_vote_count int;
begin
	if v_user_id is null then raise exception 'not authenticated'; end if;
	if p_rank_1 is null then raise exception 'rank_1 is required'; end if;

	-- Schema-level checks would catch most of these, but explicit messages help.
	if p_rank_1 = v_user_id or p_rank_2 = v_user_id or p_rank_3 = v_user_id then
		raise exception 'cannot vote for yourself';
	end if;
	if p_rank_2 is not null and p_rank_1 = p_rank_2 then
		raise exception 'rank_1 and rank_2 must differ';
	end if;
	if p_rank_3 is not null and (p_rank_1 = p_rank_3 or p_rank_2 = p_rank_3) then
		raise exception 'rank_3 must differ from rank_1 and rank_2';
	end if;
	if p_rank_3 is not null and p_rank_2 is null then
		raise exception 'rank_3 requires rank_2';
	end if;

	select * into v_room from public.rooms where id = p_room_id for update;
	if not found then raise exception 'room not found'; end if;
	if v_room.status <> 'voting' then raise exception 'room not in voting phase'; end if;

	if not exists (
		select 1 from public.room_members
		where room_id = p_room_id and user_id = v_user_id
	) then
		raise exception 'not a room member';
	end if;

	-- Each ranked user must also be a member of the same room.
	if not exists (
		select 1 from public.room_members
		where room_id = p_room_id and user_id = p_rank_1
	) then
		raise exception 'rank_1 user is not in this room';
	end if;
	if p_rank_2 is not null and not exists (
		select 1 from public.room_members
		where room_id = p_room_id and user_id = p_rank_2
	) then
		raise exception 'rank_2 user is not in this room';
	end if;
	if p_rank_3 is not null and not exists (
		select 1 from public.room_members
		where room_id = p_room_id and user_id = p_rank_3
	) then
		raise exception 'rank_3 user is not in this room';
	end if;

	insert into public.votes (room_id, voter_id, rank_1_user_id, rank_2_user_id, rank_3_user_id)
	values (p_room_id, v_user_id, p_rank_1, p_rank_2, p_rank_3)
	on conflict (room_id, voter_id) do update set
		rank_1_user_id = excluded.rank_1_user_id,
		rank_2_user_id = excluded.rank_2_user_id,
		rank_3_user_id = excluded.rank_3_user_id,
		created_at = now();

	-- Auto-finish when everybody has voted.
	select count(*) into v_member_count from public.room_members where room_id = p_room_id;
	select count(*) into v_vote_count from public.votes where room_id = p_room_id;

	if v_vote_count >= v_member_count then
		update public.rooms set status = 'finished', finished_at = now() where id = p_room_id;
	end if;
end;
$$;

-- =============================================================================
-- finish_voting: host force-closes the voting phase, even if not everyone voted.
-- =============================================================================
create or replace function public.finish_voting(p_room_id uuid)
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
	if v_room.host_id <> v_user_id then raise exception 'only host can finish voting'; end if;
	if v_room.status not in ('voting', 'finished') then
		raise exception 'room not in voting phase';
	end if;
	if v_room.status = 'finished' then return; end if; -- idempotent

	update public.rooms set status = 'finished', finished_at = now() where id = p_room_id;
end;
$$;

-- =============================================================================
-- vote_tally: reusable view that sums 3-2-1 points per user per room.
-- Read-only; safe to expose to all room members.
-- =============================================================================
create view public.vote_tally as
with points as (
	select room_id, rank_1_user_id as user_id, 3 as pts from public.votes
	union all
	select room_id, rank_2_user_id, 2 from public.votes where rank_2_user_id is not null
	union all
	select room_id, rank_3_user_id, 1 from public.votes where rank_3_user_id is not null
)
select
	room_id,
	user_id,
	sum(pts)::int as total_points,
	count(*)::int as votes_received
from points
group by room_id, user_id;

-- The view inherits RLS from the underlying `votes` table policy
-- ("votes readable post-finish"), so members can only see tallies once
-- the room is finished. That's the desired behavior.

-- =============================================================================
-- RLS additions
-- =============================================================================
-- The original policy ("votes readable post-finish") hides everything during
-- voting, including the voter's own row — so they can't see what they voted.
-- This policy lets a voter always read their own vote.
create policy "votes readable by voter"
	on public.votes for select to authenticated using (voter_id = auth.uid());

-- =============================================================================
-- Permissions
-- =============================================================================
grant execute on function public.cast_vote(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.finish_voting(uuid) to authenticated;
grant select on public.vote_tally to authenticated;
