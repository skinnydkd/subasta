-- Remove specific known-reserve players from their composite themes.
-- Rocha (Villarreal 2007-08) and Álvaro Tejero (Madrid 15-16 / 16-17 / 17-18)
-- are youth/reserve players that the Wikipedia scrape pulled in but don't
-- belong in playable historic squads. User feedback: "rocha villarreal,
-- tejero madrid per exemple sobren".
--
-- We remove their player_tags (so they stop appearing in any theme). The
-- player rows stay (may be referenced by completed auctions / teams in
-- existing finished rooms).

delete from public.player_tags
where player_id in (
	select id from public.players
	where name in ('Rocha', 'Álvaro Tejero')
);
