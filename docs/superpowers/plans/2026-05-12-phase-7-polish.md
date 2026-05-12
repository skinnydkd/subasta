# Phase 7 — Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship PWA install affordance, service-worker update toast, and realtime keepalive (visibility/online/offline reconnect + wake lock) for the in-room experience.

**Architecture:** Three independent, layered subsystems behind small Svelte 5 rune-based stores. Each store is plain TypeScript with reactive state, consumed by thin Svelte components. The room page swaps its `onMount` channel block for a `createRealtimeKeepalive` helper. No backend changes.

**Tech Stack:** SvelteKit 2 / Svelte 5 (runes), TypeScript strict, Tailwind v4, Vitest (`vitest-browser-svelte` for DOM bits), `@supabase/supabase-js` Realtime.

**Spec:** `docs/superpowers/specs/2026-05-12-phase-7-polish-design.md`

---

## File Structure

New files:
- `src/lib/pwa/installPrompt.svelte.ts` — install store (capture event, dismiss, iOS hint).
- `src/lib/pwa/swUpdate.svelte.ts` — SW update store (detect waiting worker, apply update).
- `src/lib/realtime/keepalive.svelte.ts` — channel lifecycle + wake lock + status.
- `src/lib/components/InstallPrompt.svelte` — install CTA / iOS hint UI.
- `src/lib/components/UpdateToast.svelte` — "Versió nova" toast UI.
- `src/lib/components/ConnectionPill.svelte` — header pill showing "Reconnectant…".
- `src/lib/pwa/installPrompt.test.ts` — vitest unit tests.
- `src/lib/realtime/keepalive.test.ts` — vitest unit tests.

Edited files:
- `src/service-worker.ts` — add `SKIP_WAITING` message handler.
- `src/routes/+layout.svelte` — mount `UpdateToast`.
- `src/routes/+page.svelte` — mount `InstallPrompt`.
- `src/routes/room/[code]/+page.svelte` — replace realtime `onMount` block, mount `ConnectionPill`.

Boundaries:
- PWA stores are browser-only (`if (!browser) return`), no SSR work.
- The keepalive helper takes a `channels()` factory so callers control what to subscribe; it does not know about specific tables.
- UI components do not access `localStorage` or `navigator` directly — they read from stores.

---

## Task 1: Install prompt store

**Files:**
- Create: `src/lib/pwa/installPrompt.svelte.ts`
- Test: `src/lib/pwa/installPrompt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/pwa/installPrompt.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Helpers to reset module state between tests.
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
    // Force non-iOS UA so the hint branch is off by default.
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/pwa/installPrompt.test.ts`
Expected: FAIL — module `./installPrompt.svelte` cannot be resolved.

- [ ] **Step 3: Implement the store**

```ts
// src/lib/pwa/installPrompt.svelte.ts
import { browser } from '$app/environment';

const DISMISS_KEY = 'subasta:install-dismissed-at';
const DISMISS_WINDOW_MS = 30 * 24 * 3600 * 1000;

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function dismissedRecently(): boolean {
  if (!browser) return false;
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Date.parse(raw);
    if (Number.isNaN(at)) return false;
    return Date.now() - at < DISMISS_WINDOW_MS;
  } catch {
    return false;
  }
}

function isIosSafariNonStandalone(): boolean {
  if (!browser) return false;
  const ua = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua);
  // @ts-expect-error: ios-only nav property
  const standalone: boolean = navigator.standalone === true;
  return isIos && !standalone;
}

function createStore() {
  let captured = $state<BIPEvent | null>(null);
  let dismissed = $state(false);
  let initialized = false;

  const canInstall = $derived(captured !== null && !dismissed);
  const iosInstallHint = $derived(isIosSafariNonStandalone() && !dismissed);

  function init() {
    if (!browser || initialized) return;
    initialized = true;
    dismissed = dismissedRecently();
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      captured = e as BIPEvent;
    });
    window.addEventListener('appinstalled', () => {
      captured = null;
      dismissed = true;
    });
  }

  async function install() {
    if (!captured) return;
    await captured.prompt();
    const choice = await captured.userChoice;
    if (choice.outcome === 'accepted') {
      captured = null;
    }
  }

  function dismiss() {
    dismissed = true;
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch {}
  }

  return {
    get canInstall() { return canInstall; },
    get iosInstallHint() { return iosInstallHint; },
    init,
    install,
    dismiss
  };
}

export const installPrompt = createStore();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/pwa/installPrompt.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pwa/installPrompt.svelte.ts src/lib/pwa/installPrompt.test.ts
git commit -m "feat(pwa): install prompt store with iOS hint and 30-day dismiss"
```

---

## Task 2: Install prompt component + wire to home

**Files:**
- Create: `src/lib/components/InstallPrompt.svelte`
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Implement the component**

```svelte
<!-- src/lib/components/InstallPrompt.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { installPrompt } from '$lib/pwa/installPrompt.svelte';

  onMount(() => installPrompt.init());
</script>

{#if installPrompt.canInstall}
  <div class="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-3 py-2 text-sm">
    <span>Instal·la l'app per a una millor experiència.</span>
    <div class="flex gap-2">
      <button
        type="button"
        onclick={() => installPrompt.install()}
        class="rounded-[var(--radius-sm)] bg-[color:var(--color-accent)] px-3 py-1 text-xs font-medium uppercase tracking-wider text-white hover:bg-[color:var(--color-accent-hover)]"
      >
        Instal·la
      </button>
      <button
        type="button"
        onclick={() => installPrompt.dismiss()}
        class="rounded-[var(--radius-sm)] px-2 py-1 text-xs text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
        aria-label="Tanca"
      >
        ✕
      </button>
    </div>
  </div>
{:else if installPrompt.iosInstallHint}
  <div class="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-xs text-[color:var(--color-text-muted)]">
    <span>Per instal·lar: toca <span class="text-[color:var(--color-text)]">Compartir</span> → <span class="text-[color:var(--color-text)]">Afig a inici</span>.</span>
    <button
      type="button"
      onclick={() => installPrompt.dismiss()}
      class="text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text)]"
      aria-label="Tanca"
    >
      ✕
    </button>
  </div>
{/if}
```

- [ ] **Step 2: Mount it in the home route**

Modify `src/routes/+page.svelte`. Add the import near the existing imports and render the component inside `<main>` directly under `<header>` (so it sits above the auth/CTA block).

Add to the script block (after the existing imports):

```ts
import InstallPrompt from '$lib/components/InstallPrompt.svelte';
```

Add to the markup right after the `</header>` closing tag:

```svelte
<InstallPrompt />
```

- [ ] **Step 3: Manually verify in dev**

Run: `pnpm dev`
Open the home page in a Chromium browser. Open DevTools → Application → Manifest. Force the install prompt (three-dots menu → "Install app"). The CTA should appear; clicking Instal·la triggers the native prompt; clicking ✕ hides it and persists in localStorage under `subasta:install-dismissed-at`.

Expected: CTA visible on first load in Chromium, hidden after dismiss reload, and the iOS variant visible if you spoof an iPhone User-Agent in DevTools.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/InstallPrompt.svelte src/routes/+page.svelte
git commit -m "feat(pwa): install CTA + iOS hint on the lobby"
```

---

## Task 3: SW update store

**Files:**
- Create: `src/lib/pwa/swUpdate.svelte.ts`
- Modify: `src/service-worker.ts`

- [ ] **Step 1: Add the SKIP_WAITING handler to the service worker**

Modify `src/service-worker.ts`. After the existing `fetch` listener (after line 70, before `export {}`), add:

```ts
sw.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    sw.skipWaiting();
  }
});
```

- [ ] **Step 2: Implement the update store**

```ts
// src/lib/pwa/swUpdate.svelte.ts
import { browser } from '$app/environment';

function createStore() {
  let updateReady = $state(false);
  let waiting: ServiceWorker | null = null;
  let reloading = false;
  let initialized = false;

  async function init() {
    if (!browser || initialized) return;
    initialized = true;
    if (!('serviceWorker' in navigator)) return;

    const reg = await navigator.serviceWorker.ready;

    // If a worker is already waiting on first visit, expose it.
    if (reg.waiting && navigator.serviceWorker.controller) {
      waiting = reg.waiting;
      updateReady = true;
    }

    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          waiting = nw;
          updateReady = true;
        }
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }

  function apply() {
    if (!waiting) return;
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  return {
    get updateReady() { return updateReady; },
    init,
    apply
  };
}

export const swUpdate = createStore();
```

- [ ] **Step 3: Type-check**

Run: `pnpm check`
Expected: 0 errors. (If `$state`/`$derived` outside `.svelte` files complains, ensure the file ends in `.svelte.ts` — it already does.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/pwa/swUpdate.svelte.ts src/service-worker.ts
git commit -m "feat(pwa): service worker update store + SKIP_WAITING handler"
```

---

## Task 4: Update toast component + wire to layout

**Files:**
- Create: `src/lib/components/UpdateToast.svelte`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Implement the component**

```svelte
<!-- src/lib/components/UpdateToast.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { swUpdate } from '$lib/pwa/swUpdate.svelte';

  onMount(() => swUpdate.init());
</script>

{#if swUpdate.updateReady}
  <div
    role="status"
    class="fixed inset-x-0 bottom-0 z-50 mx-auto mb-4 flex max-w-md items-center justify-between gap-3 rounded-[var(--radius)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-4 py-3 text-sm shadow-lg"
    style="margin-left: max(1rem, env(safe-area-inset-left)); margin-right: max(1rem, env(safe-area-inset-right)); margin-bottom: max(1rem, env(safe-area-inset-bottom));"
  >
    <span>Versió nova disponible.</span>
    <button
      type="button"
      onclick={() => swUpdate.apply()}
      class="rounded-[var(--radius-sm)] bg-[color:var(--color-accent)] px-3 py-1 text-xs font-medium uppercase tracking-wider text-white hover:bg-[color:var(--color-accent-hover)]"
    >
      Refresca
    </button>
  </div>
{/if}
```

- [ ] **Step 2: Mount it globally**

Modify `src/routes/+layout.svelte`. Replace the entire file with:

```svelte
<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import UpdateToast from '$lib/components/UpdateToast.svelte';

  let { children }: { children: Snippet } = $props();
</script>

{@render children()}
<UpdateToast />
```

- [ ] **Step 3: Manual verification**

Run: `pnpm build && pnpm preview`
Open in Chromium. In DevTools → Application → Service Workers, tick "Update on reload". Make a trivial change in `src/service-worker.ts` (e.g. add a comment), rebuild in another shell, then reload preview. The toast should appear; clicking Refresca reloads with the new worker active.

Expected: toast visible after the new worker installs while the old one still controls the page.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/UpdateToast.svelte src/routes/+layout.svelte
git commit -m "feat(pwa): toast prompting reload when a new SW is waiting"
```

---

## Task 5: Realtime keepalive helper

**Files:**
- Create: `src/lib/realtime/keepalive.svelte.ts`
- Test: `src/lib/realtime/keepalive.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/realtime/keepalive.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    removeChannel: vi.fn((c: FakeChannel) => { removed.push(c); }),
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
      // @ts-expect-error fake
      client,
      channels: () => [ch],
      onResync,
      isAuctionActive
    });
    ka.start();
    expect(ka.status).toBe('live');
  });

  it('calls onResync and recreates channels when visibility becomes visible', () => {
    const client = fakeClient();
    let factoryCalls = 0;
    const ka = createRealtimeKeepalive({
      // @ts-expect-error fake
      client,
      channels: () => {
        factoryCalls++;
        return [fakeChannel()];
      },
      onResync,
      isAuctionActive
    });
    ka.start();
    expect(factoryCalls).toBe(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true, value: 'visible'
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(onResync).toHaveBeenCalled();
    expect(factoryCalls).toBe(2);
  });

  it('flips to offline on window offline event', () => {
    const client = fakeClient();
    const ka = createRealtimeKeepalive({
      // @ts-expect-error fake
      client,
      channels: () => [fakeChannel()],
      onResync,
      isAuctionActive
    });
    ka.start();
    window.dispatchEvent(new Event('offline'));
    expect(ka.status).toBe('offline');
  });

  it('stop() removes channels and detaches listeners', () => {
    const client = fakeClient();
    const ka = createRealtimeKeepalive({
      // @ts-expect-error fake
      client,
      channels: () => [fakeChannel()],
      onResync,
      isAuctionActive
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/realtime/keepalive.test.ts`
Expected: FAIL — module `./keepalive.svelte` not found.

- [ ] **Step 3: Implement the helper**

```ts
// src/lib/realtime/keepalive.svelte.ts
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';

export type KeepaliveStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface KeepaliveOpts {
  client: SupabaseClient;
  channels: () => RealtimeChannel[];
  onResync: () => void | Promise<void>;
  isAuctionActive: () => boolean;
}

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
    if (!browser) return;
    // @ts-expect-error: not all TS lib versions ship WakeLock types
    if (!navigator.wakeLock) return;
    if (!opts.isAuctionActive()) return;
    if (document.visibilityState !== 'visible') return;
    if (wakeLock) return;
    try {
      // @ts-expect-error: see above
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

  async function handleVisibilityChange() {
    if (document.visibilityState !== 'visible') {
      releaseWakeLock();
      return;
    }
    await Promise.resolve(opts.onResync());
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
    if (started || !browser) return;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/realtime/keepalive.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/realtime/keepalive.svelte.ts src/lib/realtime/keepalive.test.ts
git commit -m "feat(realtime): keepalive helper with visibility/online reconnect + wake lock"
```

---

## Task 6: Connection pill component

**Files:**
- Create: `src/lib/components/ConnectionPill.svelte`

- [ ] **Step 1: Implement the component**

```svelte
<!-- src/lib/components/ConnectionPill.svelte -->
<script lang="ts">
  import type { KeepaliveStatus } from '$lib/realtime/keepalive.svelte';

  let { status }: { status: KeepaliveStatus } = $props();

  const label = $derived(
    status === 'live' ? 'En directe' :
    status === 'offline' ? 'Sense connexió' :
    status === 'reconnecting' ? 'Reconnectant…' :
    'Connectant…'
  );

  const color = $derived(
    status === 'live' ? 'var(--color-success)' :
    status === 'offline' ? 'var(--color-danger)' :
    'var(--color-warning)'
  );
</script>

{#if status !== 'live'}
  <span
    role="status"
    class="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-2 py-0.5 text-[10px] uppercase tracking-wider"
    style="color: {color};"
  >
    <span class="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style="background: {color};"></span>
    {label}
  </span>
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/ConnectionPill.svelte
git commit -m "feat(ui): connection pill for the room header"
```

---

## Task 7: Wire keepalive into the room page

**Files:**
- Modify: `src/routes/room/[code]/+page.svelte`

- [ ] **Step 1: Replace the realtime onMount block**

Open `src/routes/room/[code]/+page.svelte`. Find the existing `onMount(() => { ... })` block that creates `dbChannel` and `presenceChannel` (lines ~243–289). Replace ONLY that block with the code below, and add the necessary imports at the top of the `<script>` section.

Add these imports near the other imports at the top of `<script lang="ts">`:

```ts
import { createRealtimeKeepalive } from '$lib/realtime/keepalive.svelte';
import ConnectionPill from '$lib/components/ConnectionPill.svelte';
```

Replace the realtime `onMount(() => { ... })` block with:

```ts
let connectionStatus = $state<'connecting' | 'live' | 'reconnecting' | 'offline'>('connecting');

onMount(() => {
  if (isReadOnly) {
    if (room.status === 'finished') return;
    const id = setInterval(() => invalidateAll(), 3000);
    return () => clearInterval(id);
  }

  const supabase = createClient();

  const keepalive = createRealtimeKeepalive({
    client: supabase,
    channels: () => {
      const db = supabase
        .channel(`room:${room.id}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'auctions', filter: `room_id=eq.${room.id}` },
          () => invalidateAll())
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${room.id}` },
          () => invalidateAll())
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
          () => invalidateAll());

      const presence = supabase.channel(`room:${room.id}:presence`, {
        config: { presence: { key: myUserId ?? 'anon' } }
      })
        .on('presence', { event: 'sync' }, () => {
          const state = presence.presenceState();
          onlineUserIds = new Set(Object.keys(state));
        });

      // Track presence once the channel is ready. The subscribe callback
      // inside keepalive handles status; we hook it here for the side-effect
      // of `track`.
      const origSubscribe = presence.subscribe.bind(presence);
      presence.subscribe = (cb?: (status: string) => void) => {
        return origSubscribe(async (status: string) => {
          cb?.(status);
          if (status === 'SUBSCRIBED' && myUserId) {
            await presence.track({ user_id: myUserId, online_at: Date.now() });
          }
        });
      };

      return [db, presence];
    },
    onResync: () => { invalidateAll(); },
    isAuctionActive: () => activeAuction?.status === 'active'
  });

  keepalive.start();

  // Mirror keepalive.status into a reactive local so the template renders.
  const statusInterval = setInterval(() => {
    if (keepalive.status !== connectionStatus) connectionStatus = keepalive.status;
  }, 200);

  // Re-evaluate wake lock when the active auction transitions to/from 'active'.
  const unsubscribeAuctionWatch = $effect.root(() => {
    $effect(() => {
      // Touch the derived state so the effect runs on changes.
      const _ = activeAuction?.status;
      void keepalive.refreshWakeLock();
    });
  });

  return () => {
    clearInterval(statusInterval);
    unsubscribeAuctionWatch();
    keepalive.stop();
  };
});
```

- [ ] **Step 2: Render the pill in the header**

Find the `<header class="flex items-center justify-between gap-3">` block. Inside the right-hand `<div class="flex items-center gap-2">` (the one containing the spectator badge / theme name / mute button), insert the `<ConnectionPill />` BEFORE the spectator `{#if isReadOnly}` block:

```svelte
{#if !isReadOnly}
  <ConnectionPill status={connectionStatus} />
{/if}
```

- [ ] **Step 3: Type-check**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 4: Run the existing test suites**

Run: `pnpm test:unit -- --run`
Expected: all tests pass, including the two new ones from tasks 1 and 5.

- [ ] **Step 5: Manual verification**

Run: `pnpm dev`. Open a room in two browser windows. In one:
1. DevTools → Network → toggle Offline → pill turns to "Sense connexió".
2. Toggle Online → pill should briefly show "Reconnectant…" then disappear.
3. Switch tabs for 20+ seconds; on return, state should be in sync (members + active auction up to date).
4. With an auction active on a laptop, observe `navigator.wakeLock` is held (no UI; check via DevTools "Sources → Application → Service Workers → wake locks" or `navigator.wakeLock` in console; on mobile, screen does not lock).

Expected: pill behaviour as described; no console errors; existing e2e smoke continues to work.

- [ ] **Step 6: Run e2e smoke**

Run: `pnpm test:e2e`
Expected: all e2e tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/routes/room/[code]/+page.svelte
git commit -m "feat(realtime): keepalive + connection pill in the room page"
```

---

## Task 8: Final sweep

**Files:** (no code changes)

- [ ] **Step 1: Lint + format**

Run: `pnpm lint`
Expected: clean.

If prettier complains, run `pnpm format` and re-stage any modified files in a follow-up commit:

```bash
git add -A
git commit -m "chore(format): prettier sweep after phase 7"
```

- [ ] **Step 2: Full build sanity check**

Run: `pnpm build`
Expected: build succeeds. Confirm the service worker bundle is emitted under `.svelte-kit/output/client/`.

- [ ] **Step 3: Manual install test on a mobile device (acceptance gate)**

Deploy a preview (push branch → Cloudflare Pages preview URL) and on a real iPhone + Android phone:
1. Visit the preview URL on Android Chrome → CTA appears → install → app launches standalone.
2. Visit on iPhone Safari → iOS hint appears → add via Share → Afig a inici → app launches.
3. Join a room from two phones, lock one phone for 60s, unlock → UI still in sync; pill is `live`.
4. Toggle airplane mode briefly during a bid → pill shows offline/reconnecting → no stuck UI after recovery.

Expected: all four behaviors confirmed.

- [ ] **Step 4: Update the roadmap in CLAUDE.md**

Modify `CLAUDE.md` "Estat actual / roadmap": flip the line
`7. ⏳ Polish UI (dark mode "no-IA", PWA install, anti-disconnect)`
to
`7. ✅ Polish UI (dark mode "no-IA", PWA install, anti-disconnect)`

Commit:

```bash
git add CLAUDE.md
git commit -m "docs: mark phase 7 polish complete"
```

---

## Self-review notes

- Spec coverage: A (Tasks 1–2), B (Tasks 3–4), C (Tasks 5–7), D was out of scope and remains so. ✓
- Type consistency: `KeepaliveStatus` is the exported type; `connectionStatus` in the room page mirrors it; `ConnectionPill` `status` prop uses the same union. ✓
- The room-page `statusInterval` polling at 200ms is a deliberate, simple bridge between the keepalive helper's rune state (defined in a `.svelte.ts` module) and the consuming `.svelte` component. A cleaner alternative would be exposing a subscribable, but the polling is cheap and keeps the helper's surface minimal — acceptable for this scale.
- The `presence.subscribe` monkey-patch keeps the original tracking semantics without adding a `onSubscribed` hook to the keepalive helper API. It is local to one factory call and disappears when the channel is torn down.
