import { describe, it, expect } from 'vitest';
import { signSession, verifySession } from './session';

const id = '3f2b8c1e-0000-4000-8000-000000000001';

describe('session cookie', () => {
	it('round-trips a signed id', async () => {
		expect(await verifySession(await signSession(id, 's3cret'), 's3cret')).toBe(id);
	});

	it('rejects a token signed with another secret', async () => {
		expect(await verifySession(await signSession(id, 'other'), 's3cret')).toBeNull();
	});

	it('rejects a swapped id with a valid-looking signature', async () => {
		const sig = (await signSession(id, 's3cret')).split('.')[1];
		expect(await verifySession(`${id.replace(/1$/, '2')}.${sig}`, 's3cret')).toBeNull();
	});

	it('rejects missing or malformed tokens', async () => {
		for (const t of [undefined, '', id, `${id}.`, `${id}.zz`, '.abcd']) {
			expect(await verifySession(t, 's3cret')).toBeNull();
		}
	});
});
