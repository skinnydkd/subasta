// Reads scripts/squads-raw.json (produced by fetch-squads.mjs) and writes
// supabase/seed/04_real_laliga_25_26.sql with the current squads, applying
// per-position default market values plus a small override table for cracks.

import { readFileSync, writeFileSync } from 'node:fs';

const SRC = new URL('./squads-raw.json', import.meta.url);
const DEST = new URL('../supabase/seed/04_real_laliga_25_26.sql', import.meta.url);

const TEAM_DISPLAY = {
	rm: 'Real Madrid',
	bar: 'Barcelona',
	atm: 'Atlético',
	ath: 'Athletic',
	rso: 'Real Sociedad'
};

// Default market values (millions €) by position.
const DEFAULT_VALUE = {
	GK: 15,
	RB: 18,
	LB: 18,
	CB: 25,
	CM: 30,
	RW: 40,
	LW: 40,
	ST: 40
};

// Manual overrides for headline players. Anyone not listed uses the default.
// Edit by hand after the auto-generated seed if you spot stragglers.
const VALUE_OVERRIDES = {
	'Lamine Yamal': 200,
	'Jude Bellingham': 180,
	'Kylian Mbappé': 180,
	'Vinícius Júnior': 200,
	'Pedri': 110,
	'Pau Cubarsí': 80,
	'Federico Valverde': 100,
	'Aurélien Tchouaméni': 80,
	'Eduardo Camavinga': 70,
	'Rodrygo': 90,
	'Arda Güler': 70,
	'Dean Huijsen': 60,
	'Trent Alexander-Arnold': 70,
	'Éder Militão': 45,
	'Antonio Rüdiger': 30,
	'Brahim Díaz': 45,
	'Gavi': 80,
	'Raphinha': 80,
	'Robert Lewandowski': 15,
	'Ferran Torres': 35,
	'Dani Olmo': 60,
	'Frenkie de Jong': 50,
	'Ronald Araújo': 65,
	'Jules Koundé': 55,
	'Joan Garcia': 35,
	'João Cancelo': 25,
	'Marcus Rashford': 30,
	'Andreas Christensen': 20,
	'Julián Alvarez': 90,
	'Antoine Griezmann': 20,
	'Jan Oblak': 22,
	'Marcos Llorente': 30,
	'Pablo Barrios': 35,
	'Conor Gallagher': 35,
	'Robin Le Normand': 30,
	'Dávid Hancko': 35,
	'Alexander Sørloth': 30,
	'Ademola Lookman': 50,
	'Giacomo Raspadori': 30,
	'Álex Baena': 35,
	'Johnny Cardoso': 30,
	'Thiago Almada': 40,
	'Giuliano Simeone': 30,
	'Nico Williams': 65,
	'Iñaki Williams': 20,
	'Oihan Sancet': 40,
	'Aymeric Laporte': 8,
	'Unai Simón': 25,
	'Dani Vivian': 30,
	'Takefusa Kubo': 45,
	'Mikel Oyarzabal': 32,
	'Brais Méndez': 22,
	'Álex Remiro': 14,
	'Luka Sučić': 18,
	'Arsen Zakharyan': 18,
	'Yangel Herrera': 12,
	'Duje Ćaleta-Car': 6,
	'Orri Óskarsson': 15
};

// ASCII slug from a display name, suitable for dev_seed_id suffix.
function slug(name) {
	const ascii = name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9 -]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	const parts = ascii.split(' ');
	// Prefer last word (surname); fall back to whole if single word.
	const last = parts[parts.length - 1];
	const sluggish = last.replace(/[^a-z0-9]/g, '');
	return sluggish.slice(0, 12);
}

// Disambiguate slug collisions inside one team by appending more name parts.
function buildSeedIds(team, players) {
	const ids = new Map();
	const used = new Set();
	for (const p of players) {
		let base = slug(p.name);
		if (!base) base = 'unknown';
		let candidate = base;
		let suffix = 1;
		while (used.has(candidate)) {
			suffix++;
			candidate = `${base}${suffix}`;
		}
		used.add(candidate);
		ids.set(p.name, `${team}-${candidate}`);
	}
	return ids;
}

function sqlString(s) {
	return s.replace(/'/g, "''");
}

const data = JSON.parse(readFileSync(SRC, 'utf8'));

const headerLines = [
	`-- ============================================================================`,
	`-- Real seed: La Liga 25-26 squads, auto-generated from Wikipedia by`,
	`-- scripts/fetch-squads.mjs + scripts/build-laliga-seed.mjs.`,
	`-- Generated: ${new Date().toISOString()}`,
	`--`,
	`-- Note: every midfielder is classified as CM regardless of CDM/CAM tendency,`,
	`-- because the default formation (4-3-3) only allocates CM slots — players`,
	`-- tagged CDM/CAM would otherwise never enter the queue.`,
	`-- Wingers (RW/LW) are detected from the player's individual Wikipedia`,
	`-- summary ("plays as a right winger"). All other refinements come from the`,
	`-- season page's {{Fs player}}/{{Efs player2}}/{{fb si player}} templates.`,
	`-- ============================================================================`,
	``,
	`insert into public.tags (slug, display_name, category)`,
	`values ('laliga-25-26', 'La Liga 2025-26', 'league_season')`,
	`on conflict (slug) do nothing;`,
	``,
	`insert into public.themes (slug, display_name, description, filter_config, is_published)`,
	`values (`,
	`\t'laliga-25-26',`,
	`\t'La Liga 2025-26',`,
	`\t'Top jugadors de La Liga 25-26 (Real Madrid, Barça, Atlético, Athletic, Real Sociedad).',`,
	`\t'{"include_tags": ["laliga-25-26"], "exclude_tags": []}'::jsonb,`,
	`\ttrue`,
	`)`,
	`on conflict (slug) do nothing;`,
	``,
	`-- Squad list shared by both the players insert and the tagging insert.`,
	`-- Use a temporary table so it survives across statements when this file`,
	`-- runs through scripts/run-sql.mjs (one query, multi-statement).`,
	`create temporary table _laliga2526_squad (`,
	`\tseed_id text,`,
	`\tname text,`,
	`\tpos text,`,
	`\tteam text,`,
	`\tvalue_m int`,
	`) on commit drop;`,
	``,
	`insert into _laliga2526_squad (seed_id, name, pos, team, value_m) values`
];

const valueLines = [];
const teamPrefixes = [];

for (const teamKey of Object.keys(TEAM_DISPLAY)) {
	const block = data[teamKey];
	if (!block || block.error) continue;
	const players = block.squad;
	const ids = buildSeedIds(teamKey, players);
	teamPrefixes.push(`${teamKey}-`);

	valueLines.push(`\t-- ===================== ${TEAM_DISPLAY[teamKey]} =====================`);

	for (const p of players) {
		const pos = p.mapped;
		if (!pos) continue; // skip unmappable players (rare)
		const value = VALUE_OVERRIDES[p.name] ?? DEFAULT_VALUE[pos] ?? 20;
		const seedId = ids.get(p.name);
		const tuple = `\t('${sqlString(seedId)}', '${sqlString(p.name)}', '${pos}', '${sqlString(TEAM_DISPLAY[teamKey])}', ${value})`;
		valueLines.push(tuple + ',');
	}
}

// Strip the trailing comma from the last data line.
const lastIdx = valueLines.length - 1;
valueLines[lastIdx] = valueLines[lastIdx].replace(/,$/, '');

const tailLines = [
	`;`,
	``,
	`-- Insert players that don't already exist (idempotent by dev_seed_id).`,
	`insert into public.players (name, primary_position, market_value_cents, is_scrub, metadata)`,
	`select s.name, s.pos::position_code, (s.value_m::bigint) * 100000000, false,`,
	`\tjsonb_build_object('dev_seed_id', s.seed_id, 'team', s.team)`,
	`from _laliga2526_squad s`,
	`where not exists (`,
	`\tselect 1 from public.players where metadata ->> 'dev_seed_id' = s.seed_id`,
	`);`,
	``,
	`-- Tag ONLY the seed players (no longer "everyone with prefix rm-%"). This`,
	`-- means players in the old seed who departed (e.g. De Paul, Modrić) keep`,
	`-- their player rows but stop appearing in the laliga-25-26 theme — they`,
	`-- must also be untagged by the companion migration the first time around.`,
	`insert into public.player_tags (player_id, tag_id)`,
	`select p.id, t.id`,
	`from public.players p`,
	`join _laliga2526_squad s on p.metadata ->> 'dev_seed_id' = s.seed_id`,
	`cross join public.tags t`,
	`where t.slug = 'laliga-25-26'`,
	`on conflict do nothing;`
];

const sql = [...headerLines, ...valueLines, ...tailLines].join('\n') + '\n';
writeFileSync(DEST, sql);

const totals = {};
let grand = 0;
for (const teamKey of Object.keys(TEAM_DISPLAY)) {
	const block = data[teamKey];
	if (!block || block.error) continue;
	totals[teamKey] = block.squad.filter((p) => p.mapped).length;
	grand += totals[teamKey];
}

console.log(`Wrote ${DEST.pathname}`);
console.log(`Total players: ${grand}`);
for (const [k, n] of Object.entries(totals)) {
	console.log(`  ${TEAM_DISPLAY[k].padEnd(16)} ${n}`);
}
