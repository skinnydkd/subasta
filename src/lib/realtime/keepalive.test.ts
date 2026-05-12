// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { createRealtimeKeepalive } from './keepalive.svelte';

type FakeChannel = {
	_cb: ((status: string) => void) | null;
	subscribe: (cb: (status: string) => void) => FakeChannel;
	_state: string;
};

function fakeChannel(): FakeChannel {
	const ch: FakeChannel = {
		_cb: null,
		_state: 'closed',
		subscribe(cb) {
			ch._cb = cb;
			ch._state = 'joined';
			cb('SUBSCRIBED');
			return ch;
		}
	};
	return ch;
}

function fakeClient() {
	const removed: FakeChannel[] = [];
	return {
		removeChannel: vi.fn((c: FakeChannel) => {
			removed.push(c);
		}),
		_removed: removed
	};
}

describe('createRealtimeKeepalive', () => {
	let onResync: ReturnType<typeof vi.fn>;
	let isAuctionActive: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		onResync = vi.fn();
		isAuctionActive = vi.fn(() => false);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('subscribes channels on start and reports live status', () => {
		const client = fakeClient();
		const ch = fakeChannel();
		const ka = createRealtimeKeepalive({
			client: client as unknown as SupabaseClient,
			channels: () => [ch as unknown as RealtimeChannel],
			onResync: onResync as () => void,
			isAuctionActive: isAuctionActive as () => boolean
		});
		ka.start();
		expect(ka.status).toBe('live');
	});

	it('calls onResync and recreates channels when visibility becomes visible', () => {
		const client = fakeClient();
		let factoryCalls = 0;
		const ka = createRealtimeKeepalive({
			client: client as unknown as SupabaseClient,
			channels: () => {
				factoryCalls++;
				return [fakeChannel() as unknown as RealtimeChannel];
			},
			onResync: onResync as () => void,
			isAuctionActive: isAuctionActive as () => boolean
		});
		ka.start();
		expect(factoryCalls).toBe(1);

		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'visible'
		});
		document.dispatchEvent(new Event('visibilitychange'));

		expect(onResync).toHaveBeenCalled();
		expect(factoryCalls).toBe(2);
	});

	it('flips to offline on window offline event', () => {
		const client = fakeClient();
		const ka = createRealtimeKeepalive({
			client: client as unknown as SupabaseClient,
			channels: () => [fakeChannel() as unknown as RealtimeChannel],
			onResync: onResync as () => void,
			isAuctionActive: isAuctionActive as () => boolean
		});
		ka.start();
		window.dispatchEvent(new Event('offline'));
		expect(ka.status).toBe('offline');
	});

	it('stop() removes channels and detaches listeners', () => {
		const client = fakeClient();
		const ka = createRealtimeKeepalive({
			client: client as unknown as SupabaseClient,
			channels: () => [fakeChannel() as unknown as RealtimeChannel],
			onResync: onResync as () => void,
			isAuctionActive: isAuctionActive as () => boolean
		});
		ka.start();
		ka.stop();
		expect(client.removeChannel).toHaveBeenCalled();
		// After stop, visibility change must not trigger resync.
		onResync.mockClear();
		document.dispatchEvent(new Event('visibilitychange'));
		expect(onResync).not.toHaveBeenCalled();
	});
});
