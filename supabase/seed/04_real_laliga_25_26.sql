-- ============================================================================
-- Real seed: La Liga 25-26 squads (best-effort, based on knowledge cutoff
-- 2026-01). Top players from the major teams. Idempotent via
-- metadata.dev_seed_id like '<team>-<slug>'.
--
-- Note: every midfielder is classified as CM regardless of CDM/CAM tendency,
-- because the default formation (1-1-1-2-3-1-1-1 = 4-3-3) only allocates
-- CM slots — players tagged CDM/CAM would otherwise never enter the queue.
-- ============================================================================

insert into public.tags (slug, display_name, category)
values ('laliga-25-26', 'La Liga 2025-26', 'league_season')
on conflict (slug) do nothing;

insert into public.themes (slug, display_name, description, filter_config, is_published)
values (
	'laliga-25-26',
	'La Liga 2025-26',
	'Top jugadors de La Liga 25-26 (Real Madrid, Barça, Atlético, Athletic, Real Sociedad).',
	'{"include_tags": ["laliga-25-26"], "exclude_tags": []}'::jsonb,
	true
)
on conflict (slug) do nothing;

insert into public.players (name, primary_position, market_value_cents, is_scrub, metadata)
select v.name, v.pos::position_code, (v.value_m::bigint) * 100000000, false,
	jsonb_build_object('dev_seed_id', v.seed_id, 'team', v.team)
from (values
	-- ===================== Real Madrid =====================
	('rm-courtois',  'Thibaut Courtois',  'GK',  'Real Madrid',  35),
	('rm-lunin',     'Andriy Lunin',      'GK',  'Real Madrid',  20),
	('rm-carvajal',  'Dani Carvajal',     'RB',  'Real Madrid',  18),
	('rm-vazquez',   'Lucas Vázquez',     'RW',  'Real Madrid',   8),
	('rm-rudiger',   'Antonio Rüdiger',   'CB',  'Real Madrid',  35),
	('rm-alaba',     'David Alaba',       'CB',  'Real Madrid',  20),
	('rm-militao',   'Éder Militão',      'CB',  'Real Madrid',  45),
	('rm-asencio',   'Raúl Asencio',      'CB',  'Real Madrid',  20),
	('rm-mendy',     'Ferland Mendy',     'LB',  'Real Madrid',  18),
	('rm-fgarcia',   'Fran García',       'LB',  'Real Madrid',  15),
	('rm-tchouameni','Aurélien Tchouaméni','CM', 'Real Madrid',  85),
	('rm-camavinga', 'Eduardo Camavinga', 'CM',  'Real Madrid',  70),
	('rm-valverde',  'Federico Valverde', 'CM',  'Real Madrid',  90),
	('rm-modric',    'Luka Modrić',       'CM',  'Real Madrid',   8),
	('rm-ceballos',  'Dani Ceballos',     'CM',  'Real Madrid',  15),
	('rm-bellingham','Jude Bellingham',   'CM',  'Real Madrid', 180),
	('rm-guler',     'Arda Güler',        'CM',  'Real Madrid',  60),
	('rm-brahim',    'Brahim Díaz',       'CM',  'Real Madrid',  45),
	('rm-vinicius',  'Vinicius Júnior',   'LW',  'Real Madrid', 200),
	('rm-rodrygo',   'Rodrygo',           'RW',  'Real Madrid', 110),
	('rm-mbappe',    'Kylian Mbappé',     'ST',  'Real Madrid', 180),
	('rm-endrick',   'Endrick',           'ST',  'Real Madrid',  60),

	-- ===================== Barcelona =====================
	('bar-tstegen',  'Marc-André ter Stegen','GK','Barcelona',   28),
	('bar-jgarcia',  'Joan García',       'GK',  'Barcelona',    35),
	('bar-kounde',   'Jules Koundé',      'RB',  'Barcelona',    55),
	('bar-balde',    'Alejandro Balde',   'LB',  'Barcelona',    50),
	('bar-cubarsi',  'Pau Cubarsí',       'CB',  'Barcelona',    55),
	('bar-araujo',   'Ronald Araújo',     'CB',  'Barcelona',    65),
	('bar-imartinez','Iñigo Martínez',    'CB',  'Barcelona',    14),
	('bar-christensen','Andreas Christensen','CB','Barcelona',   20),
	('bar-degjong',  'Frenkie de Jong',   'CM',  'Barcelona',    55),
	('bar-casado',   'Marc Casadó',       'CM',  'Barcelona',    25),
	('bar-pedri',    'Pedri',             'CM',  'Barcelona',   100),
	('bar-gavi',     'Gavi',              'CM',  'Barcelona',    80),
	('bar-fermin',   'Fermín López',      'CM',  'Barcelona',    45),
	('bar-olmo',     'Dani Olmo',         'CM',  'Barcelona',    65),
	('bar-yamal',    'Lamine Yamal',      'RW',  'Barcelona',   180),
	('bar-raphinha', 'Raphinha',          'LW',  'Barcelona',    80),
	('bar-torres',   'Ferran Torres',     'LW',  'Barcelona',    35),
	('bar-lewy',     'Robert Lewandowski','ST',  'Barcelona',    18),

	-- ===================== Atlético Madrid =====================
	('atm-oblak',    'Jan Oblak',         'GK',  'Atlético',     20),
	('atm-musso',    'Juan Musso',        'GK',  'Atlético',     10),
	('atm-llorente', 'Marcos Llorente',   'RB',  'Atlético',     35),
	('atm-molina',   'Nahuel Molina',     'RB',  'Atlético',     22),
	('atm-reinildo', 'Reinildo Mandava',  'LB',  'Atlético',      8),
	('atm-galan',    'Javi Galán',        'LB',  'Atlético',     12),
	('atm-gimenez',  'José Giménez',      'CB',  'Atlético',     22),
	('atm-lenormand','Robin Le Normand',  'CB',  'Atlético',     30),
	('atm-witsel',   'Axel Witsel',       'CB',  'Atlético',      4),
	('atm-depaul',   'Rodrigo De Paul',   'CM',  'Atlético',     22),
	('atm-koke',     'Koke',              'CM',  'Atlético',      6),
	('atm-barrios',  'Pablo Barrios',     'CM',  'Atlético',     35),
	('atm-gallagher','Conor Gallagher',   'CM',  'Atlético',     38),
	('atm-griezmann','Antoine Griezmann', 'CM',  'Atlético',     22),
	('atm-correa',   'Ángel Correa',      'RW',  'Atlético',     18),
	('atm-lino',     'Samuel Lino',       'LW',  'Atlético',     35),
	('atm-jalvarez', 'Julián Álvarez',    'ST',  'Atlético',     85),
	('atm-sorloth',  'Alexander Sørloth', 'ST',  'Atlético',     35),

	-- ===================== Athletic Club =====================
	('ath-simon',    'Unai Simón',        'GK',  'Athletic',     25),
	('ath-padilla',  'Álex Padilla',      'GK',  'Athletic',      4),
	('ath-demarcos', 'Óscar de Marcos',   'RB',  'Athletic',      2),
	('ath-areso',    'Adama Boiro',       'RB',  'Athletic',      8),
	('ath-yuri',     'Yuri Berchiche',    'LB',  'Athletic',      5),
	('ath-vivian',   'Daniel Vivian',     'CB',  'Athletic',     35),
	('ath-yeray',    'Yeray Álvarez',     'CB',  'Athletic',     12),
	('ath-paredes',  'Aitor Paredes',     'CB',  'Athletic',     14),
	('ath-vesga',    'Mikel Vesga',       'CM',  'Athletic',      8),
	('ath-prados',   'Beñat Prados',      'CM',  'Athletic',      6),
	('ath-sancet',   'Oihan Sancet',      'CM',  'Athletic',     38),
	('ath-iwilliams','Iñaki Williams',    'RW',  'Athletic',     18),
	('ath-nwilliams','Nico Williams',     'LW',  'Athletic',     65),
	('ath-berenguer','Álex Berenguer',    'LW',  'Athletic',      9),
	('ath-guruzeta', 'Gorka Guruzeta',    'ST',  'Athletic',     14),

	-- ===================== Real Sociedad =====================
	('rso-remiro',   'Álex Remiro',       'GK',  'Real Sociedad',12),
	('rso-aramburu', 'Hamari Traoré',     'RB',  'Real Sociedad', 5),
	('rso-aihen',    'Aihen Muñoz',       'LB',  'Real Sociedad', 4),
	('rso-zubeldia', 'Igor Zubeldia',     'CB',  'Real Sociedad',12),
	('rso-elustondo','Aritz Elustondo',   'CB',  'Real Sociedad', 4),
	('rso-zubimendi','Martín Zubimendi',  'CM',  'Real Sociedad',60),
	('rso-mendez',   'Brais Méndez',      'CM',  'Real Sociedad',22),
	('rso-olasagasti','Beñat Turrientes', 'CM',  'Real Sociedad', 8),
	('rso-kubo',     'Take Kubo',         'RW',  'Real Sociedad',38),
	('rso-oyarzabal','Mikel Oyarzabal',   'LW',  'Real Sociedad',30),
	('rso-becker',   'Sheraldo Becker',   'ST',  'Real Sociedad', 8),
	('rso-asilva',   'André Silva',       'ST',  'Real Sociedad', 7)
) as v(seed_id, name, pos, team, value_m)
where not exists (
	select 1 from public.players where metadata ->> 'dev_seed_id' = v.seed_id
);

-- Tag every La Liga 25-26 player with the matching tag.
insert into public.player_tags (player_id, tag_id)
select p.id, t.id
from public.players p
cross join public.tags t
where t.slug = 'laliga-25-26'
	and (
		p.metadata ->> 'dev_seed_id' like 'rm-%'
		or p.metadata ->> 'dev_seed_id' like 'bar-%'
		or p.metadata ->> 'dev_seed_id' like 'atm-%'
		or p.metadata ->> 'dev_seed_id' like 'ath-%'
		or p.metadata ->> 'dev_seed_id' like 'rso-%'
	)
on conflict do nothing;
