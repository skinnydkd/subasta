-- Set REPLICA IDENTITY FULL on tables the room page subscribes to via
-- postgres_changes with row filters (room_id=eq.X). With the default
-- REPLICA IDENTITY (primary key only), the WAL emits UPDATE events that
-- don't include non-key columns like `room_id` — so Supabase Realtime
-- can't evaluate the filter and silently drops the event.
--
-- This is the documented Supabase requirement for filterable realtime:
-- https://supabase.com/docs/guides/realtime/postgres-changes#receiving-old-records
--
-- Effect: every member's UI updates the instant a bid lands, no longer
-- relying on the 1s polling fallback.

alter table public.auctions     replica identity full;
alter table public.bids         replica identity full;
alter table public.room_members replica identity full;
alter table public.rooms        replica identity full;
