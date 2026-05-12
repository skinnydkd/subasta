-- ============================================================================
-- Composite historic themes — mix multiple season tags so a single room can
-- draw players from several eras (and clubs) at once.
-- Themes table uses filter_config.include_tags as a UNION; a player matches
-- if they hold ANY of the listed tags (see initial_schema.sql:90).
-- ============================================================================

insert into public.themes (slug, display_name, description, filter_config, is_published)
values (
	'barca-historic',
	'Barça històric',
	'Múltiples eres del Barça: Pep 2008-09, Multiplete 2010-11, MSN 2014-15.',
	'{"include_tags": ["barca-2008-09","barca-2010-11","barca-2014-15"], "exclude_tags": []}'::jsonb,
	true
)
on conflict (slug) do update set
	display_name = excluded.display_name,
	description = excluded.description,
	filter_config = excluded.filter_config,
	is_published = excluded.is_published;

insert into public.themes (slug, display_name, description, filter_config, is_published)
values (
	'madrid-historic',
	'Madrid històric',
	'Múltiples eres del Madrid: Galàctics 2002-03, la Dècima 2013-14, BBC 2016-17.',
	'{"include_tags": ["madrid-2002-03","madrid-2013-14","madrid-2016-17"], "exclude_tags": []}'::jsonb,
	true
)
on conflict (slug) do update set
	display_name = excluded.display_name,
	description = excluded.description,
	filter_config = excluded.filter_config,
	is_published = excluded.is_published;

insert into public.themes (slug, display_name, description, filter_config, is_published)
values (
	'villarreal-historic',
	'Villarreal històric',
	'Submarino Amarillo: semis UCL 2005-06, 2n LaLiga 2007-08, semis UEL 2010-11.',
	'{"include_tags": ["villarreal-2005-06","villarreal-2007-08","villarreal-2010-11"], "exclude_tags": []}'::jsonb,
	true
)
on conflict (slug) do update set
	display_name = excluded.display_name,
	description = excluded.description,
	filter_config = excluded.filter_config,
	is_published = excluded.is_published;

insert into public.themes (slug, display_name, description, filter_config, is_published)
values (
	'clasicos-historic',
	'Clàssics històrics (Barça + Madrid)',
	'Llegendes de Barça i Madrid de totes les eres curades.',
	'{"include_tags": ["barca-2008-09","barca-2010-11","barca-2014-15","madrid-2002-03","madrid-2013-14","madrid-2016-17"], "exclude_tags": []}'::jsonb,
	true
)
on conflict (slug) do update set
	display_name = excluded.display_name,
	description = excluded.description,
	filter_config = excluded.filter_config,
	is_published = excluded.is_published;

insert into public.themes (slug, display_name, description, filter_config, is_published)
values (
	'laliga-historicos',
	'LaLiga històric (Barça + Madrid + Villarreal)',
	'Totes les eres històriques curades dels tres clubs.',
	'{"include_tags": ["barca-2008-09","barca-2010-11","barca-2014-15","madrid-2002-03","madrid-2013-14","madrid-2016-17","villarreal-2005-06","villarreal-2007-08","villarreal-2010-11"], "exclude_tags": []}'::jsonb,
	true
)
on conflict (slug) do update set
	display_name = excluded.display_name,
	description = excluded.description,
	filter_config = excluded.filter_config,
	is_published = excluded.is_published;

