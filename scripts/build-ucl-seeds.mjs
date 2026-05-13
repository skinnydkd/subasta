// Reads scripts/ucl-squads-raw.json (12 scraped seasons) and adds 2 inline
// hand-curated squads (Bayern 12-13, Liverpool 18-19), then writes UCL seed
// files + composite themes.

import { readFileSync, writeFileSync } from 'node:fs';

const SRC = new URL('./ucl-squads-raw.json', import.meta.url);

// Hand-curated squads for the two seasons whose Wikipedia pages lack the
// {{Fs player}} squad table. These are the iconic UCL-winning XIs.
const INLINE_SQUADS = {
	bayern1213: {
		label: 'Bayern Munich 2012-13 (UCL winner)',
		team: 'Bayern Munich 2012-13',
		tagSlug: 'bayern-2012-13',
		era: 'historic',
		squad: [
			{ name: 'Manuel Neuer', mapped: 'GK' },
			{ name: 'Tom Starke', mapped: 'GK' },
			{ name: 'Philipp Lahm', mapped: 'RB' },
			{ name: 'Rafinha', mapped: 'RB' },
			{ name: 'David Alaba', mapped: 'LB' },
			{ name: 'Diego Contento', mapped: 'LB' },
			{ name: 'Jérôme Boateng', mapped: 'CB' },
			{ name: 'Dante', mapped: 'CB' },
			{ name: 'Holger Badstuber', mapped: 'CB' },
			{ name: 'Daniel Van Buyten', mapped: 'CB' },
			{ name: 'Bastian Schweinsteiger', mapped: 'CM' },
			{ name: 'Javi Martínez', mapped: 'CM' },
			{ name: 'Toni Kroos', mapped: 'CM' },
			{ name: 'Luiz Gustavo', mapped: 'CM' },
			{ name: 'Anatoliy Tymoshchuk', mapped: 'CM' },
			{ name: 'Arjen Robben', mapped: 'RW' },
			{ name: 'Xherdan Shaqiri', mapped: 'RW' },
			{ name: 'Franck Ribéry', mapped: 'LW' },
			{ name: 'Thomas Müller', mapped: 'ST' },
			{ name: 'Mario Mandžukić', mapped: 'ST' },
			{ name: 'Mario Gómez', mapped: 'ST' },
			{ name: 'Claudio Pizarro', mapped: 'ST' }
		]
	},
	liverpool1819: {
		label: 'Liverpool 2018-19 (UCL winner)',
		team: 'Liverpool 2018-19',
		tagSlug: 'liverpool-2018-19',
		era: 'historic',
		squad: [
			{ name: 'Alisson', mapped: 'GK' },
			{ name: 'Simon Mignolet', mapped: 'GK' },
			{ name: 'Trent Alexander-Arnold', mapped: 'RB' },
			{ name: 'Andrew Robertson', mapped: 'LB' },
			{ name: 'Alberto Moreno', mapped: 'LB' },
			{ name: 'Virgil van Dijk', mapped: 'CB' },
			{ name: 'Joël Matip', mapped: 'CB' },
			{ name: 'Dejan Lovren', mapped: 'CB' },
			{ name: 'Joe Gomez', mapped: 'CB' },
			{ name: 'Jordan Henderson', mapped: 'CM' },
			{ name: 'Georginio Wijnaldum', mapped: 'CM' },
			{ name: 'Fabinho', mapped: 'CM' },
			{ name: 'James Milner', mapped: 'CM' },
			{ name: 'Naby Keïta', mapped: 'CM' },
			{ name: 'Adam Lallana', mapped: 'CM' },
			{ name: 'Mohamed Salah', mapped: 'RW' },
			{ name: 'Xherdan Shaqiri', mapped: 'RW' },
			{ name: 'Sadio Mané', mapped: 'LW' },
			{ name: 'Roberto Firmino', mapped: 'ST' },
			{ name: 'Divock Origi', mapped: 'ST' },
			{ name: 'Daniel Sturridge', mapped: 'ST' },
			{ name: 'Dominic Solanke', mapped: 'ST' }
		]
	}
};

// Default per-position market value (millions €). Historic seasons get lower
// floors than the current 25-26 squads.
const DEFAULT_VALUE_CURRENT = { GK: 15, RB: 20, LB: 20, CB: 25, CM: 30, RW: 40, LW: 40, ST: 40 };
const DEFAULT_VALUE_HISTORIC = { GK: 8, RB: 10, LB: 10, CB: 12, CM: 15, RW: 18, LW: 18, ST: 18 };

// Headline values per (name, season key). Anyone not listed uses the default.
const VALUE_OVERRIDES = {
	// Man City 2025-26
	'Erling Haaland | mancity2526': 180,
	'Phil Foden | mancity2526': 110,
	'Rodri | mancity2526': 100,
	'Bernardo Silva | mancity2526': 70,
	'Rúben Dias | mancity2526': 70,
	'Joško Gvardiol | mancity2526': 70,
	'John Stones | mancity2526': 40,
	'Tijjani Reijnders | mancity2526': 65,
	'Rayan Cherki | mancity2526': 50,
	'Marc Guéhi | mancity2526': 40,
	'Mateo Kovačić | mancity2526': 30,
	'Savinho | mancity2526': 35,
	'Omar Marmoush | mancity2526': 45,
	'Jérémy Doku | mancity2526': 45,
	'Gianluigi Donnarumma | mancity2526': 35,
	'James Trafford | mancity2526': 18,
	'Manuel Akanji | mancity2526': 30,
	'Nathan Aké | mancity2526': 30,
	'Matheus Nunes | mancity2526': 25,
	'Antoine Semenyo | mancity2526': 40,
	'Rayan Aït-Nouri | mancity2526': 35,
	// Arsenal 2025-26
	'Bukayo Saka | arsenal2526': 110,
	'Martin Ødegaard | arsenal2526': 90,
	'Declan Rice | arsenal2526': 100,
	'William Saliba | arsenal2526': 80,
	'Gabriel Magalhães | arsenal2526': 65,
	'Ben White | arsenal2526': 45,
	'Gabriel Martinelli | arsenal2526': 55,
	'Riccardo Calafiori | arsenal2526': 35,
	'Jurriën Timber | arsenal2526': 40,
	'Martín Zubimendi | arsenal2526': 50,
	'Mikel Merino | arsenal2526': 40,
	'Eberechi Eze | arsenal2526': 60,
	'Viktor Gyökeres | arsenal2526': 70,
	'Kai Havertz | arsenal2526': 50,
	'Noni Madueke | arsenal2526': 35,
	'Leandro Trossard | arsenal2526': 25,
	'Gabriel Jesus | arsenal2526': 35,
	'David Raya | arsenal2526': 30,
	'Piero Hincapié | arsenal2526': 30,
	// Liverpool 2025-26
	'Mohamed Salah | liverpool2526': 75,
	'Virgil van Dijk | liverpool2526': 25,
	'Alisson | liverpool2526': 35,
	'Alexis Mac Allister | liverpool2526': 65,
	'Dominik Szoboszlai | liverpool2526': 55,
	'Ryan Gravenberch | liverpool2526': 45,
	'Florian Wirtz | liverpool2526': 100,
	'Alexander Isak | liverpool2526': 90,
	'Hugo Ekitike | liverpool2526': 50,
	'Cody Gakpo | liverpool2526': 50,
	'Andrew Robertson | liverpool2526': 22,
	'Andy Robertson | liverpool2526': 22,
	'Ibrahima Konaté | liverpool2526': 45,
	'Joe Gomez | liverpool2526': 25,
	'Jeremie Frimpong | liverpool2526': 40,
	'Milos Kerkez | liverpool2526': 35,
	'Curtis Jones | liverpool2526': 30,
	'Federico Chiesa | liverpool2526': 18,
	'Conor Bradley | liverpool2526': 30,
	'Wataru Endo | liverpool2526': 15,
	'Giorgi Mamardashvili | liverpool2526': 25,
	// PSG 2025-26
	'Ousmane Dembélé | psg2526': 90,
	'Khvicha Kvaratskhelia | psg2526': 90,
	'Achraf Hakimi | psg2526': 70,
	'Marquinhos | psg2526': 35,
	'Nuno Mendes | psg2526': 55,
	'Vitinha | psg2526': 90,
	'Fabián Ruiz | psg2526': 45,
	'João Neves | psg2526': 90,
	'Désiré Doué | psg2526': 80,
	'Bradley Barcola | psg2526': 65,
	'Gonçalo Ramos | psg2526': 40,
	'Lucas Hernandez | psg2526': 22,
	'Warren Zaïre-Emery | psg2526': 60,
	'Willian Pacho | psg2526': 50,
	'Lee Kang-in | psg2526': 30,
	'Lucas Chevalier | psg2526': 30,
	'Illia Zabarnyi | psg2526': 45,
	// Bayern Munich 2025-26
	'Harry Kane | bayern2526': 70,
	'Jamal Musiala | bayern2526': 110,
	'Joshua Kimmich | bayern2526': 60,
	'Manuel Neuer | bayern2526': 12,
	'Dayot Upamecano | bayern2526': 55,
	'Alphonso Davies | bayern2526': 60,
	'Kim Min-jae | bayern2526': 40,
	'Leroy Sané | bayern2526': 40,
	'Serge Gnabry | bayern2526': 30,
	'Leon Goretzka | bayern2526': 30,
	'Michael Olise | bayern2526': 60,
	'Konrad Laimer | bayern2526': 25,
	'Jonathan Tah | bayern2526': 40,
	'Luis Díaz | bayern2526': 50,
	'Nicolas Jackson | bayern2526': 35,
	'Hiroki Ito | bayern2526': 25,
	'Aleksandar Pavlović | bayern2526': 30,
	'Josip Stanišić | bayern2526': 18,
	// Inter Milan 2025-26
	'Lautaro Martínez | inter2526': 90,
	'Marcus Thuram | inter2526': 70,
	'Nicolò Barella | inter2526': 80,
	'Hakan Çalhanoğlu | inter2526': 35,
	'Alessandro Bastoni | inter2526': 75,
	'Federico Dimarco | inter2526': 50,
	'Denzel Dumfries | inter2526': 30,
	'Yann Sommer | inter2526': 8,
	'Stefan de Vrij | inter2526': 12,
	'Manuel Akanji | inter2526': 25,
	'Benjamin Pavard | inter2526': 35,
	'Henrikh Mkhitaryan | inter2526': 12,
	'Piotr Zieliński | inter2526': 18,
	'Davide Frattesi | inter2526': 30,
	'Petar Sučić | inter2526': 25,
	'Francesco Acerbi | inter2526': 6,
	// Napoli 2025-26
	'Kevin De Bruyne | napoli2526': 30,
	'Scott McTominay | napoli2526': 50,
	'Romelu Lukaku | napoli2526': 25,
	'Rasmus Højlund | napoli2526': 45,
	'Stanislav Lobotka | napoli2526': 30,
	'André-Frank Zambo Anguissa | napoli2526': 30,
	'Alessandro Buongiorno | napoli2526': 40,
	'Amir Rrahmani | napoli2526': 22,
	'Giovanni Di Lorenzo | napoli2526': 30,
	'Mathías Olivera | napoli2526': 22,
	'Alex Meret | napoli2526': 15,
	'David Neres | napoli2526': 35,
	'Noa Lang | napoli2526': 30,
	'Sam Beukema | napoli2526': 25,
	'Billy Gilmour | napoli2526': 22,
	'Lorenzo Lucca | napoli2526': 25,
	// Inter Milan 2009-10 (Mourinho treble)
	'Diego Milito | inter0910': 25,
	"Samuel Eto'o | inter0910": 35,
	'Wesley Sneijder | inter0910': 30,
	'Esteban Cambiasso | inter0910': 18,
	'Javier Zanetti | inter0910': 15,
	'Maicon | inter0910': 25,
	'Walter Samuel | inter0910': 12,
	'Lúcio | inter0910': 18,
	'Julio Cesar | inter0910': 15,
	'Thiago Motta | inter0910': 15,
	'Mario Balotelli | inter0910': 12,
	'Goran Pandev | inter0910': 8,
	'Marco Materazzi | inter0910': 4,
	'Patrick Vieira | inter0910': 6,
	'Ivan Cordoba | inter0910': 4,
	'Christian Chivu | inter0910': 6,
	// Chelsea 2011-12 (Drogba UCL)
	'Didier Drogba | chelsea1112': 25,
	'Frank Lampard | chelsea1112': 18,
	'Fernando Torres | chelsea1112': 30,
	'Juan Mata | chelsea1112': 35,
	'Petr Čech | chelsea1112': 18,
	'John Terry | chelsea1112': 20,
	'Ashley Cole | chelsea1112': 18,
	'Branislav Ivanović | chelsea1112': 18,
	'David Luiz | chelsea1112': 20,
	'Ramires | chelsea1112': 20,
	'Michael Essien | chelsea1112': 14,
	'Gary Cahill | chelsea1112': 12,
	'Salomon Kalou | chelsea1112': 6,
	'Florent Malouda | chelsea1112': 6,
	'Daniel Sturridge | chelsea1112': 12,
	'Mikel John Obi | chelsea1112': 8,
	// Bayern Munich 2012-13 (Heynckes treble)
	'Manuel Neuer | bayern1213': 25,
	'Bastian Schweinsteiger | bayern1213': 25,
	'Arjen Robben | bayern1213': 25,
	'Franck Ribéry | bayern1213': 28,
	'Thomas Müller | bayern1213': 30,
	'Mario Mandžukić | bayern1213': 18,
	'Philipp Lahm | bayern1213': 22,
	'David Alaba | bayern1213': 25,
	'Toni Kroos | bayern1213': 22,
	'Javi Martínez | bayern1213': 22,
	'Jérôme Boateng | bayern1213': 18,
	'Dante | bayern1213': 14,
	'Mario Gómez | bayern1213': 18,
	'Xherdan Shaqiri | bayern1213': 12,
	// Real Madrid 2015-16 (Cardiff Décima → Undécima)
	'Cristiano Ronaldo | madrid1516': 110,
	'Karim Benzema | madrid1516': 40,
	'Gareth Bale | madrid1516': 80,
	'Toni Kroos | madrid1516': 55,
	'Luka Modrić | madrid1516': 45,
	'James Rodríguez | madrid1516': 60,
	'Casemiro | madrid1516': 25,
	'Sergio Ramos | madrid1516': 35,
	'Raphaël Varane | madrid1516': 30,
	'Pepe | madrid1516': 15,
	'Marcelo | madrid1516': 28,
	'Dani Carvajal | madrid1516': 22,
	'Keylor Navas | madrid1516': 22,
	'Isco | madrid1516': 35,
	'Mateo Kovačić | madrid1516': 25,
	'Lucas Vázquez | madrid1516': 12,
	// Real Madrid 2017-18 (3-peat)
	'Cristiano Ronaldo | madrid1718': 100,
	'Karim Benzema | madrid1718': 45,
	'Toni Kroos | madrid1718': 70,
	'Luka Modrić | madrid1718': 60,
	'Casemiro | madrid1718': 50,
	'Gareth Bale | madrid1718': 70,
	'Marco Asensio | madrid1718': 55,
	'Isco | madrid1718': 60,
	'Sergio Ramos | madrid1718': 38,
	'Raphaël Varane | madrid1718': 50,
	'Marcelo | madrid1718': 35,
	'Dani Carvajal | madrid1718': 32,
	'Keylor Navas | madrid1718': 20,
	'Achraf Hakimi | madrid1718': 18,
	'Lucas Vázquez | madrid1718': 18,
	'Mateo Kovačić | madrid1718': 30,
	'Théo Hernandez | madrid1718': 25,
	// Liverpool 2018-19 (Klopp UCL)
	'Mohamed Salah | liverpool1819': 80,
	'Sadio Mané | liverpool1819': 70,
	'Roberto Firmino | liverpool1819': 60,
	'Virgil van Dijk | liverpool1819': 75,
	'Alisson | liverpool1819': 50,
	'Trent Alexander-Arnold | liverpool1819': 45,
	'Andrew Robertson | liverpool1819': 40,
	'Jordan Henderson | liverpool1819': 25,
	'Georginio Wijnaldum | liverpool1819': 30,
	'Fabinho | liverpool1819': 45,
	'Joël Matip | liverpool1819': 18,
	'Dejan Lovren | liverpool1819': 14,
	'Naby Keïta | liverpool1819': 30,
	'Xherdan Shaqiri | liverpool1819': 14,
	'Divock Origi | liverpool1819': 8,
	'Daniel Sturridge | liverpool1819': 10,
	'James Milner | liverpool1819': 8,
	// Bayern Munich 2019-20 (Lewandowski UCL)
	'Robert Lewandowski | bayern1920': 80,
	'Thomas Müller | bayern1920': 30,
	'Manuel Neuer | bayern1920': 18,
	'Joshua Kimmich | bayern1920': 65,
	'Serge Gnabry | bayern1920': 60,
	'Kingsley Coman | bayern1920': 45,
	'David Alaba | bayern1920': 60,
	'Alphonso Davies | bayern1920': 65,
	'Jérôme Boateng | bayern1920': 15,
	'Niklas Süle | bayern1920': 35,
	'Benjamin Pavard | bayern1920': 35,
	'Leon Goretzka | bayern1920': 45,
	'Thiago | bayern1920': 50,
	'Javi Martínez | bayern1920': 12,
	'Philippe Coutinho | bayern1920': 50,
	'Ivan Perišić | bayern1920': 12,
	'Corentin Tolisso | bayern1920': 20,
	'Álvaro Odriozola | bayern1920': 15
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

function sqlString(s) { return s.replace(/'/g, "''"); }

function buildSeedIds(prefix, players) {
	const used = new Set();
	const out = new Map();
	for (const p of players) {
		let base = slug(p.name);
		let candidate = base;
		let suffix = 1;
		while (used.has(candidate)) { suffix++; candidate = `${base}${suffix}`; }
		used.add(candidate);
		out.set(p.name, `${prefix}-${candidate}`);
	}
	return out;
}

const raw = JSON.parse(readFileSync(SRC, 'utf8'));
// Merge inline hand-curated squads.
const all = { ...raw, ...INLINE_SQUADS };

// File layout: split current vs historic.
const CURRENT_KEYS = ['mancity2526', 'arsenal2526', 'liverpool2526', 'psg2526', 'bayern2526', 'inter2526', 'napoli2526'];
const HISTORIC_KEYS = ['inter0910', 'chelsea1112', 'bayern1213', 'madrid1516', 'madrid1718', 'liverpool1819', 'bayern1920'];

function emitSeason(seasonKey, season) {
	if (!season || season.error) return [];
	const era = season.era;
	const players = (season.squad || []).filter((p) => p.mapped);
	if (players.length === 0) return [];
	const ids = buildSeedIds(seasonKey, players);
	const defaults = era === 'current' ? DEFAULT_VALUE_CURRENT : DEFAULT_VALUE_HISTORIC;

	const lines = [];
	lines.push(`-- ${season.label} (${players.length} jugadors)`);
	lines.push(`insert into public.tags (slug, display_name, category)`);
	lines.push(`values ('${season.tagSlug}', '${sqlString(season.team)}', '${era === 'current' ? 'club_season' : 'club_season'}')`);
	lines.push(`on conflict (slug) do nothing;`);
	lines.push(``);
	lines.push(`insert into public.players (name, primary_position, market_value_cents, is_scrub, metadata)`);
	lines.push(`select v.name, v.pos::position_code, (v.value_m::bigint) * 100000000, false,`);
	lines.push(`\tjsonb_build_object('dev_seed_id', v.seed_id, 'team', v.team)`);
	lines.push(`from (values`);

	const rows = [];
	for (const p of players) {
		const value = VALUE_OVERRIDES[`${p.name} | ${seasonKey}`] ?? defaults[p.mapped] ?? 10;
		const seedId = ids.get(p.name);
		rows.push(`\t('${sqlString(seedId)}', '${sqlString(p.name)}', '${p.mapped}', '${sqlString(season.team)}', ${value})`);
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
	lines.push(`where t.slug = '${season.tagSlug}'`);
	lines.push(`\tand p.metadata ->> 'dev_seed_id' like '${seasonKey}-%'`);
	lines.push(`on conflict do nothing;`);
	lines.push(``);
	return lines;
}

// --- 11_real_ucl_2526.sql ---
const currentLines = [];
currentLines.push(`-- ============================================================================`);
currentLines.push(`-- Real seed: UCL 2025-26 favorites — 7 top European clubs.`);
currentLines.push(`-- Auto-generated by scripts/build-ucl-seeds.mjs from`);
currentLines.push(`-- scripts/ucl-squads-raw.json (sourced from Wikipedia).`);
currentLines.push(`-- Generated: ${new Date().toISOString()}`);
currentLines.push(`-- ============================================================================`);
currentLines.push(``);
let currentTotal = 0;
for (const key of CURRENT_KEYS) {
	const block = emitSeason(key, all[key]);
	if (block.length) {
		const players = all[key].squad.filter((p) => p.mapped);
		currentTotal += players.length;
		currentLines.push(...block);
	}
}
const currentDest = new URL('../supabase/seed/11_real_ucl_2526.sql', import.meta.url);
writeFileSync(currentDest, currentLines.join('\n') + '\n');
console.log(`Wrote ${currentDest.pathname} — ${currentTotal} players`);

// --- 12_real_ucl_historic.sql ---
const histLines = [];
histLines.push(`-- ============================================================================`);
histLines.push(`-- Real seed: UCL històric — 7 guanyadors de la Champions dels 2010.`);
histLines.push(`-- Auto-generated by scripts/build-ucl-seeds.mjs from`);
histLines.push(`-- scripts/ucl-squads-raw.json + inline hand-curated squads (Bayern 12-13,`);
histLines.push(`-- Liverpool 18-19) for seasons whose Wikipedia pages lack squad tables.`);
histLines.push(`-- Generated: ${new Date().toISOString()}`);
histLines.push(`-- ============================================================================`);
histLines.push(``);
let histTotal = 0;
for (const key of HISTORIC_KEYS) {
	const block = emitSeason(key, all[key]);
	if (block.length) {
		const players = all[key].squad.filter((p) => p.mapped);
		histTotal += players.length;
		histLines.push(...block);
	}
}
const histDest = new URL('../supabase/seed/12_real_ucl_historic.sql', import.meta.url);
writeFileSync(histDest, histLines.join('\n') + '\n');
console.log(`Wrote ${histDest.pathname} — ${histTotal} players`);

// --- 13_ucl_themes.sql ---
// Composite themes. For the current "ucl-25-26" theme we include the new
// per-club tags PLUS laliga-25-26 (which adds Madrid + Barça + Atlético for
// free, but also Athletic + Sociedad — small contamination accepted as a
// pragmatic shortcut). For "ucl-historic" we list per-season tags including
// pre-existing Barça/Madrid historic tags so the Messi/Ronaldo eras show up.

const uclCurrentTags = [
	'laliga-25-26',
	...CURRENT_KEYS.map((k) => all[k]?.tagSlug).filter(Boolean)
];

const uclHistoricTags = [
	// Pre-existing club historic tags (each Barça/Madrid era contributed a UCL)
	'barca-2008-09',
	'barca-2010-11',
	'barca-2014-15',
	'madrid-2013-14',
	'madrid-2016-17',
	// New historic UCL winners
	...HISTORIC_KEYS.map((k) => all[k]?.tagSlug).filter(Boolean)
];

const uclAllTags = [
	...new Set([...uclCurrentTags, ...uclHistoricTags])
];

const themeLines = [];
themeLines.push(`-- ============================================================================`);
themeLines.push(`-- Composite UCL themes — mix per-club season tags to assemble Champions League`);
themeLines.push(`-- auction pools. The auction RPC treats include_tags as a UNION (a player`);
themeLines.push(`-- matches if they hold ANY listed tag) so a single room draws from all eras.`);
themeLines.push(`-- ============================================================================`);
themeLines.push(``);

const themes = [
	{
		slug: 'ucl-25-26',
		name: 'UCL 2025-26 (Champions League)',
		desc: 'Top 10 favorits del torneig 25-26: Madrid + Barça + Atlético + City + Arsenal + Liverpool + PSG + Bayern + Inter + Napoli (i alguns extres de LaLiga).',
		tags: uclCurrentTags
	},
	{
		slug: 'ucl-historic',
		name: 'UCL històric (2010s)',
		desc: 'Guanyadors de la Champions dels 2010: Inter 09-10, Barça 10-11, Chelsea 11-12, Bayern 12-13, Madrid 13-14/15-16/16-17/17-18, Barça 14-15, Liverpool 18-19, Bayern 19-20.',
		tags: uclHistoricTags
	},
	{
		slug: 'ucl-all',
		name: 'UCL — totes les eres',
		desc: 'Tot el contingut UCL: favorits 25-26 + guanyadors històrics dels 2010 + eres dels grans clubs LaLiga.',
		tags: uclAllTags
	}
];

for (const t of themes) {
	const tagsJson = JSON.stringify(t.tags);
	themeLines.push(`insert into public.themes (slug, display_name, description, filter_config, is_published)`);
	themeLines.push(`values (`);
	themeLines.push(`\t'${t.slug}',`);
	themeLines.push(`\t'${sqlString(t.name)}',`);
	themeLines.push(`\t'${sqlString(t.desc)}',`);
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

const themeDest = new URL('../supabase/seed/13_ucl_themes.sql', import.meta.url);
writeFileSync(themeDest, themeLines.join('\n') + '\n');
console.log(`Wrote ${themeDest.pathname} — ${themes.length} themes`);

console.log(`\nTotal new UCL players: ${currentTotal + histTotal}`);
console.log(`  Current (25-26):  ${currentTotal}`);
console.log(`  Historic (2010s): ${histTotal}`);
