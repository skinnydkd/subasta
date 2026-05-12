import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export type KeepaliveStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface KeepaliveOpts {
  client: SupabaseClient;
  channels: () => RealtimeChannel[];
  onResync: () => void | Promise<void>;
  isAuctionActive: () => boolean;
}

const isBrowser = typeof window !== 'undefined';

export function createRealtimeKeepalive(opts: KeepaliveOpts) {
  let status = $state<KeepaliveStatus>('connecting');
  let channels: RealtimeChannel[] = [];
  let wakeLock: WakeLockSentinel | null = null;
  let started = false;

  function subscribeAll() {
    let joined = 0;
    for (const ch of channels) {
      ch.subscribe((s) => {
        if (s === 'SUBSCRIBED') {
          joined++;
          if (joined >= channels.length) status = 'live';
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          status = 'reconnecting';
        }
      });
    }
  }

  function buildChannels() {
    channels = opts.channels();
    subscribeAll();
  }

  function teardownChannels() {
    for (const ch of channels) {
      try { opts.client.removeChannel(ch); } catch {}
    }
    channels = [];
  }

  async function maybeAcquireWakeLock() {
    if (!isBrowser) return;
    if (!('wakeLock' in navigator)) return;
    if (!opts.isAuctionActive()) return;
    if (document.visibilityState !== 'visible') return;
    if (wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock?.addEventListener('release', () => { wakeLock = null; });
    } catch {
      wakeLock = null;
    }
  }

  function releaseWakeLock() {
    try { wakeLock?.release(); } catch {}
    wakeLock = null;
  }

  function handleVisibilityChange() {
    if (document.visibilityState !== 'visible') {
      releaseWakeLock();
      return;
    }
    void Promise.resolve(opts.onResync());
    teardownChannels();
    buildChannels();
    void maybeAcquireWakeLock();
  }

  function handleOnline() {
    status = 'connecting';
    void handleVisibilityChange();
  }

  function handleOffline() {
    status = 'offline';
    releaseWakeLock();
  }

  function start() {
    if (started || !isBrowser) return;
    started = true;
    buildChannels();
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
    teardownChannels();
    releaseWakeLock();
  }

  return {
    get status() { return status; },
    start,
    stop,
    refreshWakeLock: maybeAcquireWakeLock
  };
}
