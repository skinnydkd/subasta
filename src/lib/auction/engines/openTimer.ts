import type { AuctionEngine, AuctionState, BidValidation, Bidder, RoomConfig } from '../engine';

/**
 * open_timer: free bidding, timer resets on each new bid.
 *
 * Rules:
 *   - First bid must be >= minOpeningBidCents.
 *   - Subsequent bids must be >= currentBid + minBidIncrement.
 *   - Bidder cannot outbid themselves (already winning).
 *   - Bidder cannot bid more than their remaining budget.
 *   - When ends_at passes, auction closes.
 */
export const OpenTimerEngine: AuctionEngine = {
	type: 'open_timer',

	nextValidBidCents(state: AuctionState, config: RoomConfig): number {
		if (state.currentBidCents == null) {
			return config.minOpeningBidCents;
		}
		return state.currentBidCents + config.minBidIncrementCents;
	},

	validateBid(
		state: AuctionState,
		config: RoomConfig,
		bidder: Bidder,
		amountCents: number
	): BidValidation {
		if (state.status !== 'active') return { ok: false, reason: 'not_active' };
		if (this.shouldClose(state)) return { ok: false, reason: 'expired' };
		if (state.currentBidderId === bidder.userId) {
			return { ok: false, reason: 'self_outbid' };
		}

		if (state.currentBidCents == null) {
			if (amountCents < config.minOpeningBidCents) {
				return { ok: false, reason: 'below_minimum' };
			}
		} else {
			const minNext = state.currentBidCents + config.minBidIncrementCents;
			if (amountCents < minNext) return { ok: false, reason: 'below_increment' };
		}

		if (amountCents > bidder.budgetRemainingCents) {
			return { ok: false, reason: 'over_budget' };
		}

		return { ok: true, amountCents };
	},

	secondsRemaining(state: AuctionState, now: Date = new Date()): number {
		if (!state.endsAt) return 0;
		const diff = state.endsAt.getTime() - now.getTime();
		return Math.max(0, Math.ceil(diff / 1000));
	},

	shouldClose(state: AuctionState, now: Date = new Date()): boolean {
		if (state.status !== 'active') return false;
		if (!state.endsAt) return false;
		return state.endsAt.getTime() <= now.getTime();
	}
};
