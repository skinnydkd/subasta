export type KeepaliveStatus = 'live' | 'offline';

export interface KeepaliveOpts {
	onResync: () => void | Promise<void>;
	isAuctionActive: () => boolean;
}

const isBrowser = typeof window !== 'undefined';

/**
 * Keeps a room page honest while the tab comes and goes: resyncs when the tab
 * becomes visible or the network returns, tracks online/offline, and holds a
 * screen wake lock while an auction is live. State itself arrives by polling.
 */
export function createKeepalive(opts: KeepaliveOpts) {
	let status = $state<KeepaliveStatus>('live');
	let wakeLock: WakeLockSentinel | null = null;
	let started = false;

	async function maybeAcquireWakeLock() {
		if (!isBrowser) return;
		if (!('wakeLock' in navigator)) return;
		if (!opts.isAuctionActive()) return;
		if (document.visibilityState !== 'visible') return;
		if (wakeLock) return;
		try {
			wakeLock = await navigator.wakeLock.request('screen');
			wakeLock?.addEventListener('release', () => {
				wakeLock = null;
			});
		} catch {
			// wake lock not granted — ignore
			wakeLock = null;
		}
	}

	function releaseWakeLock() {
		try {
			wakeLock?.release();
		} catch {
			// release failed — ignore
		}
		wakeLock = null;
	}

	function handleVisibilityChange() {
		if (document.visibilityState !== 'visible') {
			releaseWakeLock();
			return;
		}
		void Promise.resolve(opts.onResync());
		void maybeAcquireWakeLock();
	}

	function handleOnline() {
		status = 'live';
		handleVisibilityChange();
	}

	function handleOffline() {
		status = 'offline';
		releaseWakeLock();
	}

	function start() {
		if (started || !isBrowser) return;
		started = true;
		if (!navigator.onLine) status = 'offline';
		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);
		void maybeAcquireWakeLock();
	}

	function stop() {
		if (!started) return;
		started = false;
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		window.removeEventListener('online', handleOnline);
		window.removeEventListener('offline', handleOffline);
		releaseWakeLock();
	}

	return {
		get status() {
			return status;
		},
		start,
		stop,
		refreshWakeLock: maybeAcquireWakeLock
	};
}
