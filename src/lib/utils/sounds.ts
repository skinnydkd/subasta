/**
 * Tiny synthesized sound effects via Web Audio. No audio assets — every
 * sound is generated on demand. The AudioContext is suspended until the
 * first user gesture; call enableAudio() from a click handler to unlock.
 *
 * Mute preference is persisted in localStorage as 'subasta:muted'.
 */

let ctx: AudioContext | null = null;
let muted = false;

if (typeof localStorage !== 'undefined') {
	muted = localStorage.getItem('subasta:muted') === '1';
}

function getCtx(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	if (!ctx) {
		const Ctor =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		if (!Ctor) return null;
		ctx = new Ctor();
	}
	return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.08) {
	if (muted) return;
	const c = getCtx();
	if (!c || c.state === 'suspended') return;
	const osc = c.createOscillator();
	const g = c.createGain();
	osc.type = type;
	osc.frequency.value = freq;
	const t = c.currentTime;
	g.gain.value = 0;
	g.gain.linearRampToValueAtTime(gain, t + 0.005);
	g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
	osc.connect(g);
	g.connect(c.destination);
	osc.start(t);
	osc.stop(t + duration + 0.02);
}

export const sounds = {
	/** Someone placed a bid (you are not the bidder). */
	bid: () => tone(880, 0.08, 'sine', 0.05),
	/** You were just outbid. */
	outbid: () => {
		tone(660, 0.1, 'sine', 0.06);
		setTimeout(() => tone(440, 0.1, 'sine', 0.06), 90);
	},
	/** Timer warning, fired once when seconds drop to 5. */
	warning: () => tone(523, 0.12, 'square', 0.04),
	/** You won the active auction. */
	win: () => {
		tone(523.25, 0.1, 'triangle', 0.07); // C5
		setTimeout(() => tone(659.25, 0.1, 'triangle', 0.07), 90); // E5
		setTimeout(() => tone(783.99, 0.18, 'triangle', 0.08), 180); // G5
	},
	/** Auction closed (any winner / skip). */
	close: () => tone(330, 0.14, 'sine', 0.05),
	/** Voting phase begins. */
	voting: () => {
		tone(440, 0.14, 'sine', 0.04);
		setTimeout(() => tone(554.37, 0.14, 'sine', 0.04), 130);
		setTimeout(() => tone(659.25, 0.2, 'sine', 0.05), 260);
	}
};

/** Unlock the AudioContext after the first user gesture. Idempotent. */
export function enableAudio() {
	const c = getCtx();
	if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function isMuted(): boolean {
	return muted;
}

export function setMuted(value: boolean) {
	muted = value;
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('subasta:muted', value ? '1' : '0');
	}
}
