# Phase 7 — Polish: PWA install + SW update + anti-disconnect

**Date:** 2026-05-12
**Status:** Design (pre-implementation)
**Scope:** Close the three remaining items of Roadmap "Phase 7 — Polish UI" in `CLAUDE.md`. Dark mode is already done (see memory 2026-05-09).

## Goal

Make the app feel like a real installed PWA on mobile, and survive the realistic network/visibility events that happen during a 30–60 minute auction session on phones (screen lock, tab switch, wifi flap, 4G→wifi handoff).

## Non-goals

- Push notifications (permission cost, requires backend).
- Background sync of offline bids (bids are intentionally synchronous server-validated for anti-cheat).
- More cache strategies (fonts, images) — no observed problem.
- Splash screens for iOS — deferred; cost/benefit too low for a friends-only MVP.

## Success criteria

1. On Android Chrome / Edge desktop, an "Instal·la l'app" CTA appears on `/` when the browser fires `beforeinstallprompt`. Click → native install. Dismiss is sticky for 30 days.
2. On iOS Safari, the CTA falls back to a small instructional hint ("Compartir → Afig a inici"). Detected via `navigator.standalone === false && /iPad|iPhone|iPod/.test(navigator.userAgent)`.
3. When a new service worker version is `waiting`, a toast appears in `+layout.svelte` ("Versió nova disponible — Refresca"). Click activates `SKIP_WAITING` and reloads.
4. Inside a room, after any of these events:
   - tab hidden then visible
   - network `offline` → `online`
   - realtime channel emits `CHANNEL_ERROR` / `TIMED_OUT`
     the page re-invalidates data, re-tracks presence, and re-subscribes channels. A small "Reconnectant…" pill shows in the header while any channel is not in `SUBSCRIBED`.
5. While `activeAuction.status === 'active'`, a wake lock is held (silent no-op where unsupported).
6. No regression: existing `tests/e2e/smoke.test.ts` keeps passing.

## Components

### A) `src/lib/pwa/installPrompt.svelte.ts` + `src/lib/components/InstallPrompt.svelte`

- Module-level `$state` rune store that:
  - listens to `beforeinstallprompt` once at first import, stashes the event, exposes `canInstall`, `install()`, `dismiss()`.
  - reads/writes `localStorage` key `subasta:install-dismissed-at` (ISO date). Re-shows only after 30 days.
  - exposes `iosInstallHint` boolean (true when iOS Safari and not standalone and not dismissed).
- `InstallPrompt.svelte` consumes the store, renders nothing when neither flag is true.
- Rendered in `src/routes/+page.svelte` only (the lobby), not in every page.

Tests (vitest): mock `window.addEventListener` + `localStorage`, assert `canInstall` becomes true after dispatching a fake event; assert dismiss persists; assert iOS detection.

### B) SW update prompt

- Edit `src/service-worker.ts`:
  - add `message` listener: `if (e.data?.type === 'SKIP_WAITING') sw.skipWaiting()`.
- New `src/lib/pwa/swUpdate.svelte.ts`:
  - on mount, `navigator.serviceWorker.ready` → listen `updatefound` → on the new worker's `statechange` to `installed` (and `navigator.serviceWorker.controller` truthy), set `updateReady = true`.
  - listen `controllerchange` → reload once (guard against double-reload).
  - export `applyUpdate()` that posts `{ type: 'SKIP_WAITING' }` to the waiting worker.
- `+layout.svelte` mounts the store in a `$effect` (browser only) and renders a fixed-bottom toast when `updateReady`.

### C) Anti-disconnect — `src/lib/realtime/keepalive.svelte.ts`

A small helper that the room page uses to encapsulate connection lifecycle. Public surface:

```ts
export function createRealtimeKeepalive(opts: {
	client: SupabaseClient;
	channels: () => RealtimeChannel[]; // factory; called again on full reset
	onResync: () => void | Promise<void>; // e.g. invalidateAll
	isAuctionActive: () => boolean; // for wake lock
}): {
	status: 'connecting' | 'live' | 'reconnecting' | 'offline';
	start(): void;
	stop(): void;
};
```

Behavior:

- Holds the channel array. `start()` calls `channels()` once and subscribes all.
- Listens `window.addEventListener('online' | 'offline' | 'visibilitychange')`.
  - `offline` → status `'offline'`.
  - `online` or `visibilitychange` to visible → `onResync()`, and if any channel state is not `joined`, remove all + re-create via `channels()` factory + resubscribe.
- Each channel subscription callback updates an internal counter; status is `'live'` when all joined, `'reconnecting'` otherwise.
- Wake lock: when `isAuctionActive()` is true and status is `'live'`, request `navigator.wakeLock.request('screen')`. Release on auction inactive, page hide, or stop. Wrap in try/catch; no-op without the API.

The room page (`src/routes/room/[code]/+page.svelte`) replaces the current `onMount` channel setup with `createRealtimeKeepalive(...)`. Adds a header pill rendering when `keepalive.status !== 'live'`.

### D) Unit tests

- `src/lib/pwa/installPrompt.test.ts` — store behavior.
- `src/lib/realtime/keepalive.test.ts` — mock supabase client, simulate `offline`/`online` and `visibilitychange`, assert resync called, channels recreated.

E2E is **not** included for this phase; manual verification on real mobile (iOS + Android) is the acceptance test. The current Playwright smoke (`tests/e2e/smoke.test.ts`) must continue passing.

## Data flow

```
┌────────────────────┐                ┌──────────────────────┐
│ window events      │   visibility/  │ keepalive.svelte.ts  │
│ online | offline | │── online/      │  - status state      │
│ visibilitychange   │   visible ──▶  │  - channel registry  │
└────────────────────┘                │  - wake lock         │
                                      └──────┬───────────────┘
                                             │ onResync()
                                             ▼
                                      ┌──────────────────────┐
                                      │ invalidateAll()      │
                                      │ + re-track presence  │
                                      └──────────────────────┘
```

```
┌──────────────────────┐  beforeinstallprompt   ┌──────────────────────┐
│ window               │ ─────────────────────▶ │ installPrompt store  │
│ (browser-fired)      │                        │   canInstall = true  │
└──────────────────────┘                        └──────────┬───────────┘
                                                           │ rendered in
                                                           ▼
                                                ┌──────────────────────┐
                                                │ InstallPrompt.svelte │
                                                └──────────────────────┘
```

## Error handling

- `navigator.wakeLock` missing or throws → swallow, no UI.
- `localStorage` quota / disabled → fall back to in-memory (CTA shown every session, that's fine).
- Service worker not supported (very old browser) → skip update store entirely; rest of app works.
- `beforeinstallprompt` never fires (Firefox, already installed) → CTA simply never appears.

## File changes

New:

- `src/lib/pwa/installPrompt.svelte.ts`
- `src/lib/pwa/swUpdate.svelte.ts`
- `src/lib/components/InstallPrompt.svelte`
- `src/lib/components/UpdateToast.svelte`
- `src/lib/components/ConnectionPill.svelte`
- `src/lib/realtime/keepalive.svelte.ts`
- `src/lib/pwa/installPrompt.test.ts`
- `src/lib/realtime/keepalive.test.ts`

Edited:

- `src/service-worker.ts` (+ `SKIP_WAITING` handler)
- `src/routes/+layout.svelte` (+ `UpdateToast`)
- `src/routes/+page.svelte` (+ `InstallPrompt`)
- `src/routes/room/[code]/+page.svelte` (replace onMount realtime block, add `ConnectionPill`)

Net code estimate: ~350 lines added, ~40 removed.

## Open questions / decisions

- **iOS hint UX**: small inline banner vs modal? Recommendation: inline banner under the "Crea sala" CTA so it doesn't block anything. Decided: inline.
- **Wake lock scope**: only during active auction, or whole room? Recommendation: only active auction (saves battery during lobby/voting). Decided: active auction only.
- **30-day dismiss window for install CTA**: arbitrary. Acceptable as a starting point; revisit if telemetry ever shows it as nagging.

## Out of scope (future)

- iOS splash screens (separate script + assets).
- Stale-while-revalidate for fonts (perf perceived as fine).
- Offline bid queue (anti-cheat says no).
