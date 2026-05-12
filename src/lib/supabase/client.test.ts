// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub SvelteKit's $env import so the module can load under vitest.
vi.mock('$env/static/public', () => ({
	PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
	PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key'
}));

describe('createClient (browser supabase client)', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('constructs without throwing — both getAll and setAll cookie methods must be configured', async () => {
		const { createClient } = await import('./client');
		// The @supabase/ssr browser client validates cookie methods at construction.
		// Missing setAll → throws synchronously.
		expect(() => createClient()).not.toThrow();
	});
});
