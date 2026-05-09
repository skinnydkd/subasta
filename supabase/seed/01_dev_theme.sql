-- ============================================================================
-- Dev seed: themes for local testing. Idempotent.
-- ============================================================================

-- Empty theme (no filter): matches every non-scrub player. Useful as a sanity
-- check before any tags are loaded. After 02_dev_players.sql runs, this
-- effectively contains all 160 demo players.
insert into public.themes (slug, display_name, description, filter_config, is_published)
values (
	'demo',
	'Demo (tots)',
	'Tema sense filtre — agafa qualsevol jugador no-scrub.',
	'{"include_tags": [], "exclude_tags": []}'::jsonb,
	true
)
on conflict (slug) do nothing;

-- Tag-filtered theme: depends on 02_dev_players.sql tagging players with
-- 'demo-2026'. Identical to the empty theme in current data, but exercises
-- the include_tags branch of start_room().
insert into public.themes (slug, display_name, description, filter_config, is_published)
values (
	'demo-2026',
	'Demo 2026 (filtrat)',
	'Tema que filtra per la tag demo-2026.',
	'{"include_tags": ["demo-2026"], "exclude_tags": []}'::jsonb,
	true
)
on conflict (slug) do nothing;
