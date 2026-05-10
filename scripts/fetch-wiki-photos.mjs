// Fetches player photo URLs from Wikipedia and updates players.photo_url
// for every "real" seeded player (those with metadata.dev_seed_id starting
// with one of the real-seed prefixes). Idempotent: only updates rows where
// photo_url IS NULL. Failures are logged and the row is left unchanged.

import 'dotenv/config';
import pg from 'pg';

const REAL_PREFIXES = ['rm-', 'bar-', 'atm-', 'ath-', 'rso-', 'bar0809-', 'rm0203-'];
const WIKI_REST = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const WIKI_SEARCH = 'https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=3&search=';
const USER_AGENT = 'subasta-photo-fetcher/1.0 (https://github.com/skinnydkd/subasta)';

async function fetchSummary(title) {
	const url = WIKI_REST + encodeURIComponent(title.replace(/ /g, '_'));
	const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, accept: 'application/json' } });
	if (!res.ok) return null;
	const data = await res.json();
	if (data.type === 'disambiguation') return null;
	return data;
}

async function searchTitles(query) {
	const url = WIKI_SEARCH + encodeURIComponent(query);
	const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
	if (!res.ok) return [];
	const data = await res.json();
	return Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
}

async function findPhoto(name) {
	// Try a few candidate titles in order of specificity.
	const candidates = [
		`${name} (footballer)`,
		`${name} (Spanish footballer)`,
		`${name} (Argentine footballer)`,
		`${name} (Brazilian footballer)`,
		`${name} (French footballer)`,
		name
	];

	for (const c of candidates) {
		const summary = await fetchSummary(c);
		if (summary?.thumbnail?.source) {
			return { url: summary.thumbnail.source, title: summary.title };
		}
	}

	// Fallback: open search and pick the first football-y match.
	const titles = await searchTitles(`${name} footballer`);
	for (const t of titles) {
		const summary = await fetchSummary(t);
		if (summary?.thumbnail?.source) {
			return { url: summary.thumbnail.source, title: summary.title };
		}
	}
	return null;
}

async function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

const c = new pg.Client({
	connectionString: process.env.SUPABASE_DB_URL,
	ssl: { rejectUnauthorized: false }
});
await c.connect();

const { rows } = await c.query(`
	select id, name, metadata
	from players
	where photo_url is null
		and (${REAL_PREFIXES.map((_, i) => `metadata ->> 'dev_seed_id' like $${i + 1}`).join(' or ')})
	order by name
`, REAL_PREFIXES.map((p) => `${p}%`));

console.log(`Found ${rows.length} players without photos.`);

let updated = 0;
let failed = 0;

for (const p of rows) {
	try {
		const result = await findPhoto(p.name);
		if (result?.url) {
			await c.query('update players set photo_url = $1 where id = $2', [result.url, p.id]);
			updated++;
			console.log(`  ✓ ${p.name} → ${result.title}`);
		} else {
			failed++;
			console.log(`  ✗ ${p.name} (no thumbnail)`);
		}
	} catch (err) {
		failed++;
		console.log(`  ✗ ${p.name} (${err.message})`);
	}
	// Polite throttle: ~5 req/s respects Wikipedia's rate-limit guidance.
	await sleep(220);
}

console.log(`\nDone. Updated ${updated}, failed ${failed}, total ${rows.length}.`);
await c.end();
