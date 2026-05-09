-- ============================================================================
-- Dev seed: one published theme so the lobby create-room flow works locally
-- before real player/tag data is loaded. Idempotent.
-- ============================================================================

insert into public.themes (slug, display_name, description, filter_config, is_published)
values (
	'demo',
	'Demo (sense jugadors)',
	'Tema buit per a provar el flux. No té jugadors carregats.',
	'{"include_tags": [], "exclude_tags": []}'::jsonb,
	true
)
on conflict (slug) do nothing;
