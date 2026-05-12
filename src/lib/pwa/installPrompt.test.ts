// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

async function freshImport() {
	vi.resetModules();
	return await import('./installPrompt.svelte');
}

function fireBeforeInstallPrompt() {
	const ev = new Event('beforeinstallprompt') as Event & {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
		preventDefault: () => void;
	};
	ev.prompt = vi.fn(async () => {});
	Object.defineProperty(ev, 'userChoice', {
		value: Promise.resolve({ outcome: 'accepted' as const })
	});
	window.dispatchEvent(ev);
	return ev;
}

describe('installPrompt store', () => {
	beforeEach(() => {
		localStorage.clear();
		Object.defineProperty(navigator, 'userAgent', {
			configurable: true,
			value: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120'
		});
	});

	it('exposes canInstall=false before the event fires', async () => {
		const mod = await freshImport();
		mod.installPrompt.init();
		expect(mod.installPrompt.canInstall).toBe(false);
	});

	it('flips canInstall to true after beforeinstallprompt', async () => {
		const mod = await freshImport();
		mod.installPrompt.init();
		fireBeforeInstallPrompt();
		expect(mod.installPrompt.canInstall).toBe(true);
	});

	it('dismiss() hides the CTA and persists for 30 days', async () => {
		const mod = await freshImport();
		mod.installPrompt.init();
		fireBeforeInstallPrompt();
		mod.installPrompt.dismiss();
		expect(mod.installPrompt.canInstall).toBe(false);
		expect(localStorage.getItem('subasta:install-dismissed-at')).toBeTruthy();
	});

	it('respects an existing dismiss within the last 30 days', async () => {
		const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
		localStorage.setItem('subasta:install-dismissed-at', yesterday);
		const mod = await freshImport();
		mod.installPrompt.init();
		fireBeforeInstallPrompt();
		expect(mod.installPrompt.canInstall).toBe(false);
	});

	it('shows the iOS hint on iPhone Safari when not standalone', async () => {
		Object.defineProperty(navigator, 'userAgent', {
			configurable: true,
			value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605'
		});
		// @ts-expect-error: ios-only nav property
		navigator.standalone = false;
		const mod = await freshImport();
		mod.installPrompt.init();
		expect(mod.installPrompt.iosInstallHint).toBe(true);
	});
});
