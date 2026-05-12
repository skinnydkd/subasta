-- Refresh La Liga 2025-26 theme membership.
--
-- The original seed (commit ed6cbb42) hand-curated the laliga-25-26 squads
-- based on stale model knowledge (Rodrigo De Paul, Lucas Vázquez, Modrić,
-- Hamari Traoré, Zubimendi, etc. — all departed). This migration retires
-- every existing tag for laliga-25-26 so that the regenerated seed (sourced
-- from Wikipedia 2025-26 season pages, see scripts/fetch-squads.mjs) can
-- start from a clean slate.
--
-- We do NOT delete player rows — they may be referenced by historical
-- auctions/bids/teams. They simply stop appearing in laliga-25-26 themes
-- after this runs.

delete from public.player_tags
where tag_id = (select id from public.tags where slug = 'laliga-25-26');
