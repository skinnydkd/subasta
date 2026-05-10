-- ============================================================================
-- Real seed: Real Madrid 2002-03 (Galácticos, La Liga winners).
-- Designed for 2-member rooms with formation 4-4-2 and extras_per_position=0
-- (exactly 22 slots = 22 squad players). The wide players Figo, McManaman
-- and Solari are classified as CM here to match the 4-4-2 layout — they'd
-- live on the wings in a 4-3-3, but the CM grouping reflects how they were
-- often deployed across the midfield band that season.
-- ============================================================================

insert into public.tags (slug, display_name, category)
values ('madrid-2002-03', 'Real Madrid 2002-03', 'club_season')
on conflict (slug) do nothing;

insert into public.themes (slug, display_name, description, filter_config, is_published)
values (
	'madrid-2002-03',
	'Real Madrid 2002-03 (Galácticos)',
	'L''era Galácticos amb Zidane, Figo, Ronaldo, Raúl. Recomanat: 2 jugadors, formació 4-4-2, sense extres.',
	'{"include_tags": ["madrid-2002-03"], "exclude_tags": []}'::jsonb,
	true
)
on conflict (slug) do nothing;

insert into public.players (name, primary_position, market_value_cents, is_scrub, metadata)
select v.name, v.pos::position_code, (v.value_m::bigint) * 100000000, false,
	jsonb_build_object('dev_seed_id', v.seed_id, 'team', 'Real Madrid 2002-03')
from (values
	('rm0203-casillas', 'Iker Casillas',         'GK',  20),
	('rm0203-cesar',    'César Sánchez',         'GK',   4),
	('rm0203-salgado',  'Míchel Salgado',        'RB',  10),
	('rm0203-geremi',   'Geremi Njitap',         'RB',   8),
	('rm0203-rcarlos',  'Roberto Carlos',        'LB',  18),
	('rm0203-bravo',    'Raúl Bravo',            'LB',   5),
	('rm0203-hierro',   'Fernando Hierro',       'CB',   8),
	('rm0203-helguera', 'Iván Helguera',         'CB',  18),
	('rm0203-pavon',    'Francisco Pavón',       'CB',   8),
	('rm0203-karanka',  'Aitor Karanka',         'CB',   3),
	('rm0203-makelele', 'Claude Makélélé',       'CM',  20),
	('rm0203-cambiasso','Esteban Cambiasso',     'CM',  10),
	('rm0203-mcmanaman','Steve McManaman',       'CM',  12),
	('rm0203-solari',   'Santiago Solari',       'CM',   8),
	('rm0203-guti',     'Guti',                  'CM',  12),
	('rm0203-zidane',   'Zinedine Zidane',       'CM',  60),
	('rm0203-conceicao','Flávio Conceição',      'CM',   8),
	('rm0203-figo',     'Luís Figo',             'CM',  35),
	('rm0203-raul',     'Raúl',                  'ST',  35),
	('rm0203-ronaldo',  'Ronaldo Nazário',       'ST',  60),
	('rm0203-morientes','Fernando Morientes',    'ST',  18),
	('rm0203-portillo', 'Javier Portillo',       'ST',   8)
) as v(seed_id, name, pos, value_m)
where not exists (
	select 1 from public.players where metadata ->> 'dev_seed_id' = v.seed_id
);

insert into public.player_tags (player_id, tag_id)
select p.id, t.id
from public.players p
cross join public.tags t
where t.slug = 'madrid-2002-03'
	and p.metadata ->> 'dev_seed_id' like 'rm0203-%'
on conflict do nothing;
