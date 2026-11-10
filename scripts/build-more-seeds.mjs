// Reads scripts/more-squads-raw.json (+ inline hand-curated squads from
// more-squads-data.mjs) and writes seeds 15..21 under supabase/seed/.
// Run: node scripts/build-more-seeds.mjs   (idempotent; overwrites the files)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SQUADS } from './more-squads-config.mjs';
import {
	INLINE_SQUADS,
	POSITION_OVERRIDES,
	NAME_FIXES,
	EXCLUDE,
	VALUE_CURRENT,
	VALUE_HISTORIC,
	THEMES
} from './more-squads-data.mjs';

const raw = JSON.parse(readFileSync(new URL('./more-squads-raw.json', import.meta.url), 'utf8'));
const SEED_DIR = new URL('../supabase/seed/', import.meta.url);

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const sqlString = (s) => s.replace(/'/g, "''");
const hashLeft = (name) => [...norm(name)].reduce((a, c) => a + c.charCodeAt(0), 0) % 2 === 0; // stable L/R for generic "winger"/"full-back"

// Positions already seeded (04..14) for 2025-26 squads, by normalized name, so
// a person keeps the same position in a club squad and in the 2026 national
// team (start_room keeps one row per name; a flip-flop would be confusing).
async function existingCurrentPositions() {
	process.chdir(fileURLToPath(new URL('..', import.meta.url)));
	const { PGlite } = await import('@electric-sql/pglite');
	const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm');
	const { files } = await import('./db-setup.mjs');
	const db = new PGlite({ extensions: { pg_trgm } });
	for (const f of files.filter((f) => !/\/(1[5-9]|2\d)_/.test(f))) await db.exec(readFileSync(f, 'utf8'));
	const { rows } = await db.query(`
		select distinct on (lower(p.name)) p.name, p.primary_position::text pos
		from public.players p join public.player_tags pt on pt.player_id = p.id join public.tags t on t.id = pt.tag_id
		where not p.is_scrub and t.slug in ('mancity-25-26','arsenal-25-26','liverpool-25-26','psg-25-26','bayern-25-26','inter-25-26','napoli-25-26','laliga-25-26')
		order by lower(p.name), p.market_value_cents desc nulls last`);
	return new Map(rows.map((r) => [norm(r.name), r.pos]));
}
const EXISTING_POS = await existingCurrentPositions();
const CURRENT_GROUPS = new Set(['pl', 'seriea', 'euro', 'natcur']);


// ---------------------------------------------------------------------------
// Position mapping
// ---------------------------------------------------------------------------
const ROLE_PATTERNS = [
	['GK', /goalkeeper/],
	['RB', /right[- ]back|right wing-back|right full-?back/],
	['LB', /left[- ]back|left wing-back|left full-?back/],
	['CB', /centre[- ]back|center[- ]back|central defender|sweeper|centre[- ]half/],
	['FB', /full-?back|wing-?back/],
	['DEF', /defender|defence/],
	['CM', /midfielder|playmaker|regista/],
	['RW', /right winger|right[- ]sided|right wing\b|right midfielder/],
	['LW', /left winger|left[- ]sided|left wing\b|left midfielder/],
	['W', /winger|wide player/],
	['ST', /striker|centre[- ]forward|center[- ]forward|second striker|forward/]
];

/** Ordered list of roles mentioned in the lead sentence, earliest first. */
function rolesFromExtract(extract) {
	const e = (extract || '').toLowerCase().slice(0, 330);
	const found = [];
	for (const [role, re] of ROLE_PATTERNS) {
		const m = re.exec(e);
		if (m) found.push({ role, at: m.index });
	}
	return found.sort((a, b) => a.at - b.at).map((f) => f.role);
}

const SPECIFIC = { GK: 'GK', CB: 'CB', SW: 'CB', RB: 'RB', RWB: 'RB', LB: 'LB', LWB: 'LB', DM: 'CM', CDM: 'CM', CM: 'CM', AM: 'CM', CAM: 'CM', RW: 'RW', RM: 'RW', LW: 'LW', LM: 'LW', ST: 'ST', CF: 'ST', SS: 'ST' };
const GENERIC_FAMILY = { G: 'GK', GK: 'GK', DF: 'DF', DEF: 'DF', D: 'DF', MF: 'MF', MID: 'MF', M: 'MF', FW: 'FW', FWD: 'FW', F: 'FW', WB: 'DF' };

function mapPosition(name, posRaw, extract) {
	const tokens = (posRaw || '')
		.toUpperCase()
		.split(/[\/,;]| - | OR /)
		.map((t) => t.trim())
		.filter(Boolean);
	const roles = rolesFromExtract(extract);
	const lr = (l, r) => (hashLeft(name) ? l : r);
	// 1) a specific code from the club's own table wins
	if (tokens.length && SPECIFIC[tokens[0]]) {
		const first = SPECIFIC[tokens[0]];
		if ((tokens[0] === 'AM' || tokens[0] === 'CAM') && tokens[1] && (SPECIFIC[tokens[1]] === 'RW' || SPECIFIC[tokens[1]] === 'LW')) return SPECIFIC[tokens[1]];
		return first;
	}
	// 2) generic family (DF/MF/FW) refined by the Wikipedia lead sentence
	const fam = GENERIC_FAMILY[tokens[0]] || null;
	if (fam === 'GK') return 'GK';
	if (fam === 'DF') {
		for (const r of roles) {
			if (r === 'RB' || r === 'LB' || r === 'CB') return r;
			if (r === 'FB') return lr('LB', 'RB');
			if (r === 'DEF') return 'CB';
		}
		return tokens[0] === 'WB' ? lr('LB', 'RB') : 'CB';
	}
	if (fam === 'MF') {
		for (const r of roles) {
			if (r === 'CM') return 'CM';
			if (r === 'RW' || r === 'LW') return r;
			if (r === 'W') return lr('LW', 'RW');
			if (r === 'RB' || r === 'LB' || r === 'FB') break; // described as a defender today: keep the table's family
		}
		return 'CM';
	}
	if (fam === 'FW') {
		for (const r of roles) {
			if (r === 'ST') return 'ST';
			if (r === 'RW' || r === 'LW') return r;
			if (r === 'W') return lr('LW', 'RW');
			if (r === 'CM') break;
		}
		return 'ST';
	}
	// 3) nothing usable in the table: fall back to the lead sentence only
	for (const r of roles) {
		if (['GK', 'RB', 'LB', 'CB', 'CM', 'RW', 'LW', 'ST'].includes(r)) return r;
		if (r === 'FB') return lr('LB', 'RB');
		if (r === 'W') return lr('LW', 'RW');
		if (r === 'DEF') return 'CB';
	}
	return null;
}

// ---------------------------------------------------------------------------
// Build squads
// ---------------------------------------------------------------------------
const YOUTH_GROUP = /youth|academy|reserve|under|u-?2[0-9]|u-?1[0-9]|\bb team|development|castilla|primavera|ii\b/i;
const isPerson = (x) => /footballer|football player|soccer player|football manager|player|winger|midfielder|goalkeeper|defender|striker/i.test(x.slice(0, 400)) && !/cricket|may refer|given name|masculine|surname/i.test(x.slice(0, 120));
const birthYear = (extract) => { const m = /born[^)]*?(\d{4})/i.exec((extract || '').slice(0, 160)); return m ? Number(m[1]) : null; };
const cleanName = (n) => n.replace(/\s*\([^)]*\)\s*$/, '').replace(/<[^>]*>/g, '').trim();

function slug(name) {
	const ascii = norm(name);
	const parts = ascii.split(' ');
	const last = parts[parts.length - 1];
	return (last.replace(/[^a-z0-9]/g, '') || 'player').slice(0, 12);
}

const squads = [];
for (const cfg of SQUADS) {
	let players;
	if (cfg.inline) {
		players = INLINE_SQUADS[cfg.key].map((p) => ({ name: p.name, mapped: p.pos, number: null }));
	} else if (INLINE_SQUADS[cfg.key]) {
		// scrape failed/unusable: hand-curated replacement
		players = INLINE_SQUADS[cfg.key].map((p) => ({ name: p.name, mapped: p.pos, number: null }));
	} else {
		const r = raw[cfg.key];
		if (!r || !r.squad?.length) {
			console.warn(`!! ${cfg.key}: no data, skipped`);
			continue;
		}
		players = [];
		const excl = new Set((EXCLUDE[cfg.key] || []).map(norm));
		for (const p of r.squad) {
			if (YOUTH_GROUP.test(p.group || '') || /loan/i.test(p.group || '')) continue;
			if (p.red || !p.extract || !isPerson(p.extract)) continue;
			let name = NAME_FIXES[p.wiki_title] || NAME_FIXES[p.name] || cleanName(p.name);
			if (cfg.include && !cfg.include.map(norm).includes(norm(name))) continue;
			if (excl.has(norm(name))) continue;
			const mapped =
				POSITION_OVERRIDES[`${name}|${cfg.key}`] || POSITION_OVERRIDES[name] || (CURRENT_GROUPS.has(cfg.group) && EXISTING_POS.get(norm(name))) || mapPosition(name, p.pos_raw, p.extract);
			if (!mapped) {
				console.warn(`?? ${cfg.key}: no position for ${name} (${p.pos_raw})`);
				continue;
			}
			players.push({ name, mapped, number: p.number, born: birthYear(p.extract) });
		}
	}
	// de-dupe inside the squad (same person listed twice)
	const seen = new Set();
	players = players.filter((p) => (seen.has(norm(p.name)) ? false : (seen.add(norm(p.name)), true)));
	squads.push({ ...cfg, players });
}

// ---------------------------------------------------------------------------
// Emit seed SQL
// ---------------------------------------------------------------------------
const historicGroups = new Set(['legend', 'nathist']);
const USED_VALUES = new Set();
function valueFor(sq, p) {
	const table = historicGroups.has(sq.group) ? VALUE_HISTORIC : VALUE_CURRENT;
	const hit = table.names[norm(p.name)];
	if (hit !== undefined) USED_VALUES.add((table === VALUE_HISTORIC ? 'h:' : 'c:') + norm(p.name));
	return hit ?? table.byPos[p.mapped] ?? 10;
}

function emitSquad(sq) {
	if (!sq.players.length) return [];
	const ids = new Map();
	const used = new Set();
	for (const p of sq.players) {
		const base = slug(p.name);
		let cand = base;
		let n = 1;
		while (used.has(cand)) cand = `${base}${++n}`;
		used.add(cand);
		ids.set(p.name, `${sq.key}-${cand}`);
	}
	const L = [];
	L.push(`-- ${sq.label} (${sq.players.length} jugadors)${sq.inlineNote ? ' - ' + sq.inlineNote : ''}`);
	L.push(`insert into public.tags (slug, display_name, category)`);
	L.push(`values ('${sq.tagSlug}', '${sqlString(sq.team)}', '${sq.tagCategory}')`);
	L.push(`on conflict (slug) do nothing;`);
	L.push(``);
	L.push(`insert into public.players (name, primary_position, market_value_cents, is_scrub, metadata)`);
	L.push(`select v.name, v.pos::position_code, (v.value_m::bigint) * 100000000, false,`);
	L.push(`\tjsonb_build_object('dev_seed_id', v.seed_id, 'team', v.team)`);
	L.push(`from (values`);
	L.push(
		sq.players
			.map((p) => `\t('${sqlString(ids.get(p.name))}', '${sqlString(p.name)}', '${p.mapped}', '${sqlString(sq.team)}', ${valueFor(sq, p)})`)
			.join(',\n')
	);
	L.push(`) as v(seed_id, name, pos, team, value_m)`);
	L.push(`where not exists (`);
	L.push(`\tselect 1 from public.players where metadata ->> 'dev_seed_id' = v.seed_id`);
	L.push(`);`);
	L.push(``);
	L.push(`insert into public.player_tags (player_id, tag_id)`);
	L.push(`select p.id, t.id`);
	L.push(`from public.players p`);
	L.push(`cross join public.tags t`);
	L.push(`where t.slug = '${sq.tagSlug}'`);
	L.push(`\tand p.metadata ->> 'dev_seed_id' like '${sq.key}-%'`);
	L.push(`on conflict do nothing;`);
	L.push(``);
	return L;
}

const FILES = [
	{ group: 'pl', file: '15_real_premier_league_2526.sql', title: 'Premier League 2025-26: Chelsea, Tottenham, Manchester United, Newcastle, Aston Villa (City/Arsenal/Liverpool live in 11_real_ucl_2526.sql).' },
	{ group: 'seriea', file: '16_real_serie_a_2526.sql', title: 'Serie A 2025-26: Juventus, AC Milan, Roma, Atalanta, Lazio, Fiorentina (Inter/Napoli live in 11_real_ucl_2526.sql).' },
	{ group: 'euro', file: '17_real_euro_leagues_2526.sql', title: 'Bundesliga / Portugal 2025-26: Dortmund, Leverkusen, Benfica, Porto, Sporting CP (Bayern/PSG live in 11_real_ucl_2526.sql).' },
	{ group: 'natcur', file: '18_real_national_teams_2026.sql', title: 'National teams, current: 2026 World Cup squads.' },
	{ group: 'nathist', file: '19_real_national_teams_historic.sql', title: 'National teams, historic tournament squads (Euro 2008, WC 2010, Euro 2012, WC 2014, WC 2022, WC 1998, WC 2018, WC 2006, WC 2002, Euro 2016).' },
	{ group: 'legend', file: '20_real_club_legends.sql', title: 'Club legends: Man Utd 98-99 / 07-08, AC Milan 02-03 / 06-07, Barcelona 05-06, Juventus 16-17, Liverpool 04-05.' }
];

let totalPlayers = 0;
for (const f of FILES) {
	const L = [];
	L.push(`-- ============================================================================`);
	L.push(`-- Real seed: ${f.title}`);
	L.push(`-- Auto-generated by scripts/build-more-seeds.mjs from scripts/more-squads-raw.json`);
	L.push(`-- (Wikipedia, rendered squad tables) + hand-curated squads from`);
	L.push(`-- scripts/more-squads-data.mjs where Wikipedia had no usable table.`);
	L.push(`-- ============================================================================`);
	L.push(``);
	for (const sq of squads.filter((s) => s.group === f.group)) {
		L.push(...emitSquad(sq));
		totalPlayers += sq.players.length;
	}
	writeFileSync(new URL(f.file, SEED_DIR), L.join('\n') + '\n');
	console.log(`wrote ${f.file}: ${squads.filter((s) => s.group === f.group).map((s) => `${s.key}=${s.players.length}`).join(' ')}`);
}

// Themes
const T = [];
T.push(`-- ============================================================================`);
T.push(`-- More composite themes (leagues, national teams, club legends).`);
T.push(`-- include_tags is a UNION; start_room de-duplicates by player name.`);
T.push(`-- Auto-generated by scripts/build-more-seeds.mjs (definitions: more-squads-data.mjs).`);
T.push(`-- ============================================================================`);
T.push(``);
for (const t of THEMES) {
	const tags = t.tags(squads);
	T.push(`insert into public.themes (slug, display_name, description, filter_config, is_published)`);
	T.push(`values (`);
	T.push(`\t'${t.slug}',`);
	T.push(`\t'${sqlString(t.name)}',`);
	T.push(`\t'${sqlString(t.desc)}',`);
	T.push(`\t'{"include_tags": ${JSON.stringify(tags)}, "exclude_tags": []}'::jsonb,`);
	T.push(`\ttrue`);
	T.push(`)`);
	T.push(`on conflict (slug) do update set`);
	T.push(`\tdisplay_name = excluded.display_name,`);
	T.push(`\tdescription = excluded.description,`);
	T.push(`\tfilter_config = excluded.filter_config,`);
	T.push(`\tis_published = excluded.is_published;`);
	T.push(``);
}
writeFileSync(new URL('21_more_themes.sql', SEED_DIR), T.join('\n') + '\n');
console.log(`wrote 21_more_themes.sql: ${THEMES.length} themes`);
console.log(`new squads: ${squads.filter((s) => s.players.length).length}, new player rows: ${totalPlayers}`);

// node scripts/build-more-seeds.mjs --print [key...]  -> compact review listing
if (process.argv.includes('--print')) {
	const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
	for (const sq of squads) {
		if (only.length && !only.includes(sq.key)) continue;
		console.log(`\n## ${sq.key} ${sq.team} (${sq.players.length})`);
		for (const pos of ['GK', 'RB', 'LB', 'CB', 'CM', 'RW', 'LW', 'ST']) {
			console.log(` ${pos}: ${sq.players.filter((p) => p.mapped === pos).map((p) => `${p.name}${p.number ? '#' + p.number : ''}${p.born ? "'" + String(p.born).slice(2) : ''}`).join(', ')}`);
		}
	}
}

// node scripts/build-more-seeds.mjs --unmatched -> value-tier names that matched nobody (typos)
if (process.argv.includes('--unmatched')) {
	for (const [label, table] of [['c:', VALUE_CURRENT], ['h:', VALUE_HISTORIC]]) {
		const miss = Object.keys(table.names).filter((n) => !USED_VALUES.has(label + n));
		console.log(`
unmatched ${label === 'c:' ? 'current' : 'historic'} tiers (${miss.length}): ${miss.join(', ')}`);
	}
}
