-- ============================================================================
-- subasta — enable Postgres Changes (realtime) on game-state tables
-- ============================================================================
-- The Supabase realtime broker reads from the supabase_realtime logical
-- replication publication. Tables added via migrations aren't automatically
-- in that publication, so postgres_changes subscriptions on the client
-- received nothing — the room page never auto-refreshed when status flipped.
--
-- This migration adds rooms, auctions, room_members and bids to the
-- publication so the realtime subscriptions in /room/[code] start firing.
-- ============================================================================

do $$
begin
	if not exists (
		select 1 from pg_publication_tables
		where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
	) then
		alter publication supabase_realtime add table public.rooms;
	end if;

	if not exists (
		select 1 from pg_publication_tables
		where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'auctions'
	) then
		alter publication supabase_realtime add table public.auctions;
	end if;

	if not exists (
		select 1 from pg_publication_tables
		where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_members'
	) then
		alter publication supabase_realtime add table public.room_members;
	end if;

	if not exists (
		select 1 from pg_publication_tables
		where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bids'
	) then
		alter publication supabase_realtime add table public.bids;
	end if;
end $$;
