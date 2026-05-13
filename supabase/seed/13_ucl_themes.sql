-- ============================================================================
-- Composite UCL themes — mix per-club season tags to assemble Champions League
-- auction pools. The auction RPC treats include_tags as a UNION (a player
-- matches if they hold ANY listed tag) so a single room draws from all eras.
-- ============================================================================

insert into public.themes (slug, display_name, description, filter_config, is_published)
values (
	'ucl-25-26',
	'UCL 2025-26 (Champions League)',
	'Top 10 favorits del torneig 25-26: Madrid + Barça + Atlético + City + Arsenal + Liverpool + PSG + Bayern + Inter + Napoli (i alguns extres de LaLiga).',
	'{"include_tags": ["laliga-25-26","mancity-25-26","arsenal-25-26","liverpool-25-26","psg-25-26","bayern-25-26","inter-25-26","napoli-25-26"], "exclude_tags": []}'::jsonb,
	true
)
on conflict (slug) do update set
	display_name = excluded.display_name,
	description = excluded.description,
	filter_config = excluded.filter_config,
	is_published = excluded.is_published;

insert into public.themes (slug, display_name, description, filter_config, is_published)
values (
	'ucl-historic',
	'UCL històric (2010s)',
	'Guanyadors de la Champions dels 2010: Inter 09-10, Barça 10-11, Chelsea 11-12, Bayern 12-13, Madrid 13-14/15-16/16-17/17-18, Barça 14-15, Liverpool 18-19, Bayern 19-20.',
	'{"include_tags": ["barca-2008-09","barca-2010-11","barca-2014-15","madrid-2013-14","madrid-2016-17","inter-2009-10","chelsea-2011-12","bayern-2012-13","madrid-2015-16","madrid-2017-18","liverpool-2018-19","bayern-2019-20"], "exclude_tags": []}'::jsonb,
	true
)
on conflict (slug) do update set
	display_name = excluded.display_name,
	description = excluded.description,
	filter_config = excluded.filter_config,
	is_published = excluded.is_published;

insert into public.themes (slug, display_name, description, filter_config, is_published)
values (
	'ucl-all',
	'UCL — totes les eres',
	'Tot el contingut UCL: favorits 25-26 + guanyadors històrics dels 2010 + eres dels grans clubs LaLiga.',
	'{"include_tags": ["laliga-25-26","mancity-25-26","arsenal-25-26","liverpool-25-26","psg-25-26","bayern-25-26","inter-25-26","napoli-25-26","barca-2008-09","barca-2010-11","barca-2014-15","madrid-2013-14","madrid-2016-17","inter-2009-10","chelsea-2011-12","bayern-2012-13","madrid-2015-16","madrid-2017-18","liverpool-2018-19","bayern-2019-20"], "exclude_tags": []}'::jsonb,
	true
)
on conflict (slug) do update set
	display_name = excluded.display_name,
	description = excluded.description,
	filter_config = excluded.filter_config,
	is_published = excluded.is_published;

