import { describe, expect, it } from 'vitest';
import { decideBid, type BotSnapshot } from './strategy';

const M = 100_000_000;
const NOW = 1_000_000;
const always = () => 0; // rand() = 0: always eager, minimum noise towards -1
const half = () => 0.5;

const snap = (over: Partial<BotSnapshot> = {}, auction: Partial<BotSnapshot['auction']> = {}) =>
	({
		now: NOW,
		auction: {
			currentBidCents: null,
			currentBidderId: null,
			endsAt: NOW + 30_000,
			lastActivityAt: NOW - 5_000,
			positionSlot: 'ST',
			...auction
		},
		marketValueCents: 50 * M,
		budgetCents: 1000 * M,
		owned: {},
		need: { GK: 2, LB: 2, RB: 2, CB: 3, CM: 4, LW: 2, RW: 2, ST: 2 },
		upcoming: { ST: 10 },
		minOpeningCents: M,
		minIncrementCents: M,
		...over
	}) satisfies BotSnapshot;

const tactic = { id: 'bot', style: 'tactic' as const };

describe('decideBid', () => {
	it('opens a fresh auction with a sensible bid', () => {
		// 0.3 passes the tactic bot's 0.4 eagerness gate.
		const bid = decideBid(snap(), tactic, 'normal', () => 0.3);
		expect(bid).not.toBeNull();
		expect(bid!).toBeGreaterThanOrEqual(M);
		expect(bid! % M).toBe(0);
	});

	it('never outbids itself', () => {
		expect(
			decideBid(
				snap({}, { currentBidCents: 10 * M, currentBidderId: 'bot' }),
				tactic,
				'normal',
				half
			)
		).toBeNull();
	});

	it('skips positions it has already filled', () => {
		expect(decideBid(snap({ owned: { ST: 2 } }), tactic, 'normal', half)).toBeNull();
	});

	it('keeps money for the slots still open', () => {
		// 19 slots open, 1 is this one: must keep 18 × 1M; 18.5M leaves no room.
		const bid = decideBid(snap({ budgetCents: 18.5 * M }), tactic, 'normal', half);
		expect(bid).toBeNull();
	});

	it('never bids above its budget minus the reserve', () => {
		for (let i = 0; i < 200; i++) {
			const r = Math.random;
			const s = snap(
				{ budgetCents: 60 * M, marketValueCents: 200 * M },
				{ currentBidCents: 20 * M }
			);
			const bid = decideBid(s, { id: 'b', style: 'impulsiu' }, 'facil', r);
			if (bid !== null) expect(bid).toBeLessThanOrEqual(60 * M - 18 * M);
		}
	});

	it('waits a beat after a fresh bid', () => {
		const s = snap(
			{},
			{ currentBidCents: 5 * M, currentBidderId: 'human', lastActivityAt: NOW - 200 }
		);
		expect(decideBid(s, tactic, 'normal', always)).toBeNull();
	});

	it('the sniper only acts in the last seconds', () => {
		const sniper = { id: 'b', style: 'franctirador' as const };
		expect(decideBid(snap(), sniper, 'normal', half)).toBeNull();
		expect(decideBid(snap({}, { endsAt: NOW + 4_000 }), sniper, 'normal', half)).not.toBeNull();
	});

	it('the star hunter ignores cheap players', () => {
		const star = { id: 'b', style: 'estrella' as const };
		const cheap = snap(
			{ marketValueCents: 3 * M, budgetCents: 40 * M },
			{ currentBidCents: 10 * M }
		);
		expect(decideBid(cheap, star, 'dificil', half)).toBeNull();
	});

	it('stops when the price passes its valuation', () => {
		const s = snap({ marketValueCents: 2 * M }, { currentBidCents: 300 * M });
		expect(decideBid(s, tactic, 'dificil', half)).toBeNull();
	});

	it('does nothing once the timer is over', () => {
		expect(decideBid(snap({}, { endsAt: NOW - 1 }), tactic, 'normal', half)).toBeNull();
	});
});
