-- ============================================================================
-- subasta — Initial schema migration
-- ============================================================================
-- Auction-based football team-building game.
-- All monetary amounts are stored as BIGINT in cents of EUR (e.g. 1.000M€ =
-- 100_000_000_000). Always validate amounts server-side; never trust the
-- client.
-- ============================================================================

-- ------------------------------------------------------------------ extensions
-- pg_trgm for fuzzy player name search. In Supabase extensions live in the
-- `extensions` schema, so we must reference operator classes with that prefix.
create extension if not exists pg_trgm with schema extensions;

-- gen_random_uuid() is built into Postgres 13+ core; no extension needed.

-- ----------------------------------------------------------------------- enums
create type position_code as enum (
  'GK',
  'LB', 'RB', 'CB',
  'CDM', 'CM', 'CAM',
  'LW', 'RW', 'ST'
);

create type auction_type as enum (
  'open_timer',      -- MVP: free bidding, timer resets on each bid
  'sealed_first',    -- v2: sealed bid, pay your own bid (first-price)
  'sealed_vickrey',  -- v2: sealed bid, pay second-highest bid (Vickrey)
  'turn_based'       -- v2: rotating turns to bid or pass
);

create type room_status as enum (
  'lobby',     -- waiting for players to join and host to start
  'drafting',  -- auctions in progress
  'voting',    -- all auctions closed, players ranking each other
  'finished'   -- voting closed, winner declared
);

create type auction_status as enum (
  'pending',         -- queued, not yet started
  'active',          -- live bidding ongoing
  'closed',          -- won by a real bidder
  'auto_assigned'    -- nobody bid; player auto-assigned a scrub
);

-- ----------------------------------------------------------------- tag catalog
-- Multidimensional tags applied to players. A theme is a filter over tags.
create table tags (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,        -- e.g. 'laliga-2025-26', 'barca-2008-09'
  display_name text not null,
  category    text not null,               -- 'league_season' | 'club_season' | 'national_team' | 'mixed'
  metadata    jsonb default '{}'::jsonb,
  created_at  timestamptz default now()
);

create index idx_tags_category on tags (category);

-- ---------------------------------------------------------------------- players
create table players (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  photo_url           text,
  birth_year          int,
  primary_position    position_code not null,
  secondary_positions position_code[] default '{}',
  market_value_cents  bigint,        -- nullable: not all players have a Transfermarkt value
  is_scrub            boolean not null default false,
  metadata            jsonb default '{}'::jsonb,  -- nationality, foot, height, fifa rating...
  created_at          timestamptz default now()
);

create index idx_players_position on players (primary_position);
create index idx_players_scrub    on players (is_scrub) where is_scrub = true;
create index idx_players_name_trgm on players using gin (name extensions.gin_trgm_ops);

-- ----------------------------------------------------------- player ↔ tag link
create table player_tags (
  player_id uuid not null references players(id) on delete cascade,
  tag_id    uuid not null references tags(id) on delete cascade,
  primary key (player_id, tag_id)
);

create index idx_player_tags_tag on player_tags (tag_id);

-- ----------------------------------------------------------------------- themes
-- A theme = a filter spec over player_tags + a scrub pool reference.
-- filter_config schema:
--   {
--     "include_tags": ["laliga-2025-26"],   -- player must have ANY of these
--     "exclude_tags": [],                    -- player must have NONE of these
--     "must_have_all": []                    -- (optional) player must have ALL of these
--   }
create table themes (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  display_name      text not null,
  description       text,
  filter_config     jsonb not null,
  scrub_filter_config jsonb,            -- separate filter for scrubs (nullable; falls back to is_scrub=true)
  cover_image_url   text,
  is_published      boolean not null default false,
  created_at        timestamptz default now()
);

create index idx_themes_published on themes (is_published) where is_published = true;

-- ---------------------------------------------------------------------- profiles
-- Mirrors auth.users with display info.
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz default now()
);

-- Auto-create a profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------------ rooms
-- settings JSON schema:
--   {
--     "formation": { "GK": 1, "LB": 1, "RB": 1, "CB": 2, "CM": 3, "ST": 3 },
--     "extra_per_position": 1,             -- N humans + this many extras per position
--     "starting_budget_cents": 100000000000, -- 1.000M€ in cents
--     "auction_type": "open_timer",
--     "timer_seconds": 60,
--     "min_bid_increment_cents": 100000000,  -- 1M€
--     "min_opening_bid_cents": 100000000     -- 1M€
--   }
create table rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  host_id     uuid references profiles(id) on delete set null,
  theme_id    uuid not null references themes(id) on delete restrict,
  status      room_status not null default 'lobby',
  settings    jsonb not null,
  created_at  timestamptz default now(),
  started_at  timestamptz,
  finished_at timestamptz
);

create index idx_rooms_code   on rooms (code);
create index idx_rooms_status on rooms (status);

-- ---------------------------------------------------------------- room members
create table room_members (
  room_id              uuid not null references rooms(id) on delete cascade,
  user_id              uuid not null references profiles(id) on delete cascade,
  budget_remaining_cents bigint not null,
  joined_at            timestamptz default now(),
  primary key (room_id, user_id)
);

create index idx_room_members_user on room_members (user_id);

-- --------------------------------------------------------------------- auctions
create table auctions (
  id                  uuid primary key default gen_random_uuid(),
  room_id             uuid not null references rooms(id) on delete cascade,
  player_id           uuid not null references players(id) on delete restrict,
  position_slot       position_code not null,
  sequence_number     int not null,
  status              auction_status not null default 'pending',
  current_bid_cents   bigint,
  current_bidder_id   uuid references profiles(id) on delete set null,
  ends_at             timestamptz,
  winner_id           uuid references profiles(id) on delete set null,
  final_price_cents   bigint,
  started_at          timestamptz,
  closed_at           timestamptz,
  unique (room_id, sequence_number),
  check (
    (status in ('closed', 'auto_assigned') and winner_id is not null)
    or status not in ('closed', 'auto_assigned')
  )
);

create index idx_auctions_room_status on auctions (room_id, status);
create index idx_auctions_room_seq    on auctions (room_id, sequence_number);

-- ------------------------------------------------------------------------- bids
create table bids (
  id          uuid primary key default gen_random_uuid(),
  auction_id  uuid not null references auctions(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  created_at  timestamptz default now()
);

create index idx_bids_auction_created on bids (auction_id, created_at desc);
create index idx_bids_user            on bids (user_id);

-- ---------------------------------------------------------------- final teams view
-- Convenience view: every player a user owns at the end of a room.
create view team_view as
  select
    a.room_id,
    a.winner_id     as user_id,
    a.player_id,
    a.position_slot,
    a.final_price_cents,
    a.status        as acquisition_status  -- 'closed' or 'auto_assigned'
  from auctions a
  where a.winner_id is not null;

-- -------------------------------------------------------------------- voting
-- Each voter ranks their top-3 OTHER players in the room.
create table votes (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references rooms(id) on delete cascade,
  voter_id        uuid not null references profiles(id) on delete cascade,
  rank_1_user_id  uuid not null references profiles(id) on delete restrict,
  rank_2_user_id  uuid references profiles(id) on delete restrict,
  rank_3_user_id  uuid references profiles(id) on delete restrict,
  created_at      timestamptz default now(),
  unique (room_id, voter_id),
  -- voter cannot vote for themselves
  check (rank_1_user_id <> voter_id),
  check (rank_2_user_id is null or rank_2_user_id <> voter_id),
  check (rank_3_user_id is null or rank_3_user_id <> voter_id),
  -- ranks must be distinct
  check (rank_2_user_id is null or rank_1_user_id <> rank_2_user_id),
  check (rank_3_user_id is null or rank_1_user_id <> rank_3_user_id),
  check (rank_3_user_id is null or rank_2_user_id <> rank_3_user_id),
  -- if rank_3 set, rank_2 must also be set (no holes)
  check (rank_3_user_id is null or rank_2_user_id is not null)
);

-- =========================================================================== 
-- Row Level Security
-- ===========================================================================
alter table profiles      enable row level security;
alter table tags          enable row level security;
alter table players       enable row level security;
alter table player_tags   enable row level security;
alter table themes        enable row level security;
alter table rooms         enable row level security;
alter table room_members  enable row level security;
alter table auctions      enable row level security;
alter table bids          enable row level security;
alter table votes         enable row level security;

-- profiles: anyone authenticated can read; you can only update yourself.
create policy "profiles readable by authenticated"
  on profiles for select to authenticated using (true);

create policy "profiles updatable by self"
  on profiles for update to authenticated using (auth.uid() = id);

-- tags / players / player_tags / themes: read-only catalog (writes via service_role only)
create policy "catalog readable" on tags         for select to authenticated using (true);
create policy "catalog readable" on players      for select to authenticated using (true);
create policy "catalog readable" on player_tags  for select to authenticated using (true);
create policy "catalog readable" on themes       for select to authenticated using (is_published = true);

-- rooms: members can read; host can insert/update; nobody deletes (use status='finished').
create policy "rooms readable by members"
  on rooms for select to authenticated using (
    id in (select room_id from room_members where user_id = auth.uid())
  );

create policy "rooms insertable by anyone (becomes host)"
  on rooms for insert to authenticated with check (host_id = auth.uid());

create policy "rooms updatable by host"
  on rooms for update to authenticated using (host_id = auth.uid());

-- room_members: members can read members of their rooms; users can insert themselves.
create policy "room_members readable by co-members"
  on room_members for select to authenticated using (
    room_id in (select room_id from room_members where user_id = auth.uid())
  );

create policy "room_members insertable as self"
  on room_members for insert to authenticated with check (user_id = auth.uid());

-- auctions: readable by room members; mutations via RPC only (no direct writes).
create policy "auctions readable by room members"
  on auctions for select to authenticated using (
    room_id in (select room_id from room_members where user_id = auth.uid())
  );

-- bids: readable by room members; insertion via RPC only (validates budget + bid increment).
create policy "bids readable by room members"
  on bids for select to authenticated using (
    auction_id in (
      select a.id from auctions a
      where a.room_id in (select room_id from room_members where user_id = auth.uid())
    )
  );

-- votes: readable by room members once room is finished; insertable as self in voting phase.
create policy "votes readable post-finish"
  on votes for select to authenticated using (
    room_id in (
      select id from rooms where status = 'finished'
        and id in (select room_id from room_members where user_id = auth.uid())
    )
  );

create policy "votes insertable as self in voting phase"
  on votes for insert to authenticated with check (
    voter_id = auth.uid()
    and room_id in (select id from rooms where status = 'voting')
    and room_id in (select room_id from room_members where user_id = auth.uid())
  );

-- =========================================================================== 
-- RPC stubs (to implement in subsequent migrations / edge functions)
-- ===========================================================================
-- These are intentionally placeholders so the auction engine has a single
-- canonical entry point. Implement them with proper validation:
--
--   rpc.place_bid(p_auction_id uuid, p_amount_cents bigint)
--     -- validates: room status, auction status, user is room_member,
--     --            amount >= current_bid + min_increment, budget sufficient,
--     --            atomic update with row locking
--
--   rpc.close_auction(p_auction_id uuid)
--     -- validates: timer expired or admin trigger; updates winner,
--     --            deducts budget, advances queue, opens next auction
--
--   rpc.auto_assign_scrubs(p_room_id uuid)
--     -- runs after last auction; for each member with empty positions,
--     --   picks a random player from the theme's scrub pool
--
--   rpc.tally_votes(p_room_id uuid) returns jsonb
--     -- 3-2-1 ranking sum, returns per-user totals + winner
--
-- Add these in a follow-up migration once the SvelteKit client can call them.
