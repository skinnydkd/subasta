// Validates the seed data on a throw-away in-memory Postgres (PGlite): loads
// every file of scripts/db-setup.mjs (compat + migrations + seeds) and FAILS
// (exit 1) when
//   - a non-scrub player has no metadata.team,
//   - a dev_seed_id is duplicated,
//   - a tag listed by a published theme matches zero players,
//   - a published theme's pool is below the per-position minimums
//     (GK/CB/CM/ST >= 25, LB/RB/LW/RW >= 12 distinct people),
// then prints a table with the pool of every published theme.
// Pools are computed like start_room does: de-duplicated by (lower(name),
// birth_year), keeping the most valuable row and ITS primary_position.
//
// Usage: node scripts/check-seeds.mjs        (~15 s)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..')); // db-setup.mjs uses repo-relative paths
const { files } = await import('./db-setup.mjs');

const MIN = { GK: 25, CB: 25, CM: 25, ST: 25, LB: 12, RB: 12, LW: 12, RW: 12 };
const POSITIONS = ['GK', 'RB', 'LB', 'CB', 'CM', 'RW', 'LW', 'ST'];

// Themes created by seeds 01..13 (before the stricter minimums existed). They
// are reported as WARN, not FAIL. Everything else must meet MIN.
const LEGACY_THIN = new Set([
	'demo-2026', 'laliga-25-26', 'barca-historic', 'madrid-historic', 'villarreal-historic',
	'clasicos-historic', 'laliga-historicos', 'ucl-25-26', 'ucl-historic'
]);

const db = new PGlite({ extensions: { pg_trgm } });
for (const f of files) {
	try {
		await db.exec(readFileSync(f, 'utf8'));
	} catch (e) {
		console.error(`FAIL: ${f} does not load: ${String(e.message).slice(0, 300)}`);
		process.exit(1);
	}
}
const q = async (sql) => (await db.query(sql)).rows;

const failures = [];
const warnings = [];

// 1) every non-scrub player has a team
const noTeam = await q(`select metadata->>'dev_seed_id' id, name from public.players
	where not is_scrub and coalesce(metadata->>'team', '') = '' order by 1`);
if (noTeam.length) failures.push(`${noTeam.length} non-scrub players without metadata.team, e.g. ${noTeam.slice(0, 5).map((r) => r.id).join(', ')}`);

// 2) duplicated dev_seed_id
const dups = await q(`select metadata->>'dev_seed_id' id, count(*)::int n from public.players
	where metadata ? 'dev_seed_id' group by 1 having count(*) > 1`);
if (dups.length) failures.push(`duplicated dev_seed_id: ${dups.slice(0, 5).map((r) => `${r.id} x${r.n}`).join(', ')}`);

// 3) positions outside the 8 the game uses (non-scrub real players)
const badPos = await q(`select count(*)::int n from public.players where not is_scrub and primary_position::text not in ('GK','LB','RB','CB','CM','LW','RW','ST')`);
if (badPos[0].n) failures.push(`${badPos[0].n} players with a position the game formations do not use`);

// 4) published themes: tags that match nothing + pool sizes
const themes = await q(`select slug, filter_config from public.themes where is_published order by slug`);
const rows = [];
for (const t of themes) {
	const include = t.filter_config.include_tags || [];
	const exclude = t.filter_config.exclude_tags || [];
	for (const slug of [...include, ...exclude]) {
		const n = (await q(`select count(*)::int n from public.player_tags pt join public.tags g on g.id = pt.tag_id
			join public.players p on p.id = pt.player_id where g.slug = '${slug}' and not p.is_scrub`))[0].n;
		if (n === 0) failures.push(`theme ${t.slug}: tag ${slug} matches zero players`);
	}
	const inc = include.map((s) => `'${s}'`).join(',') || `''`;
	const exc = exclude.map((s) => `'${s}'`).join(',') || `''`;
	const pool = await q(`
		with cand as (
			select distinct on (lower(p.name), p.birth_year) p.primary_position::text pos
			from public.players p
			where p.is_scrub = false
				and (${include.length === 0} or exists (select 1 from public.player_tags pt join public.tags g on g.id = pt.tag_id
					where pt.player_id = p.id and g.slug in (${inc})))
				and (${exclude.length === 0} or not exists (select 1 from public.player_tags pt join public.tags g on g.id = pt.tag_id
					where pt.player_id = p.id and g.slug in (${exc})))
			order by lower(p.name), p.birth_year, p.market_value_cents desc nulls last
		)
		select pos, count(*)::int n from cand group by pos`);
	const by = Object.fromEntries(pool.map((r) => [r.pos, r.n]));
	const low = POSITIONS.filter((p) => (by[p] || 0) < MIN[p]);
	const total = POSITIONS.reduce((a, p) => a + (by[p] || 0), 0);
	rows.push({ theme: t.slug, ...Object.fromEntries(POSITIONS.map((p) => [p, by[p] || 0])), total, status: low.length ? (LEGACY_THIN.has(t.slug) ? 'WARN(legacy)' : 'FAIL') : 'ok' });
	if (low.length) {
		const msg = `theme ${t.slug}: below minimum in ${low.map((p) => `${p} ${by[p] || 0}<${MIN[p]}`).join(', ')}`;
		(LEGACY_THIN.has(t.slug) ? warnings : failures).push(msg);
	}
}

console.log(`seeds loaded: ${files.length} files; minimums GK/CB/CM/ST ${MIN.GK}, LB/RB/LW/RW ${MIN.LB}`);
console.table(rows);
const counts = await q(`select count(*) filter (where not is_scrub)::int real, count(*) filter (where is_scrub)::int scrubs,
	(select count(*)::int from public.tags) tags, (select count(*)::int from public.themes where is_published) themes from public.players`);
console.log(counts[0]);
for (const w of warnings) console.log('WARN', w);
for (const f of failures) console.log('FAIL', f);
if (failures.length) {
	console.log(`\n${failures.length} failure(s)`);
	process.exit(1);
}
console.log('\nall checks passed');
