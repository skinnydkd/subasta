-- Minimal stand-ins for what Supabase ships out of the box, so the migrations in
-- supabase/migrations/ apply unchanged on plain Postgres (Neon). Idempotent.

create schema if not exists extensions;
create schema if not exists auth;

-- Users are created by the app on first visit (see src/lib/server/session.ts).
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- The server sets app.user_id (transaction-local) before calling any game function.
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

-- Grant targets referenced by the migrations. The app connects as the owner.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
