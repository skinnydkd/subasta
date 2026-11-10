// One-shot bootstrap of a FRESH database: Supabase compat shims, then every
// migration, then every seed, in filename order. Not re-runnable (migrations
// aren't idempotent) — drop the schema first if you need to start over.
// Usage: node scripts/db-setup.mjs   (needs DATABASE_URL in .env)

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const sqlIn = (dir) =>
	readdirSync(dir)
		.filter((f) => f.endsWith('.sql'))
		.sort()
		.map((f) => `${dir}/${f}`);

export const files = [...sqlIn('db'), ...sqlIn('supabase/migrations'), ...sqlIn('supabase/seed')];

if (process.argv[1]?.endsWith('db-setup.mjs')) {
	execFileSync('node', ['scripts/run-sql.mjs', ...files], { stdio: 'inherit' });
}
