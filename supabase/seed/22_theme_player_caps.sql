-- Maximum players per room for themes whose pool is too thin for more.
-- Computed from distinct-person pools per position against the default need per
-- player (4-3-3 + 1 extra per position); the app clamps max_members to this.
-- demo-2026 cannot be played at all (no RB/CB/CM) so it is unpublished.
-- Runs last so it wins over the theme upserts in earlier seeds. Idempotent.

update public.themes
set filter_config = filter_config || jsonb_build_object('max_members', v.cap)
from (values
	('barca-historic', 2),
	('madrid-historic', 2),
	('villarreal-historic', 2),
	('laliga-25-26', 3),
	('clasicos-historic', 4),
	('laliga-historicos', 6),
	('ucl-historic', 6),
	('serie-a-25-26', 6),
	('bundesliga-ligue1-portugal-25-26', 6),
	('seleccions-historiques', 6)
) as v(slug, cap)
where themes.slug = v.slug;

update public.themes set is_published = false where slug = 'demo-2026';
