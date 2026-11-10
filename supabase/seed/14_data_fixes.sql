-- ============================================================================
-- Data fixes for the real seeds 04..13 (audit: documents/data-audit.md).
-- Idempotent: every statement is keyed by metadata->>'dev_seed_id' (or theme
-- slug) and can be re-run. The old seed files are NOT edited.
--
-- Sections
--   A. Re-apply fixes that earlier MIGRATIONS made but that are lost on a fresh
--      database (db-setup runs migrations BEFORE seeds, so those UPDATEs found
--      no rows to change).
--   B. Wrong / implausible primary positions (checked against the Wikipedia
--      lead sentence of each player + football knowledge).
--   C. Wrong names, name variants of one person, homonyms.
--   D. Players that do not belong to the squad (reserve / youth / junk row).
--   E. Theme hygiene.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A + B. Positions
-- ----------------------------------------------------------------------------
update public.players p
set primary_position = v.pos::position_code
from (values
	-- A. migration 20260513000000_villarreal_historic_positions (lost on fresh DB)
	('vil0506-sorin', 'LB'),        -- Juan Pablo Sorín
	('vil0506-arruabarrena', 'LB'), -- Rodolfo Arruabarrena
	('vil0506-venta', 'RB'),        -- Javi Venta
	('vil0506-josemi', 'RB'),       -- Josemi
	('vil0506-roger', 'LW'),        -- Roger García
	('vil0506-cazorla', 'RW'),      -- Santi Cazorla (wide in 05-06)
	('vil0506-guayre', 'LW'),       -- Antonio Guayre
	('vil0506-fuster', 'LW'),       -- David Fuster
	('vil0708-cani', 'RW'),
	('vil0708-fernandez', 'LW'),    -- Matías Fernández
	('vil1011-cani', 'RW'),
	('vil1011-falque', 'RW'),       -- Iago Falqué
	('vil1011-cicinho', 'RB'),
	('vil1011-oriol', 'LB'),        -- Joan Oriol
	-- A. migration 20260513010000_theme_cleanup_and_balance (lost on fresh DB)
	('bar1415-roberto', 'RB'),      -- Sergi Roberto
	('bar1415-alba', 'LB'),         -- Jordi Alba
	('bar1415-pedro', 'LW'),
	('bar1415-traore', 'LW'),       -- Adama Traoré
	('vil0506-kromkamp', 'RB'),
	('vil0708-venta', 'RB'),
	('vil0708-josemi', 'RB'),
	('vil1011-nilmar', 'LW'),
	('vil1011-ruben', 'RW'),        -- kept as in the migration (dubious: Marco Ruben is a centre-forward)
	-- B. Barça / Madrid / Villarreal historic
	('bar1415-adriano', 'LB'),      -- left-back (the migration had RB; Alba/Grimaldo/Adriano now cover LB)
	('bar1415-alves', 'RB'),        -- Dani Alves was mapped CB
	('bar1415-douglas', 'RB'),      -- right-back
	('bar1415-diagne', 'CM'),       -- defensive midfielder
	('bar1415-neymar', 'LW'),       -- MSN left wing
	('bar1415-grimaldo', 'LB'),     -- Álex Grimaldo is a left-back (was LW)
	('bar1011-mascherano', 'CB'),   -- listed DF in the squad table
	('rm0203-figo', 'RW'),          -- Luís Figo, right winger
	('rm0203-solari', 'LW'),        -- Santiago Solari, left-sided winger
	('rm0203-mcmanaman', 'RW'),     -- Steve McManaman, winger
	('madrid1516-arbeloa', 'RB'),
	('madrid1718-hernandez', 'LB'), -- Théo Hernandez
	('madrid1718-quezada', 'LB'),   -- left-back / left winger
	('rm1617-coentrao', 'LB'),      -- Fábio Coentrão (rm1314 row already LB)
	('vil0506-alcantara', 'LB'),
	('vil0506-valencia', 'RW'),     -- Luis Antonio Valencia, right winger
	('vil0506-calleja', 'LW'),      -- Javier Calleja, left midfielder
	('vil0708-bella', 'LB'),        -- Alberto de la Bella
	('vil0708-cygan', 'CB'),        -- Pascal Cygan: favoured position central defender (was LB)
	('vil1011-lopez', 'RB'),        -- Ángel López, attacking right-back
	-- B. UCL historic
	('chelsea1112-bertrand', 'LB'),
	('chelsea1112-bosingwa', 'RB'),
	('chelsea1112-chalobah', 'CM'),
	('chelsea1112-clifford', 'CM'),
	('chelsea1112-deenconteh', 'LB'),
	('chelsea1112-ferreira', 'RB'),
	('chelsea1112-ivanovic', 'RB'),
	('chelsea1112-kane', 'RB'),
	('chelsea1112-malouda', 'LW'),
	('chelsea1112-kalou', 'RW'),
	('inter0910-quaresma', 'RW'),
	('inter0910-stevanovic', 'RW'),
	('inter0910-santon', 'LB'),
	('inter0910-chivu', 'LB'),      -- Mourinho's left-back
	('bayern1920-dajaku', 'RW'),
	('bayern1920-meier', 'RW'),
	('bayern1920-perisic', 'LW'),
	-- B. 2025-26 squads
	('ath-sanchez', 'CM'),          -- Ibon Sánchez: attacking midfielder
	('atm-galan', 'LB'),            -- Javi Galán
	('atm-gonzalez', 'LW'),         -- Nicolás González (Argentine winger)
	('atm-simeone', 'RW'),          -- Giuliano Simeone: right midfielder/winger
	('bar-cancelo', 'RB'),
	('bar-kounde', 'RB'),
	('bar-martin', 'LB'),           -- Gerard Martín
	('rm-junior', 'LW'),            -- Vinícius Júnior
	('rm-rodrygo', 'RW'),
	('mancity2526-doku', 'LW'),
	('mancity2526-savinho', 'RW'),
	('mancity2526-semenyo', 'RW'),
	('mancity2526-lewis', 'RB'),    -- Rico Lewis
	('mancity2526-aitnouri', 'LB'), -- Rayan Aït-Nouri
	('mancity2526-kabore', 'RB'),
	('arsenal2526-white', 'RB'),
	('psg2526-barcola', 'LW'),
	('bayern2526-jackson', 'ST'),
	('inter2526-dumfries', 'RB'),
	('inter2526-darmian', 'RB'),
	('inter2526-henrique', 'RW'),   -- Luis Henrique
	('napoli2526-mazzocchi', 'RB'),
	('napoli2526-spinazzola', 'LB'),
	('napoli2526-gutierrez', 'LB'), -- Miguel Gutiérrez
	('napoli2526-hasa', 'CM')       -- Luis Hasa, attacking midfielder
) as v(seed_id, pos)
where p.metadata ->> 'dev_seed_id' = v.seed_id
	and p.primary_position is distinct from v.pos::position_code;

-- ----------------------------------------------------------------------------
-- C. Names
-- ----------------------------------------------------------------------------
update public.players p
set name = v.new_name
from (values
	('rm1617-fernandez', 'Enzo Zidane'),         -- was "Enzo Fernández" (Chelsea/Argentina midfielder): wrong person
	('bar0809-xavi', 'Xavi'),                    -- one spelling per person: start_room de-duplicates by name
	('bar0809-alves', 'Dani Alves'),
	('bar0809-bojan', 'Bojan'),
	('bar0809-jeffren', 'Jeffrén'),
	('bar0809-pedro', 'Pedro'),
	('rm1314-fernandez', 'Nacho'),               -- "Nacho Fernandez" in 13-14, "Nacho" elsewhere
	('liverpool2526-robertson', 'Andrew Robertson'), -- "Andy Robertson" in 25-26, "Andrew" in 18-19
	('atm-gonzalez', 'Nicolás González')         -- Atlético's "Nico González" is the Argentine winger (Juventus loan), not Man City's Spanish midfielder of the same name
) as v(seed_id, new_name)
where p.metadata ->> 'dev_seed_id' = v.seed_id
	and p.name is distinct from v.new_name;

-- Two different Rafinhas (Bayern's right-back and Barça's midfielder) share a
-- name, so start_room's de-dup by (lower(name), birth_year) would drop one of
-- them in "ucl-historic" / "ucl-all". A birth year keeps them apart.
update public.players set birth_year = 1985 where metadata ->> 'dev_seed_id' = 'bayern1213-rafinha' and birth_year is distinct from 1985;
update public.players set birth_year = 1993 where metadata ->> 'dev_seed_id' = 'bar1415-rafinha' and birth_year is distinct from 1993;

-- ----------------------------------------------------------------------------
-- D. Players that do not belong in the squad.
--    Their tag links are removed (they stop appearing in every theme). The
--    player row is deleted only when no auction references it (FK restrict).
-- ----------------------------------------------------------------------------
create temporary table _fix_remove (seed_id text primary key) on commit drop;
insert into _fix_remove (seed_id) values
	-- reserve / B-team / youth-team players pulled in by the squad scraper
	('atm-cubo'), ('atm-diaz'), ('atm-luque'), ('atm-martinez'), ('atm-morcillo'), ('atm-seidu'), -- Atlético Madrileño
	('bar-pacifico'),                                                                             -- Barcelona B
	('bayern2526-bartl'), ('bayern2526-manuba'), ('bayern2526-rovere'), ('bayern2526-prescott'), -- Bayern II / U19
	('inter2526-kamate'), ('inter2526-spinacce'),                                                 -- Inter U23
	('mancity2526-brits'),                                                                        -- City youth team
	('vil0708-rocha'),                                                                            -- same as migration 20260513050000
	('madrid1516-tejero'), ('rm1617-tejero'), ('madrid1718-tejero'),                              -- ditto (Álvaro Tejero)
	('chelsea1112-supbsup');                                                                      -- junk row "James Ashton <sup>B</sup>"

delete from public.player_tags
where player_id in (
	select p.id from public.players p join _fix_remove r on p.metadata ->> 'dev_seed_id' = r.seed_id
);

delete from public.players p
using _fix_remove r
where p.metadata ->> 'dev_seed_id' = r.seed_id
	and not exists (select 1 from public.auctions a where a.player_id = p.id);

-- ----------------------------------------------------------------------------
-- E. Themes
-- ----------------------------------------------------------------------------
-- Too thin to host a multi-player room (same decision as migration
-- 20260513010000, lost on fresh DB because the themes did not exist yet).
update public.themes set is_published = false where slug in ('barca-2008-09', 'madrid-2002-03');

-- madrid-historic: add the two UCL-winning seasons (same migration).
update public.themes
set filter_config = jsonb_set(
	filter_config,
	'{include_tags}',
	'["madrid-2002-03","madrid-2013-14","madrid-2015-16","madrid-2016-17","madrid-2017-18"]'::jsonb
)
where slug = 'madrid-historic';

-- ----------------------------------------------------------------------------
-- F. Dev players (02_dev_players.sql) had no metadata.team; every non-scrub
--    player must carry one so the UI can always show a club/country.
-- ----------------------------------------------------------------------------
update public.players
set metadata = metadata || jsonb_build_object('team', 'Demo')
where not is_scrub
	and metadata ->> 'dev_seed_id' like 'demo-%'
	and coalesce(metadata ->> 'team', '') = '';
