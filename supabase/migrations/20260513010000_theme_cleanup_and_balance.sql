-- Theme cleanup + position balance pass.
--
-- 1. Delete underpowered single-season themes that don't have enough players
--    per position to support multi-player rooms with default 4-3-3 + extras=1.
--    Target per theme: 6 GK / 6 RB / 6 LB / 12 CB / 18 CM / 6 RW / 6 LW / 6 ST.
--    Player rows + their tags stay (they remain reachable via composite themes).
--
-- 2. Expand `madrid-historic` to also include `madrid-2015-16` and
--    `madrid-2017-18` (UCL winning seasons that were only reachable via
--    `ucl-historic` before).
--
-- 3. Reclassify a handful of barca-historic and villarreal-historic players
--    so each composite theme reaches the per-position threshold.

-- 1) Hide underpowered single-season themes (don't DELETE — existing rooms
--    referencing them via theme_id would break the FK).
update public.themes set is_published = false where slug = 'barca-2008-09';
update public.themes set is_published = false where slug = 'madrid-2002-03';

-- 2) Expand madrid-historic include_tags.
update public.themes
set filter_config = jsonb_set(
	filter_config,
	'{include_tags}',
	'["madrid-2002-03","madrid-2013-14","madrid-2015-16","madrid-2016-17","madrid-2017-18"]'::jsonb
)
where slug = 'madrid-historic';

-- 3a) Barça historic position fixes.
--     Need +2 RB, +1 LB, +2 LW.
update public.players set primary_position = 'RB'
where metadata->>'dev_seed_id' = 'bar1415-roberto';   -- Sergi Roberto (versatile, played RB often)

update public.players set primary_position = 'RB'
where metadata->>'dev_seed_id' = 'bar1415-adriano';   -- Adriano (RB more than LB at Barça)

update public.players set primary_position = 'LB'
where metadata->>'dev_seed_id' = 'bar1415-alba';      -- Jordi Alba (clearly LB)

update public.players set primary_position = 'LW'
where metadata->>'dev_seed_id' = 'bar1415-pedro';     -- Pedro Rodríguez (played both wings in MSN era)

update public.players set primary_position = 'LW'
where metadata->>'dev_seed_id' = 'bar1415-traore';    -- Adama Traoré (versatile young winger)

-- 3b) Villarreal historic position fixes.
--     Need +2 RB, +1 RW, +1 LW (after the 14-row fix from the previous migration).
update public.players set primary_position = 'RB'
where metadata->>'dev_seed_id' = 'vil0506-kromkamp';  -- Jan Kromkamp (Dutch RB)

update public.players set primary_position = 'RB'
where metadata->>'dev_seed_id' = 'vil0708-venta';     -- Javi Venta 07-08

update public.players set primary_position = 'RB'
where metadata->>'dev_seed_id' = 'vil0708-josemi';    -- Josemi 07-08 (ex-Liverpool RB)

update public.players set primary_position = 'LW'
where metadata->>'dev_seed_id' = 'vil1011-nilmar';    -- Nilmar (wide forward)

update public.players set primary_position = 'RW'
where metadata->>'dev_seed_id' = 'vil1011-ruben';     -- Marco Ruben (Argentine winger-forward)
