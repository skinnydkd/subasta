import type { BotDifficulty, BotStyle } from './roster';

// A bot's decision for one tick of one auction. Pure: everything it may look at
// is in the snapshot, randomness comes from `rand`. The SQL `place_bid` still
// validates every bid, so this only decides *whether* and *how much*.

export type BotSnapshot = {
	now: number;
	auction: {
		currentBidCents: number | null;
		currentBidderId: string | null;
		endsAt: number | null;
		/** Time of the latest bid, or the auction start when nobody has bid. */
		lastActivityAt: number;
		positionSlot: string;
	};
	marketValueCents: number | null;
	budgetCents: number;
	/** Players already won, per position slot. */
	owned: Record<string, number>;
	/** Players wanted per position slot (formation + extras). */
	need: Record<string, number>;
	/** Pending auctions still to come, per position slot. */
	upcoming: Record<string, number>;
	minOpeningCents: number;
	minIncrementCents: number;
};

const M = 100_000_000; // 1M euro in cents
const STAR = 60 * M;
const roundM = (cents: number) => Math.round(cents / M) * M;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

const NOISE: Record<BotDifficulty, number> = { facil: 0.4, normal: 0.2, dificil: 0.08 };
/** Per-tick chance to act once the reaction delay has passed (ticks are ~1 s). */
const EAGERNESS: Record<BotStyle, number> = {
	tactic: 0.4,
	estrella: 0.5,
	tacany: 0.3,
	impulsiu: 0.6,
	franctirador: 0.9
};
const REACTION_MS = 1500;
const SNIPE_WINDOW_MS = 6000;

/** How much this bot would pay, at most, for the player on the block. */
export function valuation(
	s: BotSnapshot,
	style: BotStyle,
	difficulty: BotDifficulty,
	rand: () => number
): number {
	const slot = s.auction.positionSlot;
	const missing = Math.max(0, (s.need[slot] ?? 0) - (s.owned[slot] ?? 0));
	const slotsLeft = Object.keys(s.need).reduce(
		(n, p) => n + Math.max(0, (s.need[p] ?? 0) - (s.owned[p] ?? 0)),
		0
	);
	const mv = s.marketValueCents ?? 5 * M;

	const styleFactor =
		style === 'tacany'
			? 0.7
			: style === 'estrella'
				? mv >= STAR
					? 1.4
					: 0.5
				: style === 'impulsiu'
					? 1 + 0.6 * rand()
					: style === 'franctirador'
						? 1.1
						: 1;

	// Scarcity: few auctions left for a position the bot still has to fill.
	const ratio = missing / Math.max(1, s.upcoming[slot] ?? 0);
	const scarcity = ratio >= 1 ? 1.3 : ratio >= 0.5 ? 1.15 : 1;
	const scarcityFactor = style === 'tactic' ? scarcity : Math.sqrt(scarcity);

	// Money is only worth something if it gets spent: scale values to the
	// budget left per open slot, so bots don't finish with a fortune unspent.
	const fairShare = s.budgetCents / Math.max(1, slotsLeft);
	const budgetFactor = clamp(fairShare / (30 * M), 0.7, 3);

	const noise = 1 + (rand() * 2 - 1) * NOISE[difficulty];
	return Math.max(0, mv * styleFactor * scarcityFactor * budgetFactor * noise);
}

/** The bid to place now, in cents, or null to stay quiet this tick. */
export function decideBid(
	s: BotSnapshot,
	bot: { id: string; style: BotStyle },
	difficulty: BotDifficulty,
	rand: () => number
): number | null {
	const { auction } = s;
	if (auction.currentBidderId === bot.id) return null;
	if (auction.endsAt !== null && s.now >= auction.endsAt) return null;

	const slot = auction.positionSlot;
	const missing = Math.max(0, (s.need[slot] ?? 0) - (s.owned[slot] ?? 0));
	// Only bid where a place is still free; the sniper also hoards stars.
	if (missing === 0 && !(bot.style === 'franctirador' && (s.marketValueCents ?? 0) >= STAR)) {
		return null;
	}

	// Never break the bank: keep the opening price for every other open slot.
	const slotsLeft = Object.keys(s.need).reduce(
		(n, p) => n + Math.max(0, (s.need[p] ?? 0) - (s.owned[p] ?? 0)),
		0
	);
	const reserve = Math.max(0, slotsLeft - (missing > 0 ? 1 : 0)) * s.minOpeningCents;
	const affordable = s.budgetCents - reserve;
	const minNext =
		auction.currentBidCents === null
			? s.minOpeningCents
			: auction.currentBidCents + s.minIncrementCents;
	if (minNext > affordable) return null;

	// Timing: wait a beat after any bid; the sniper waits for the last seconds.
	const timeLeft = auction.endsAt === null ? Infinity : auction.endsAt - s.now;
	if (bot.style === 'franctirador') {
		if (timeLeft > SNIPE_WINDOW_MS || timeLeft < 800) return null;
	} else if (s.now - auction.lastActivityAt < REACTION_MS) {
		return null;
	}
	if (rand() > EAGERNESS[bot.style]) return null;

	const value = Math.min(affordable, valuation(s, bot.style, difficulty, rand));
	if (minNext > value) return null;

	let amount: number;
	if (auction.currentBidCents === null) {
		// Open at a fraction of what it's worth to the bot.
		amount = Math.max(minNext, roundM(value * (0.2 + 0.2 * rand())));
	} else {
		const jump =
			bot.style === 'impulsiu' && rand() < 0.4
				? 0.15 + 0.15 * rand()
				: bot.style === 'franctirador'
					? 0.1 + 0.1 * rand()
					: 0.04 + 0.06 * rand();
		amount = Math.max(minNext, roundM(auction.currentBidCents * (1 + jump)));
	}
	amount = Math.min(amount, Math.floor(value / M) * M);
	return amount >= minNext ? amount : null;
}
