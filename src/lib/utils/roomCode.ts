// 6-char alphanumeric code, no ambiguous chars (0/O, 1/I/L).
// Use crypto.getRandomValues for unbiased uniform sampling.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
	const buf = new Uint32Array(6);
	crypto.getRandomValues(buf);
	let out = '';
	for (let i = 0; i < 6; i++) {
		out += ALPHABET[buf[i] % ALPHABET.length];
	}
	return out;
}

export function isValidRoomCode(code: string): boolean {
	if (code.length !== 6) return false;
	for (const ch of code) {
		if (!ALPHABET.includes(ch)) return false;
	}
	return true;
}

export function normalizeRoomCode(input: string): string {
	return input.trim().toUpperCase();
}
