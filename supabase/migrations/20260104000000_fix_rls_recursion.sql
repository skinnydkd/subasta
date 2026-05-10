-- ============================================================================
-- subasta — fix infinite recursion in RLS policies
-- ============================================================================
-- The original policies on `rooms`, `room_members`, `auctions`, `bids`, `votes`
-- all checked membership by sub-querying `room_members`, which itself has an
-- RLS policy that triggers the same check → recursion ("infinite recursion
-- detected in policy for relation room_members").
--
-- Fix: a SECURITY DEFINER helper that reads room_members bypassing RLS.
-- ============================================================================

create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select exists (
		select 1 from public.room_members
		where room_id = p_room_id and user_id = p_user_id
	);
$$;

grant execute on function public.is_room_member(uuid, uuid) to authenticated;

-- Rewrite policies that previously caused recursion --------------------------

drop policy if exists "rooms readable by members" on public.rooms;
create policy "rooms readable by members"
	on public.rooms for select to authenticated
	using (public.is_room_member(id));

drop policy if exists "room_members readable by co-members" on public.room_members;
create policy "room_members readable by co-members"
	on public.room_members for select to authenticated
	using (public.is_room_member(room_id));

drop policy if exists "auctions readable by room members" on public.auctions;
create policy "auctions readable by room members"
	on public.auctions for select to authenticated
	using (public.is_room_member(room_id));

drop policy if exists "bids readable by room members" on public.bids;
create policy "bids readable by room members"
	on public.bids for select to authenticated
	using (
		auction_id in (
			select id from public.auctions where public.is_room_member(room_id)
		)
	);

drop policy if exists "votes readable post-finish" on public.votes;
create policy "votes readable post-finish"
	on public.votes for select to authenticated
	using (
		public.is_room_member(room_id)
		and exists (
			select 1 from public.rooms
			where rooms.id = votes.room_id and rooms.status = 'finished'
		)
	);

drop policy if exists "votes insertable as self in voting phase" on public.votes;
create policy "votes insertable as self in voting phase"
	on public.votes for insert to authenticated
	with check (
		voter_id = auth.uid()
		and public.is_room_member(room_id)
		and exists (
			select 1 from public.rooms
			where rooms.id = votes.room_id and rooms.status = 'voting'
		)
	);
