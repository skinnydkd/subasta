import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

let sql: NeonQueryFunction<false, false> | null = null;

function client() {
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
	return (sql ??= neon(env.DATABASE_URL));
}

/**
 * Run one statement as `userId`. The id is exposed to SQL through
 * `auth.uid()` (see db/00_supabase_compat.sql) for the duration of the
 * transaction, which is how every game function identifies its caller.
 */
export async function query<T = Record<string, unknown>>(
	userId: string | null,
	text: string,
	params: unknown[] = []
): Promise<T[]> {
	if (dev && !env.DATABASE_URL) {
		return (await import('./db.local')).query<T>(userId, text, params);
	}
	const db = client();
	const [, rows] = await db.transaction([
		db`select set_config('app.user_id', ${userId ?? ''}, true)`,
		db.query(text, params)
	]);
	return rows as T[];
}

/** Builds `select * from public.fn(p_a => $1, ...)`. `fn` and keys come from code, never from input. */
export function rpcSql(fn: string, args: Record<string, unknown>) {
	const keys = Object.keys(args);
	const named = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
	return { text: `select * from public.${fn}(${named})`, params: keys.map((k) => args[k]) };
}

export type RpcResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Call a game function. Table-returning functions yield their rows; scalar
 * (jsonb/void) functions yield the single value. Errors raised in SQL come
 * back as `{ ok: false }` with the function's own message.
 */
export async function rpc<T = null>(
	userId: string | null,
	fn: string,
	args: Record<string, unknown>,
	shape: 'scalar' | 'rows' = 'scalar'
): Promise<RpcResult<T>> {
	try {
		const { text, params } = rpcSql(fn, args);
		const rows = await query(userId, text, params);
		const data = shape === 'rows' ? rows : (rows[0]?.[fn] ?? null);
		return { ok: true, data: data as T };
	} catch (err) {
		console.error(`rpc ${fn} failed`, err);
		return { ok: false, error: err instanceof Error ? err.message : 'Error de base de dades.' };
	}
}
