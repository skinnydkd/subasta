-- ============================================================================
-- subasta — add 'skipped' to auction_status enum.
-- ============================================================================
-- Postgres requires that adding a new enum value happens in its own
-- transaction before the value can be used (e.g. in CHECK constraints,
-- queries, or function bodies). The auction RPCs that use 'skipped' live
-- in the next migration (20260102000001_auction_rpcs.sql).
-- ============================================================================

alter type auction_status add value if not exists 'skipped';
