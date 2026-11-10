-- Presence without Supabase Realtime: each member's poll stamps last_seen_at,
-- and "online" means seen in the last few seconds (see touchPresence in
-- src/lib/server/rooms.ts).
alter table public.room_members add column if not exists last_seen_at timestamptz;
