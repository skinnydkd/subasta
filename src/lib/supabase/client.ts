import { createBrowserClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { Database } from '$lib/types/db';

export function createClient() {
	return createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => (isBrowser() ? parseCookies(document.cookie) : [])
		}
	});
}

function parseCookies(raw: string): { name: string; value: string }[] {
	if (!raw) return [];
	return raw.split('; ').map((c) => {
		const [name, ...rest] = c.split('=');
		return { name, value: rest.join('=') };
	});
}
