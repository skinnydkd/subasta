-- ============================================================================
-- Real seed: FC Barcelona 2008-09 (Pep's Sextete season).
-- Designed for 2-member rooms with formation 4-3-3 and extras_per_position=0
-- (exactly 22 slots = 22 squad players). Some positions reflect tactical
-- flexibility during the season more than nominal squad role:
--   - Cáceres listed as RB (alternate to Alves)
--   - Sylvinho listed as LB (backup to Abidal)
--   - Pedro listed as LW (he played both wings)
--   - Jeffrén Suárez listed as RW (B-team promotee)
-- ============================================================================

insert into public.tags (slug, display_name, category)
values ('barca-2008-09', 'FC Barcelona 2008-09', 'club_season')
on conflict (slug) do nothing;

insert into public.themes (slug, display_name, description, filter_config, is_published)
values (
	'barca-2008-09',
	'Barça 2008-09 (Sextete)',
	'L''equip del Sextete amb Pep Guardiola. Recomanat: 2 jugadors, formació 4-3-3, sense extres.',
	'{"include_tags": ["barca-2008-09"], "exclude_tags": []}'::jsonb,
	true
)
on conflict (slug) do nothing;

insert into public.players (name, primary_position, market_value_cents, is_scrub, metadata)
select v.name, v.pos::position_code, (v.value_m::bigint) * 100000000, false,
	jsonb_build_object('dev_seed_id', v.seed_id, 'team', 'FC Barcelona 2008-09')
from (values
	('bar0809-valdes',    'Víctor Valdés',         'GK',  18),
	('bar0809-pinto',     'José Manuel Pinto',     'GK',   2),
	('bar0809-alves',     'Daniel Alves',          'RB',  35),
	('bar0809-caceres',   'Martín Cáceres',        'RB',   8),
	('bar0809-abidal',    'Eric Abidal',           'LB',  18),
	('bar0809-sylvinho',  'Sylvinho',              'LB',   3),
	('bar0809-puyol',     'Carles Puyol',          'CB',  20),
	('bar0809-pique',     'Gerard Piqué',          'CB',  18),
	('bar0809-marquez',   'Rafael Márquez',        'CB',  10),
	('bar0809-milito',    'Gabriel Milito',        'CB',   8),
	('bar0809-yaya',      'Yaya Touré',            'CM',  25),
	('bar0809-busquets',  'Sergio Busquets',       'CM',   8),
	('bar0809-xavi',      'Xavi Hernández',        'CM',  35),
	('bar0809-iniesta',   'Andrés Iniesta',        'CM',  40),
	('bar0809-keita',     'Seydou Keita',          'CM',  12),
	('bar0809-hleb',      'Aliaksandr Hleb',       'CM',  10),
	('bar0809-henry',     'Thierry Henry',         'LW',  25),
	('bar0809-pedro',     'Pedro Rodríguez',       'LW',   3),
	('bar0809-messi',     'Lionel Messi',          'RW',  60),
	('bar0809-jeffren',   'Jeffrén Suárez',        'RW',   2),
	('bar0809-etoo',      'Samuel Eto''o',         'ST',  35),
	('bar0809-bojan',     'Bojan Krkić',           'ST',  12)
) as v(seed_id, name, pos, value_m)
where not exists (
	select 1 from public.players where metadata ->> 'dev_seed_id' = v.seed_id
);

insert into public.player_tags (player_id, tag_id)
select p.id, t.id
from public.players p
cross join public.tags t
where t.slug = 'barca-2008-09'
	and p.metadata ->> 'dev_seed_id' like 'bar0809-%'
on conflict do nothing;
