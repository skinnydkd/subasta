-- ============================================================================
-- subasta — seed entrypoint. Run automatically by `supabase db reset`.
-- Splits seed data into multiple files under supabase/seed/ for clarity.
-- ============================================================================

\ir seed/01_dev_theme.sql
\ir seed/02_dev_players.sql
\ir seed/03_dev_scrubs.sql
\ir seed/04_real_laliga_25_26.sql
\ir seed/05_real_barca_0809.sql
\ir seed/06_real_madrid_0203.sql
