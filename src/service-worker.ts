/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `subasta-${version}`;

// Precache build artifacts (JS/CSS/fonts) and static files (icons, manifest).
// Skip HTML — SvelteKit serves SSR pages, never cache them on disk.
const PRECACHE: string[] = [...build, ...files.filter((f) => !f.endsWith('.html'))];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(PRECACHE);
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Don't intercept cross-origin requests (Supabase, Google Fonts, …).
	if (url.origin !== sw.location.origin) return;

	// Don't intercept page navigations / HTML responses — SSR pages must
	// always come fresh from the server (different per-user state).
	if (event.request.mode === 'navigate') return;
	if (event.request.headers.get('accept')?.includes('text/html')) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			const cached = await cache.match(event.request);
			if (cached) return cached;

			try {
				const response = await fetch(event.request);
				if (response.status === 200 && response.type === 'basic') {
					cache.put(event.request, response.clone());
				}
				return response;
			} catch (err) {
				const fallback = await cache.match(event.request);
				if (fallback) return fallback;
				throw err;
			}
		})()
	);
});

sw.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') {
		sw.skipWaiting();
	}
});

export {};
