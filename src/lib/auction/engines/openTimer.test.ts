import { describe, expect, it } from 'vitest';
import { OpenTimerEngine } from './openTimer';
import type { AuctionState, Bidder, RoomConfig } from '../engine';

const config: RoomConfig = {
	timerSeconds: 60,
	minOpeningBidCents: 100_000_00, // 1M€
	minBidIncrementCents: 100_000_00 // 1M€
};

const bidder = (overrides: Partial<Bidder> = {}): Bidder => ({
	userId: 'u-alice',
	budgetRemainingCents: 100_000_000_000, // 1.000M€
	...overrides
});

const state = (overrides: Partial<AuctionState> = {}): AuctionState => ({
	id: 'a-1',
	roomId: 'r-1',
	status: 'active',
	currentBidCents: null,
	currentBidderId: null,
	endsAt: new Date(Date.now() + 30_000),
	...overrides
});

describe('OpenTimerEngine.nextValidBidCents', () => {
	it('returns the opening minimum when no bid yet', () => {
		expect(OpenTimerEngine.nextValidBidCents(state(), config)).toBe(100_000_00);
	});

	it('returns current_bid + increment when there is a bid', () => {
		const s = state({ currentBidCents: 500_000_00, currentBidderId: 'u-bob' });
		expect(OpenTimerEngine.nextValidBidCents(s, config)).toBe(600_000_00);
	});
});

describe('OpenTimerEngine.validateBid', () => {
	it('accepts a valid opening bid', () => {
		const result = OpenTimerEngine.validateBid(state(), config, bidder(), 100_000_00);
		expect(result.ok).toBe(true);
	});

	it('rejects a bid below the opening minimum', () => {
		const result = OpenTimerEngine.validateBid(state(), config, bidder(), 50_000_00);
		expect(result).toEqual({ ok: false, reason: 'below_minimum' });
	});

	it('rejects a bid that does not meet the increment', () => {
		const s = state({ currentBidCents: 500_000_00, currentBidderId: 'u-bob' });
		const result = OpenTimerEngine.validateBid(s, config, bidder(), 550_000_00);
		expect(result).toEqual({ ok: false, reason: 'below_increment' });
	});

	it('accepts a bid exactly at the increment', () => {
		const s = state({ currentBidCents: 500_000_00, currentBidderId: 'u-bob' });
		const result = OpenTimerEngine.validateBid(s, config, bidder(), 600_000_00);
		expect(result.ok).toBe(true);
	});

	it('rejects self-outbidding', () => {
		const s = state({ currentBidCents: 500_000_00, currentBidderId: 'u-alice' });
		const result = OpenTimerEngine.validateBid(s, config, bidder(), 600_000_00);
		expect(result).toEqual({ ok: false, reason: 'self_outbid' });
	});

	it('rejects a bid over budget', () => {
		const result = OpenTimerEngine.validateBid(
			state(),
			config,
			bidder({ budgetRemainingCents: 50_000_00 }),
			100_000_00
		);
		// 100M cents > 50M cents budget
		expect(result).toEqual({ ok: false, reason: 'over_budget' });
	});

	it('rejects when auction is not active', () => {
		const s = state({ status: 'closed' });
		const result = OpenTimerEngine.validateBid(s, config, bidder(), 100_000_00);
		expect(result).toEqual({ ok: false, reason: 'not_active' });
	});

	it('rejects when timer has expired', () => {
		const s = state({ endsAt: new Date(Date.now() - 1000) });
		const result = OpenTimerEngine.validateBid(s, config, bidder(), 100_000_00);
		expect(result).toEqual({ ok: false, reason: 'expired' });
	});
});

describe('OpenTimerEngine.secondsRemaining', () => {
	it('returns 0 when endsAt is null', () => {
		expect(OpenTimerEngine.secondsRemaining(state({ endsAt: null }))).toBe(0);
	});

	it('returns 0 (clamped) when expired', () => {
		const s = state({ endsAt: new Date(Date.now() - 5000) });
		expect(OpenTimerEngine.secondsRemaining(s)).toBe(0);
	});

	it('rounds up partial seconds', () => {
		const now = new Date(2026, 0, 1, 12, 0, 0);
		const s = state({ endsAt: new Date(now.getTime() + 30_500) });
		expect(OpenTimerEngine.secondsRemaining(s, now)).toBe(31);
	});
});

describe('OpenTimerEngine.shouldClose', () => {
	it('returns true when active and past endsAt', () => {
		const s = state({ endsAt: new Date(Date.now() - 1000) });
		expect(OpenTimerEngine.shouldClose(s)).toBe(true);
	});

	it('returns false when not active', () => {
		const s = state({ status: 'pending', endsAt: new Date(Date.now() - 1000) });
		expect(OpenTimerEngine.shouldClose(s)).toBe(false);
	});

	it('returns false when active but not expired', () => {
		const s = state({ endsAt: new Date(Date.now() + 5000) });
		expect(OpenTimerEngine.shouldClose(s)).toBe(false);
	});
});
