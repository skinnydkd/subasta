-- ============================================================================
-- subasta — seed entrypoint. Run automatically by `supabase db reset`.
-- Splits seed data into multiple files under supabase/seed/ for clarity.
-- ============================================================================

\ir seed/01_dev_theme.sql
\ir seed/02_dev_players.sql
