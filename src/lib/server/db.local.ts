// Dev-only stand-in for Neon: an in-memory Postgres (PGlite) built from the same
// SQL files as `pnpm db:setup`. Used when DATABASE_URL is empty under `vite dev`.
// Data is lost when the dev server restarts.
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readdirSync, readFileSync } from 'node:fs';

// Survives Vite re-evaluating this module on HMR.
const g = globalThis as { __subastaDb?: Promise<PGlite> };

async function create(): Promise<PGlite> {
	// int8 as string, like the Neon driver.
	const db = new PGlite({ extensions: { pg_trgm }, parsers: { 20: (v: string) => v } });
	for (const dir of ['db', 'supabase/migrations', 'supabase/seed']) {
		for (const f of readdirSync(dir)
			.filter((f) => f.endsWith('.sql'))
			.sort()) {
			await db.exec(readFileSync(`${dir}/${f}`, 'utf8'));
		}
	}
	console.log('[db] DATABASE_URL buit: Postgres local en memòria (PGlite) preparat');
	return db;
}

export async function query<T>(
	userId: string | null,
	text: string,
	params: unknown[]
): Promise<T[]> {
	const db = await (g.__subastaDb ??= create());
	return db.transaction(async (tx) => {
		await tx.query(`select set_config('app.user_id', $1, true)`, [userId ?? '']);
		return (await tx.query<T>(text, params)).rows;
	});
}
