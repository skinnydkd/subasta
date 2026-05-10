// Wrapper around `supabase gen types typescript` that strips the trailing
// <claude-code-hint /> line that the Supabase Claude plugin appends.
// Result is written to src/lib/types/db.ts.

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PROJECT_ID = 'yblgzpmypipnqfhsmayu';

const out = execSync(
	`pnpm dlx supabase gen types typescript --project-id ${PROJECT_ID}`,
	{ encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] }
);

const cleaned = out
	.split('\n')
	.filter((line) => !/<claude-code-hint\b/.test(line))
	.join('\n');

writeFileSync('src/lib/types/db.ts', cleaned);
console.log(`Wrote src/lib/types/db.ts (${cleaned.split('\n').length} lines)`);
