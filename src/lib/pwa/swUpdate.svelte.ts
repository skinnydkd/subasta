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
		get updateReady() {
			return updateReady;
		},
		init,
		apply
	};
}

export const swUpdate = createStore();
