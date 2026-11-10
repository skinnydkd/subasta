// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createKeepalive } from './keepalive.svelte';

describe('createKeepalive', () => {
	let onResync: ReturnType<typeof vi.fn>;
	const make = () =>
		createKeepalive({ onResync: onResync as () => void, isAuctionActive: () => false });

	beforeEach(() => {
		onResync = vi.fn();
	});

	it('is live on start', () => {
		const ka = make();
		ka.start();
		expect(ka.status).toBe('live');
		ka.stop();
	});

	it('resyncs when the tab becomes visible', () => {
		const ka = make();
		ka.start();
		document.dispatchEvent(new Event('visibilitychange'));
		expect(onResync).toHaveBeenCalledTimes(1);
		ka.stop();
	});

	it('flips to offline and back, resyncing on return', () => {
		const ka = make();
		ka.start();
		window.dispatchEvent(new Event('offline'));
		expect(ka.status).toBe('offline');
		window.dispatchEvent(new Event('online'));
		expect(ka.status).toBe('live');
		expect(onResync).toHaveBeenCalledTimes(1);
		ka.stop();
	});

	it('stop() detaches listeners', () => {
		const ka = make();
		ka.start();
		ka.stop();
		document.dispatchEvent(new Event('visibilitychange'));
		expect(onResync).not.toHaveBeenCalled();
	});
});
