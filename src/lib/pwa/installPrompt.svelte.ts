const DISMISS_KEY = 'subasta:install-dismissed-at';
const DISMISS_WINDOW_MS = 30 * 24 * 3600 * 1000;

const isBrowser = typeof window !== 'undefined';

type BIPEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function dismissedRecently(): boolean {
	if (!isBrowser) return false;
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
	if (!isBrowser) return false;
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

	function init() {
		if (!isBrowser || initialized) return;
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
		} catch {
			// storage unavailable — ignore
		}
	}

	return {
		get canInstall() {
			return captured !== null && !dismissed;
		},
		get iosInstallHint() {
			return isIosSafariNonStandalone() && !dismissed;
		},
		init,
		install,
		dismiss
	};
}

export const installPrompt = createStore();
