// Identity = a random user id in an httpOnly cookie, signed with HMAC-SHA256 so
// nobody can claim someone else's id. No accounts: losing the cookie loses the identity.

export const SESSION_COOKIE = 'uid';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

const enc = new TextEncoder();

function key(secret: string) {
	return crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

const toHex = (buf: ArrayBuffer) =>
	[...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
	if (!/^([0-9a-f]{2})+$/.test(hex)) return null;
	return new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)));
}

export async function signSession(userId: string, secret: string): Promise<string> {
	const sig = await crypto.subtle.sign('HMAC', await key(secret), enc.encode(userId));
	return `${userId}.${toHex(sig)}`;
}

/** Returns the user id if the token is intact, else null. */
export async function verifySession(
	token: string | undefined,
	secret: string
): Promise<string | null> {
	if (!token) return null;
	const dot = token.lastIndexOf('.');
	if (dot < 1) return null;
	const userId = token.slice(0, dot);
	const sig = fromHex(token.slice(dot + 1));
	if (!sig) return null;
	const ok = await crypto.subtle.verify('HMAC', await key(secret), sig, enc.encode(userId));
	return ok ? userId : null;
}
