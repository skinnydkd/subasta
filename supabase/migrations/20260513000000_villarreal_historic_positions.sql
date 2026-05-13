-- Reclassify Villarreal historic wide players to fix LW/RW/RB/LB shortages.
--
-- Pellegrini's Villarreal played 4-4-2 with wide midfielders rather than
-- classic wingers. The Wikipedia-driven scraper mapped them to CM because
-- their summaries describe them as "midfielders". Same for Argentine
-- fullbacks tagged CB. With multi-player rooms (4-3-3 needs LW/RW/RB/LB),
-- the auction couldn't fill those positions.
--
-- This migration fixes the position of 15 specific player rows so that
-- Villarreal històric supports 3-5 player rooms.

update public.players set primary_position = 'LB'
where metadata->>'dev_seed_id' = 'vil0506-sorin';        -- Juan Pablo Sorín

update public.players set primary_position = 'LB'
where metadata->>'dev_seed_id' = 'vil0506-arruabarrena'; -- Rodolfo Arruabarrena

update public.players set primary_position = 'RB'
where metadata->>'dev_seed_id' = 'vil0506-venta';        -- Javi Venta

update public.players set primary_position = 'RB'
where metadata->>'dev_seed_id' = 'vil0506-josemi';       -- Josemi

update public.players set primary_position = 'LW'
where metadata->>'dev_seed_id' = 'vil0506-roger';        -- Roger García

update public.players set primary_position = 'RW'
where metadata->>'dev_seed_id' = 'vil0506-cazorla';      -- Santi Cazorla (was wide MF as a youngster)

update public.players set primary_position = 'LW'
where metadata->>'dev_seed_id' = 'vil0506-guayre';       -- Antonio Guayre

update public.players set primary_position = 'LW'
where metadata->>'dev_seed_id' = 'vil0506-fuster';       -- David Fuster

update public.players set primary_position = 'RW'
where metadata->>'dev_seed_id' = 'vil0708-cani';         -- Cani 07-08

update public.players set primary_position = 'LW'
where metadata->>'dev_seed_id' = 'vil0708-fernandez';    -- Matías Fernández

update public.players set primary_position = 'RW'
where metadata->>'dev_seed_id' = 'vil1011-cani';         -- Cani 10-11

update public.players set primary_position = 'RW'
where metadata->>'dev_seed_id' = 'vil1011-falque';       -- Iago Falqué

update public.players set primary_position = 'RB'
where metadata->>'dev_seed_id' = 'vil1011-cicinho';      -- Cicinho

update public.players set primary_position = 'LB'
where metadata->>'dev_seed_id' = 'vil1011-oriol';        -- Joan Oriol
