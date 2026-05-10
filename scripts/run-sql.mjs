// Apply one or more SQL files to SUPABASE_DB_URL.
// Usage: node scripts/run-sql.mjs <file1.sql> [file2.sql] ...
//
// Each file runs as a single query (multiple statements OK). Errors abort.

import 'dotenv/config';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
	console.error('SUPABASE_DB_URL not set in .env');
	process.exit(1);
}

const files = process.argv.slice(2);
if (files.length === 0) {
	console.error('Usage: node scripts/run-sql.mjs <file.sql> [...]');
	process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
	await client.connect();
	console.log(`Connected to Postgres.`);
	for (const f of files) {
		const path = resolve(f);
		statSync(path); // throws if missing
		const sql = readFileSync(path, 'utf8');
		// Strip psql meta-commands (\ir, \i) — they only work in psql, not pg client.
		const stripped = sql
			.split('\n')
			.filter((line) => !/^\s*\\(ir|i|c|set)\b/i.test(line))
			.join('\n');
		const t0 = Date.now();
		await client.query(stripped);
		console.log(`  ✓ ${f} (${Date.now() - t0}ms)`);
	}
} catch (err) {
	console.error('Failed:', err.message);
	process.exitCode = 1;
} finally {
	await client.end();
}
