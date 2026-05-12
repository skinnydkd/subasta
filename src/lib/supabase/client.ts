import { createBrowserClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { Database } from '$lib/types/db';

export function createClient() {
	return createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => (isBrowser() ? parseCookies(document.cookie) : []),
			setAll: (cookiesToSet) => {
				if (!isBrowser()) return;
				for (const { name, value, options } of cookiesToSet) {
					document.cookie = serializeCookie(name, value, options);
				}
			}
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

type CookieOptions = {
	maxAge?: number;
	expires?: Date;
	path?: string;
	domain?: string;
	sameSite?: 'lax' | 'strict' | 'none' | boolean;
	secure?: boolean;
};

function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
	let str = `${name}=${value}`;
	const path = options.path ?? '/';
	str += `; path=${path}`;
	if (options.maxAge != null) str += `; max-age=${options.maxAge}`;
	if (options.expires) str += `; expires=${options.expires.toUTCString()}`;
	if (options.domain) str += `; domain=${options.domain}`;
	if (options.secure) str += `; secure`;
	if (options.sameSite != null && options.sameSite !== false) {
		const s = options.sameSite === true ? 'strict' : options.sameSite;
		str += `; samesite=${s}`;
	}
	return str;
}
