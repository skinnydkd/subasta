// Reads scripts/historic-squads-raw.json and writes per-club seed SQL plus a
// composite themes file under supabase/seed/.

import { readFileSync, writeFileSync } from 'node:fs';

const SRC = new URL('./historic-squads-raw.json', import.meta.url);

const CLUBS = {
	bar: {
		label: 'FC Barcelona',
		seasons: ['bar1011', 'bar1415'], // 08-09 stays in 05_real_barca_0809.sql
		file: '07_real_barca_historic.sql',
		clubTagSlug: 'barca-historic',
		clubThemeSlug: 'barca-historic',
		clubThemeName: 'Barça històric',
		clubThemeDesc: 'Múltiples eres del Barça: Pep 2008-09, Multiplete 2010-11, MSN 2014-15.',
		// Tags this composite theme aggregates (incl. existing 08-09 from the hand-curated seed).
		composite: ['barca-2008-09', 'barca-2010-11', 'barca-2014-15']
	},
	rm: {
		label: 'Real Madrid',
		seasons: ['rm1314', 'rm1617'], // 02-03 stays in 06_real_madrid_0203.sql
		file: '08_real_madrid_historic.sql',
		clubTagSlug: 'madrid-historic',
		clubThemeSlug: 'madrid-historic',
		clubThemeName: 'Madrid històric',
		clubThemeDesc: 'Múltiples eres del Madrid: Galàctics 2002-03, la Dècima 2013-14, BBC 2016-17.',
		composite: ['madrid-2002-03', 'madrid-2013-14', 'madrid-2016-17']
	},
	vil: {
		label: 'Villarreal',
		seasons: ['vil0506', 'vil0708', 'vil1011'],
		file: '09_real_villarreal_historic.sql',
		clubTagSlug: 'villarreal-historic',
		clubThemeSlug: 'villarreal-historic',
		clubThemeName: 'Villarreal històric',
		clubThemeDesc: 'Submarino Amarillo: semis UCL 2005-06, 2n LaLiga 2007-08, semis UEL 2010-11.',
		composite: ['villarreal-2005-06', 'villarreal-2007-08', 'villarreal-2010-11']
	}
};

const SEASON_META = {
	bar1011: { tagSlug: 'barca-2010-11', tagLabel: 'FC Barcelona 2010-11', team: 'FC Barcelona 2010-11' },
	bar1415: { tagSlug: 'barca-2014-15', tagLabel: 'FC Barcelona 2014-15', team: 'FC Barcelona 2014-15' },
	rm1314:  { tagSlug: 'madrid-2013-14', tagLabel: 'Real Madrid 2013-14', team: 'Real Madrid 2013-14' },
	rm1617:  { tagSlug: 'madrid-2016-17', tagLabel: 'Real Madrid 2016-17', team: 'Real Madrid 2016-17' },
	vil0506: { tagSlug: 'villarreal-2005-06', tagLabel: 'Villarreal CF 2005-06', team: 'Villarreal CF 2005-06' },
	vil0708: { tagSlug: 'villarreal-2007-08', tagLabel: 'Villarreal CF 2007-08', team: 'Villarreal CF 2007-08' },
	vil1011: { tagSlug: 'villarreal-2010-11', tagLabel: 'Villarreal CF 2010-11', team: 'Villarreal CF 2010-11' }
};

// Default market values (millions €) by position — historic floor.
const DEFAULT_VALUE = {
	GK: 5,
	RB: 8,
	LB: 8,
	CB: 10,
	CM: 12,
	RW: 15,
	LW: 15,
	ST: 15
};

// Headline market values per (player name, season). Anyone not listed uses
// the per-position default. Edit by hand and rerun to refine.
// Key format: "<player name> | <season seasonKey>"
const VALUE_OVERRIDES = {
	// Barça 2010-11 (Multiplete year)
	'Lionel Messi | bar1011': 80,
	'Xavi | bar1011': 35,
	'Andrés Iniesta | bar1011': 50,
	'Sergio Busquets | bar1011': 20,
	'Carles Puyol | bar1011': 20,
	'Gerard Piqué | bar1011': 35,
	'Dani Alves | bar1011': 30,
	'Eric Abidal | bar1011': 15,
	'Víctor Valdés | bar1011': 18,
	'David Villa | bar1011': 30,
	'Pedro | bar1011': 25,
	'Bojan | bar1011': 12,
	'Javier Mascherano | bar1011': 25,
	'Maxwell | bar1011': 8,
	'Seydou Keita | bar1011': 12,
	'Ibrahim Afellay | bar1011': 10,
	// Barça 2014-15 (MSN treble)
	'Lionel Messi | bar1415': 120,
	'Neymar | bar1415': 70,
	'Luis Suárez | bar1415': 60,
	'Andrés Iniesta | bar1415': 35,
	'Xavi | bar1415': 18,
	'Sergio Busquets | bar1415': 25,
	'Gerard Piqué | bar1415': 30,
	'Jordi Alba | bar1415': 30,
	'Dani Alves | bar1415': 22,
	'Javier Mascherano | bar1415': 25,
	'Marc-André ter Stegen | bar1415': 18,
	'Claudio Bravo | bar1415': 12,
	'Ivan Rakitić | bar1415': 25,
	'Pedro | bar1415': 25,
	'Jérémy Mathieu | bar1415': 10,
	'Rafinha | bar1415': 8,
	// Madrid 2013-14 (la Décima)
	'Cristiano Ronaldo | rm1314': 100,
	'Gareth Bale | rm1314': 90,
	'Karim Benzema | rm1314': 35,
	'Ángel Di María | rm1314': 35,
	'Luka Modrić | rm1314': 35,
	'Xabi Alonso | rm1314': 25,
	'Sami Khedira | rm1314': 18,
	'Casemiro | rm1314': 8,
	'Isco | rm1314': 30,
	'Sergio Ramos | rm1314': 35,
	'Raphaël Varane | rm1314': 25,
	'Pepe | rm1314': 18,
	'Marcelo | rm1314': 20,
	'Fábio Coentrão | rm1314': 18,
	'Iker Casillas | rm1314': 20,
	'Diego López | rm1314': 12,
	'Dani Carvajal | rm1314': 15,
	'Álvaro Morata | rm1314': 15,
	'Asier Illarramendi | rm1314': 18,
	// Madrid 2016-17 (UCL three-peat year)
	'Cristiano Ronaldo | rm1617': 120,
	'Karim Benzema | rm1617': 45,
	'Gareth Bale | rm1617': 80,
	'Toni Kroos | rm1617': 60,
	'Luka Modrić | rm1617': 50,
	'Casemiro | rm1617': 30,
	'Isco | rm1617': 40,
	'James Rodríguez | rm1617': 50,
	'Mateo Kovačić | rm1617': 22,
	'Sergio Ramos | rm1617': 40,
	'Raphaël Varane | rm1617': 35,
	'Pepe | rm1617': 12,
	'Nacho | rm1617': 18,
	'Marcelo | rm1617': 30,
	'Keylor Navas | rm1617': 20,
	'Dani Carvajal | rm1617': 25,
	'Marco Asensio | rm1617': 30,
	'Lucas Vázquez | rm1617': 14,
	'Álvaro Morata | rm1617': 35,
	// Villarreal 2005-06 (UCL semis)
	'Juan Román Riquelme | vil0506': 30,
	'Diego Forlán | vil0506': 25,
	'Marcos Senna | vil0506': 12,
	'Guillermo Franco | vil0506': 10,
	'Juan Pablo Sorín | vil0506': 8,
	'Gonzalo Rodríguez | vil0506': 8,
	'Alessio Tacchinardi | vil0506': 6,
	'Santi Cazorla | vil0506': 6,
	'Javier López Vallejo | vil0506': 5,
	// Villarreal 2007-08 (2nd LaLiga)
	'Santi Cazorla | vil0708': 20,
	'Marcos Senna | vil0708': 15,
	'Juan Román Riquelme | vil0708': 18,
	'Giuseppe Rossi | vil0708': 12,
	'Robert Pirès | vil0708': 8,
	'Robert Pires | vil0708': 8,
	'Diego Godín | vil0708': 12,
	'Joan Capdevila | vil0708': 12,
	'Nihat Kahveci | vil0708': 14,
	'Jon Dahl Tomasson | vil0708': 6,
	// Villarreal 2010-11 (4th LaLiga, UEL semis)
	'Santi Cazorla | vil1011': 22,
	'Marcos Senna | vil1011': 8,
	'Giuseppe Rossi | vil1011': 25,
	'Borja Valero | vil1011': 12,
	'Bruno Soriano | vil1011': 8,
	'Joan Capdevila | vil1011': 8,
	'Mateo Musacchio | vil1011': 10,
	'Carlos Marchena | vil1011': 8,
	'Nilmar | vil1011': 18,
	'Marco Ruben | vil1011': 10,
	'Diego López | vil1011': 8,
	'Cani | vil1011': 8
};

function slug(name) {
	const ascii = name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9 -]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	const parts = ascii.split(' ');
	const last = parts[parts.length - 1];
	return (last.replace(/[^a-z0-9]/g, '') || 'player').slice(0, 12);
}

function buildSeedIds(seasonKey, players) {
	const used = new Set();
	const out = new Map();
	for (const p of players) {
		let base = slug(p.name);
		let candidate = base;
		let suffix = 1;
		while (used.has(candidate)) { suffix++; candidate = `${base}${suffix}`; }
		used.add(candidate);
		out.set(p.name, `${seasonKey}-${candidate}`);
	}
	return out;
}

function sqlString(s) { return s.replace(/'/g, "''"); }

const data = JSON.parse(readFileSync(SRC, 'utf8'));

const totals = { all: 0, perClub: {} };

for (const [clubKey, club] of Object.entries(CLUBS)) {
	totals.perClub[clubKey] = 0;
	const lines = [];
	lines.push(`-- ============================================================================`);
	lines.push(`-- Real seed: ${club.label} històric (multi-temporada).`);
	lines.push(`-- Auto-generated by scripts/build-historic-seeds.mjs from`);
	lines.push(`-- scripts/historic-squads-raw.json (sourced from Wikipedia).`);
	lines.push(`-- Generated: ${new Date().toISOString()}`);
	lines.push(`--`);
	lines.push(`-- Each season is a separate tag. The composite "${club.clubThemeSlug}"`);
	lines.push(`-- theme (in 10_historic_themes.sql) aggregates them so a single room`);
	lines.push(`-- can draw from any of these eras at once.`);
	lines.push(`-- ============================================================================`);
	lines.push(``);

	// One tag per season
	for (const seasonKey of club.seasons) {
		const meta = SEASON_META[seasonKey];
		lines.push(`insert into public.tags (slug, display_name, category)`);
		lines.push(`values ('${meta.tagSlug}', '${sqlString(meta.tagLabel)}', 'club_season')`);
		lines.push(`on conflict (slug) do nothing;`);
		lines.push(``);
	}

	// One player block per season — each with its own dev_seed_id prefix.
	for (const seasonKey of club.seasons) {
		const block = data[seasonKey];
		if (!block || block.error) continue;
		const meta = SEASON_META[seasonKey];
		const players = block.squad.filter((p) => p.mapped);
		if (players.length === 0) continue;
		totals.perClub[clubKey] += players.length;
		totals.all += players.length;

		const ids = buildSeedIds(seasonKey, players);

		lines.push(`-- ${meta.tagLabel} (${players.length} jugadors)`);
		lines.push(`insert into public.players (name, primary_position, market_value_cents, is_scrub, metadata)`);
		lines.push(`select v.name, v.pos::position_code, (v.value_m::bigint) * 100000000, false,`);
		lines.push(`\tjsonb_build_object('dev_seed_id', v.seed_id, 'team', v.team)`);
		lines.push(`from (values`);

		const rows = [];
		for (const p of players) {
			const pos = p.mapped;
			const overrideKey = `${p.name} | ${seasonKey}`;
			const value = VALUE_OVERRIDES[overrideKey] ?? DEFAULT_VALUE[pos] ?? 10;
			const seedId = ids.get(p.name);
			rows.push(`\t('${sqlString(seedId)}', '${sqlString(p.name)}', '${pos}', '${sqlString(meta.team)}', ${value})`);
		}
		lines.push(rows.join(',\n'));

		lines.push(`) as v(seed_id, name, pos, team, value_m)`);
		lines.push(`where not exists (`);
		lines.push(`\tselect 1 from public.players where metadata ->> 'dev_seed_id' = v.seed_id`);
		lines.push(`);`);
		lines.push(``);

		lines.push(`insert into public.player_tags (player_id, tag_id)`);
		lines.push(`select p.id, t.id`);
		lines.push(`from public.players p`);
		lines.push(`cross join public.tags t`);
		lines.push(`where t.slug = '${meta.tagSlug}'`);
		lines.push(`\tand p.metadata ->> 'dev_seed_id' like '${seasonKey}-%'`);
		lines.push(`on conflict do nothing;`);
		lines.push(``);
	}

	const dest = new URL(`../supabase/seed/${club.file}`, import.meta.url);
	writeFileSync(dest, lines.join('\n') + '\n');
	console.log(`Wrote ${dest.pathname} — ${totals.perClub[clubKey]} players`);
}

// ----- Composite themes file --------------------------------------------------

const themeLines = [];
themeLines.push(`-- ============================================================================`);
themeLines.push(`-- Composite historic themes — mix multiple season tags so a single room can`);
themeLines.push(`-- draw players from several eras (and clubs) at once.`);
themeLines.push(`-- Themes table uses filter_config.include_tags as a UNION; a player matches`);
themeLines.push(`-- if they hold ANY of the listed tags (see initial_schema.sql:90).`);
themeLines.push(`-- ============================================================================`);
themeLines.push(``);

// Per-club historic themes
for (const [, club] of Object.entries(CLUBS)) {
	const tagsJson = JSON.stringify(club.composite);
	themeLines.push(`insert into public.themes (slug, display_name, description, filter_config, is_published)`);
	themeLines.push(`values (`);
	themeLines.push(`\t'${club.clubThemeSlug}',`);
	themeLines.push(`\t'${sqlString(club.clubThemeName)}',`);
	themeLines.push(`\t'${sqlString(club.clubThemeDesc)}',`);
	themeLines.push(`\t'{"include_tags": ${tagsJson}, "exclude_tags": []}'::jsonb,`);
	themeLines.push(`\ttrue`);
	themeLines.push(`)`);
	themeLines.push(`on conflict (slug) do update set`);
	themeLines.push(`\tdisplay_name = excluded.display_name,`);
	themeLines.push(`\tdescription = excluded.description,`);
	themeLines.push(`\tfilter_config = excluded.filter_config,`);
	themeLines.push(`\tis_published = excluded.is_published;`);
	themeLines.push(``);
}

// Mixed themes
const clasicosTags = [...CLUBS.bar.composite, ...CLUBS.rm.composite];
const allHistoricTags = [...clasicosTags, ...CLUBS.vil.composite];

const MIXED = [
	{
		slug: 'clasicos-historic',
		name: 'Clàssics històrics (Barça + Madrid)',
		desc: 'Llegendes de Barça i Madrid de totes les eres curades.',
		tags: clasicosTags
	},
	{
		slug: 'laliga-historicos',
		name: 'LaLiga històric (Barça + Madrid + Villarreal)',
		desc: 'Totes les eres històriques curades dels tres clubs.',
		tags: allHistoricTags
	}
];

for (const m of MIXED) {
	const tagsJson = JSON.stringify(m.tags);
	themeLines.push(`insert into public.themes (slug, display_name, description, filter_config, is_published)`);
	themeLines.push(`values (`);
	themeLines.push(`\t'${m.slug}',`);
	themeLines.push(`\t'${sqlString(m.name)}',`);
	themeLines.push(`\t'${sqlString(m.desc)}',`);
	themeLines.push(`\t'{"include_tags": ${tagsJson}, "exclude_tags": []}'::jsonb,`);
	themeLines.push(`\ttrue`);
	themeLines.push(`)`);
	themeLines.push(`on conflict (slug) do update set`);
	themeLines.push(`\tdisplay_name = excluded.display_name,`);
	themeLines.push(`\tdescription = excluded.description,`);
	themeLines.push(`\tfilter_config = excluded.filter_config,`);
	themeLines.push(`\tis_published = excluded.is_published;`);
	themeLines.push(``);
}

const themeDest = new URL('../supabase/seed/10_historic_themes.sql', import.meta.url);
writeFileSync(themeDest, themeLines.join('\n') + '\n');
console.log(`Wrote ${themeDest.pathname} — ${Object.keys(CLUBS).length + MIXED.length} themes`);

console.log(`\nTotal historic players: ${totals.all}`);
for (const [k, n] of Object.entries(totals.perClub)) {
	console.log(`  ${CLUBS[k].label.padEnd(16)} ${n}`);
}
