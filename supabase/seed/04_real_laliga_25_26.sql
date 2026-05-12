-- ============================================================================
-- Real seed: La Liga 25-26 squads, auto-generated from Wikipedia by
-- scripts/fetch-squads.mjs + scripts/build-laliga-seed.mjs.
-- Generated: 2026-05-12T21:09:32.757Z
--
-- Note: every midfielder is classified as CM regardless of CDM/CAM tendency,
-- because the default formation (4-3-3) only allocates CM slots — players
-- tagged CDM/CAM would otherwise never enter the queue.
-- Wingers (RW/LW) are detected from the player's individual Wikipedia
-- summary ("plays as a right winger"). All other refinements come from the
-- season page's {{Fs player}}/{{Efs player2}}/{{fb si player}} templates.
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

-- Squad list shared by both the players insert and the tagging insert.
-- Use a temporary table so it survives across statements when this file
-- runs through scripts/run-sql.mjs (one query, multi-statement).
create temporary table _laliga2526_squad (
	seed_id text,
	name text,
	pos text,
	team text,
	value_m int
) on commit drop;

insert into _laliga2526_squad (seed_id, name, pos, team, value_m) values
	-- ===================== Real Madrid =====================
	('rm-endrick', 'Endrick', 'ST', 'Real Madrid', 40),
	('rm-courtois', 'Thibaut Courtois', 'GK', 'Real Madrid', 15),
	('rm-carvajal', 'Dani Carvajal', 'RB', 'Real Madrid', 18),
	('rm-militao', 'Éder Militão', 'CB', 'Real Madrid', 45),
	('rm-alaba', 'David Alaba', 'CB', 'Real Madrid', 25),
	('rm-bellingham', 'Jude Bellingham', 'CM', 'Real Madrid', 180),
	('rm-camavinga', 'Eduardo Camavinga', 'CM', 'Real Madrid', 70),
	('rm-junior', 'Vinícius Júnior', 'ST', 'Real Madrid', 200),
	('rm-valverde', 'Federico Valverde', 'CM', 'Real Madrid', 100),
	('rm-mbappe', 'Kylian Mbappé', 'ST', 'Real Madrid', 180),
	('rm-rodrygo', 'Rodrygo', 'ST', 'Real Madrid', 90),
	('rm-alexanderarn', 'Trent Alexander-Arnold', 'RB', 'Real Madrid', 70),
	('rm-lunin', 'Andriy Lunin', 'GK', 'Real Madrid', 15),
	('rm-tchouameni', 'Aurélien Tchouaméni', 'CM', 'Real Madrid', 80),
	('rm-guler', 'Arda Güler', 'CM', 'Real Madrid', 70),
	('rm-garcia', 'Gonzalo García', 'ST', 'Real Madrid', 40),
	('rm-asencio', 'Raúl Asencio', 'CB', 'Real Madrid', 25),
	('rm-carreras', 'Álvaro Carreras', 'LB', 'Real Madrid', 18),
	('rm-ceballos', 'Dani Ceballos', 'CM', 'Real Madrid', 30),
	('rm-garcia2', 'Fran García', 'LB', 'Real Madrid', 18),
	('rm-diaz', 'Brahim Díaz', 'RW', 'Real Madrid', 45),
	('rm-rudiger', 'Antonio Rüdiger', 'CB', 'Real Madrid', 30),
	('rm-mendy', 'Ferland Mendy', 'LB', 'Real Madrid', 18),
	('rm-huijsen', 'Dean Huijsen', 'CB', 'Real Madrid', 60),
	('rm-mastantuono', 'Franco Mastantuono', 'RW', 'Real Madrid', 40),
	('rm-valdepenas', 'Víctor Valdepeñas', 'LB', 'Real Madrid', 18),
	('rm-pitarch', 'Thiago Pitarch', 'CM', 'Real Madrid', 30),
	('rm-mesonero', 'Daniel Mesonero', 'CM', 'Real Madrid', 30),
	-- ===================== Barcelona =====================
	('bar-garcia', 'Joan Garcia', 'GK', 'Barcelona', 35),
	('bar-szczesny', 'Wojciech Szczęsny', 'GK', 'Barcelona', 15),
	('bar-cancelo', 'João Cancelo', 'CB', 'Barcelona', 25),
	('bar-balde', 'Alejandro Balde', 'LB', 'Barcelona', 18),
	('bar-araujo', 'Ronald Araújo', 'CB', 'Barcelona', 65),
	('bar-cubarsi', 'Pau Cubarsí', 'CB', 'Barcelona', 80),
	('bar-christensen', 'Andreas Christensen', 'CB', 'Barcelona', 20),
	('bar-martin', 'Gerard Martín', 'CB', 'Barcelona', 25),
	('bar-kounde', 'Jules Koundé', 'CB', 'Barcelona', 55),
	('bar-garcia2', 'Eric García', 'CB', 'Barcelona', 25),
	('bar-gavi', 'Gavi', 'CM', 'Barcelona', 80),
	('bar-pedri', 'Pedri', 'CM', 'Barcelona', 110),
	('bar-lopez', 'Fermín López', 'CM', 'Barcelona', 30),
	('bar-casado', 'Marc Casadó', 'CM', 'Barcelona', 30),
	('bar-olmo', 'Dani Olmo', 'CM', 'Barcelona', 60),
	('bar-jong', 'Frenkie de Jong', 'CM', 'Barcelona', 50),
	('bar-bernal', 'Marc Bernal', 'CM', 'Barcelona', 30),
	('bar-torres', 'Ferran Torres', 'LW', 'Barcelona', 35),
	('bar-lewandowski', 'Robert Lewandowski', 'ST', 'Barcelona', 15),
	('bar-yamal', 'Lamine Yamal', 'RW', 'Barcelona', 200),
	('bar-raphinha', 'Raphinha', 'RW', 'Barcelona', 80),
	('bar-rashford', 'Marcus Rashford', 'LW', 'Barcelona', 30),
	('bar-bardghji', 'Roony Bardghji', 'RW', 'Barcelona', 40),
	('bar-bonfill', 'Max Bonfill', 'GK', 'Barcelona', 15),
	('bar-pacifico', 'Patricio Pacifico', 'CB', 'Barcelona', 25),
	-- ===================== Atlético =====================
	('atm-musso', 'Juan Musso', 'GK', 'Atlético', 15),
	('atm-gimenez', 'José Giménez', 'CB', 'Atlético', 25),
	('atm-ruggeri', 'Matteo Ruggeri', 'LB', 'Atlético', 18),
	('atm-mendoza', 'Rodrigo Mendoza', 'CM', 'Atlético', 30),
	('atm-cardoso', 'Johnny Cardoso', 'CM', 'Atlético', 30),
	('atm-koke', 'Koke', 'CM', 'Atlético', 30),
	('atm-griezmann', 'Antoine Griezmann', 'ST', 'Atlético', 20),
	('atm-barrios', 'Pablo Barrios', 'CM', 'Atlético', 35),
	('atm-srloth', 'Alexander Sørloth', 'ST', 'Atlético', 30),
	('atm-baena', 'Álex Baena', 'CM', 'Atlético', 35),
	('atm-almada', 'Thiago Almada', 'CM', 'Atlético', 40),
	('atm-oblak', 'Jan Oblak', 'GK', 'Atlético', 22),
	('atm-llorente', 'Marcos Llorente', 'CM', 'Atlético', 30),
	('atm-lenglet', 'Clément Lenglet', 'CB', 'Atlético', 25),
	('atm-molina', 'Nahuel Molina', 'RB', 'Atlético', 18),
	('atm-hancko', 'Dávid Hancko', 'LB', 'Atlético', 35),
	('atm-pubill', 'Marc Pubill', 'RB', 'Atlético', 18),
	('atm-alvarez', 'Julián Alvarez', 'ST', 'Atlético', 90),
	('atm-simeone', 'Giuliano Simeone', 'CM', 'Atlético', 30),
	('atm-vargas', 'Obed Vargas', 'CM', 'Atlético', 30),
	('atm-lookman', 'Ademola Lookman', 'RW', 'Atlético', 50),
	('atm-gonzalez', 'Nico González', 'CM', 'Atlético', 30),
	('atm-normand', 'Robin Le Normand', 'CB', 'Atlético', 30),
	('atm-seidu', 'Taufik Seidu', 'CM', 'Atlético', 30),
	('atm-martinez', 'Dani Martínez', 'CB', 'Atlético', 25),
	('atm-diaz', 'Julio Díaz', 'LB', 'Atlético', 18),
	('atm-luque', 'Iker Luque', 'CM', 'Atlético', 30),
	('atm-morcillo', 'Javi Morcillo', 'CM', 'Atlético', 30),
	('atm-cubo', 'Miguel Cubo', 'CM', 'Atlético', 30),
	('atm-gallagher', 'Conor Gallagher', 'CM', 'Atlético', 35),
	('atm-martin', 'Carlos Martín', 'ST', 'Atlético', 40),
	('atm-galan', 'Javi Galán', 'CB', 'Atlético', 25),
	('atm-raspadori', 'Giacomo Raspadori', 'ST', 'Atlético', 30),
	-- ===================== Athletic =====================
	('ath-simon', 'Unai Simón', 'GK', 'Athletic', 25),
	('ath-gorosabel', 'Andoni Gorosabel', 'RB', 'Athletic', 18),
	('ath-vivian', 'Dani Vivian', 'CB', 'Athletic', 30),
	('ath-paredes', 'Aitor Paredes', 'CB', 'Athletic', 25),
	('ath-alvarez', 'Yeray Álvarez', 'CB', 'Athletic', 25),
	('ath-vesga', 'Mikel Vesga', 'CM', 'Athletic', 30),
	('ath-berenguer', 'Álex Berenguer', 'RW', 'Athletic', 40),
	('ath-sancet', 'Oihan Sancet', 'CM', 'Athletic', 40),
	('ath-williams', 'Iñaki Williams', 'ST', 'Athletic', 20),
	('ath-williams2', 'Nico Williams', 'RW', 'Athletic', 65),
	('ath-guruzeta', 'Gorka Guruzeta', 'ST', 'Athletic', 40),
	('ath-areso', 'Jesús Areso', 'RB', 'Athletic', 18),
	('ath-laporte', 'Aymeric Laporte', 'CB', 'Athletic', 8),
	('ath-lekue', 'Iñigo Lekue', 'RB', 'Athletic', 18),
	('ath-galarreta', 'Iñigo Ruiz de Galarreta', 'CM', 'Athletic', 30),
	('ath-berchiche', 'Yuri Berchiche', 'LB', 'Athletic', 18),
	('ath-jauregizar', 'Mikel Jauregizar', 'CM', 'Athletic', 30),
	('ath-boiro', 'Adama Boiro', 'LB', 'Athletic', 18),
	('ath-gomez', 'Unai Gómez', 'CM', 'Athletic', 30),
	('ath-sannadi', 'Maroan Sannadi', 'ST', 'Athletic', 40),
	('ath-serrano', 'Nico Serrano', 'RW', 'Athletic', 40),
	('ath-navarro', 'Robert Navarro', 'RW', 'Athletic', 40),
	('ath-prados', 'Beñat Prados', 'CM', 'Athletic', 30),
	('ath-izeta', 'Urko Izeta', 'ST', 'Athletic', 40),
	('ath-padilla', 'Álex Padilla', 'GK', 'Athletic', 15),
	('ath-egiluz', 'Unai Egiluz', 'CB', 'Athletic', 25),
	('ath-rego', 'Alejandro Rego', 'CM', 'Athletic', 30),
	('ath-hierro', 'Asier Hierro', 'CB', 'Athletic', 25),
	('ath-sanchez', 'Ibon Sánchez', 'CB', 'Athletic', 25),
	('ath-sanchez2', 'Selton Sánchez', 'CM', 'Athletic', 30),
	-- ===================== Real Sociedad =====================
	('rso-remiro', 'Álex Remiro', 'GK', 'Real Sociedad', 14),
	('rso-aramburu', 'Jon Aramburu', 'RB', 'Real Sociedad', 18),
	('rso-munoz', 'Aihen Muñoz', 'LB', 'Real Sociedad', 18),
	('rso-gorrotxategi', 'Jon Gorrotxategi', 'CM', 'Real Sociedad', 30),
	('rso-zubeldia', 'Igor Zubeldia', 'CB', 'Real Sociedad', 25),
	('rso-elustondo', 'Aritz Elustondo', 'CB', 'Real Sociedad', 25),
	('rso-barrenetxea', 'Ander Barrenetxea', 'LW', 'Real Sociedad', 40),
	('rso-turrientes', 'Beñat Turrientes', 'CM', 'Real Sociedad', 30),
	('rso-oskarsson', 'Orri Óskarsson', 'ST', 'Real Sociedad', 15),
	('rso-oyarzabal', 'Mikel Oyarzabal', 'ST', 'Real Sociedad', 32),
	('rso-guedes', 'Gonçalo Guedes', 'RW', 'Real Sociedad', 40),
	('rso-herrera', 'Yangel Herrera', 'CM', 'Real Sociedad', 12),
	('rso-marrero', 'Unai Marrero', 'GK', 'Real Sociedad', 15),
	('rso-kubo', 'Takefusa Kubo', 'RW', 'Real Sociedad', 45),
	('rso-sadiq', 'Umar Sadiq', 'ST', 'Real Sociedad', 40),
	('rso-caletacar', 'Duje Ćaleta-Car', 'CB', 'Real Sociedad', 6),
	('rso-gomez', 'Sergio Gómez', 'LW', 'Real Sociedad', 40),
	('rso-soler', 'Carlos Soler', 'CM', 'Real Sociedad', 30),
	('rso-karrikaburu', 'Jon Karrikaburu', 'ST', 'Real Sociedad', 40),
	('rso-odriozola', 'Álvaro Odriozola', 'RB', 'Real Sociedad', 18),
	('rso-zakharyan', 'Arsen Zakharyan', 'CM', 'Real Sociedad', 18),
	('rso-goti', 'Mikel Goti', 'RW', 'Real Sociedad', 40),
	('rso-mendez', 'Brais Méndez', 'CM', 'Real Sociedad', 22),
	('rso-sucic', 'Luka Sučić', 'CM', 'Real Sociedad', 18),
	('rso-marin', 'Pablo Marín', 'CM', 'Real Sociedad', 30),
	('rso-martin', 'Jon Martín', 'CB', 'Real Sociedad', 25),
	('rso-ruperez', 'Iñaki Rupérez', 'RB', 'Real Sociedad', 18),
	('rso-pacheco', 'Jon Pacheco', 'CB', 'Real Sociedad', 25),
	('rso-lopez', 'Javi López', 'LB', 'Real Sociedad', 18),
	('rso-fernandez', 'Carlos Fernández', 'ST', 'Real Sociedad', 40)
;

-- Insert players that don't already exist (idempotent by dev_seed_id).
insert into public.players (name, primary_position, market_value_cents, is_scrub, metadata)
select s.name, s.pos::position_code, (s.value_m::bigint) * 100000000, false,
	jsonb_build_object('dev_seed_id', s.seed_id, 'team', s.team)
from _laliga2526_squad s
where not exists (
	select 1 from public.players where metadata ->> 'dev_seed_id' = s.seed_id
);

-- Tag ONLY the seed players (no longer "everyone with prefix rm-%"). This
-- means players in the old seed who departed (e.g. De Paul, Modrić) keep
-- their player rows but stop appearing in the laliga-25-26 theme — they
-- must also be untagged by the companion migration the first time around.
insert into public.player_tags (player_id, tag_id)
select p.id, t.id
from public.players p
join _laliga2526_squad s on p.metadata ->> 'dev_seed_id' = s.seed_id
cross join public.tags t
where t.slug = 'laliga-25-26'
on conflict do nothing;
