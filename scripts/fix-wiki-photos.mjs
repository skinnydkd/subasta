// Manual overrides for the 11 players the automated wiki search missed.
// Each entry maps the seeded name to a known Wikipedia article title.

import 'dotenv/config';
import pg from 'pg';

const OVERRIDES = {
	'Adama Boiro': 'Adama Boiro',
	'Daniel Vivian': 'Dani Vivian',
	'Álex Berenguer': 'Álex Berenguer',
	'Fran García': 'Fran García (footballer, born 1999)',
	'Álex Padilla': 'Álex Padilla (footballer, born 2003)',
	'Pablo Barrios': 'Pablo Barrios (footballer)',
	'Javi Galán': 'Javier Galán Gil',
	'Gorka Guruzeta': 'Gorka Guruzeta',
	'Pedro Rodríguez': 'Pedro (footballer, born 1987)',
	'Daniel Alves': 'Dani Alves',
	'Flávio Conceição': 'Flávio Conceição'
};

const WIKI_REST = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const UA = 'subasta-photo-fetcher/1.0';

async function fetchSummary(title) {
	const res = await fetch(WIKI_REST + encodeURIComponent(title.replace(/ /g, '_')), {
		headers: { 'User-Agent': UA, accept: 'application/json' }
	});
	if (!res.ok) return null;
	return await res.json();
}

const c = new pg.Client({
	connectionString: process.env.SUPABASE_DB_URL,
	ssl: { rejectUnauthorized: false }
});
await c.connect();

let updated = 0;
let failed = 0;
for (const [name, title] of Object.entries(OVERRIDES)) {
	const summary = await fetchSummary(title);
	const url = summary?.thumbnail?.source ?? null;
	if (url) {
		const r = await c.query(`update players set photo_url = $1 where name = $2 and photo_url is null`, [url, name]);
		console.log(`  ✓ ${name} → ${title} (${r.rowCount})`);
		updated += r.rowCount ?? 0;
	} else {
		console.log(`  ✗ ${name} → ${title} (no thumbnail)`);
		failed++;
	}
	await new Promise((r) => setTimeout(r, 220));
}

console.log(`\nUpdated ${updated}, failed ${failed}.`);
await c.end();
