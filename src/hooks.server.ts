import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { SESSION_COOKIE, verifySession } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
	if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set');
	const id = await verifySession(event.cookies.get(SESSION_COOKIE), env.SESSION_SECRET);
	event.locals.user = id ? { id } : null;
	return resolve(event);
};
