/**
 * Stable interface for auction engines.
 *
 * Engines are PURE — they validate, compute display state, and propose next
 * legal moves, but never mutate state or talk to the database. State mutations
 * always go through Postgres RPCs (the single source of truth).
 *
 * The engine duplicates *some* validation client-side so the UI can disable
 * illegal actions immediately, but the server is the only authority.
 */

import type { AuctionType } from './settings';

export type AuctionState = {
	id: string;
	roomId: string;
	status: 'pending' | 'active' | 'closed' | 'auto_assigned';
	currentBidCents: number | null;
	currentBidderId: string | null;
	endsAt: Date | null;
};

export type RoomConfig = {
	timerSeconds: number;
	minOpeningBidCents: number;
	minBidIncrementCents: number;
};

export type Bidder = {
	userId: string;
	budgetRemainingCents: number;
};

export type BidValidation =
	| { ok: true; amountCents: number }
	| { ok: false; reason: BidRejectReason };

export type BidRejectReason =
	| 'not_active'
	| 'expired'
	| 'self_outbid'
	| 'below_minimum'
	| 'below_increment'
	| 'over_budget';

export interface AuctionEngine {
	readonly type: AuctionType;

	/** Smallest legal bid for this auctioneer, given current state. */
	nextValidBidCents(state: AuctionState, config: RoomConfig): number;

	/** Validate a proposed bid against state + config + bidder budget. */
	validateBid(
		state: AuctionState,
		config: RoomConfig,
		bidder: Bidder,
		amountCents: number
	): BidValidation;

	/** Seconds remaining until the timer expires (clamped to 0). */
	secondsRemaining(state: AuctionState, now?: Date): number;

	/** Whether the auction's timer has expired and it should close. */
	shouldClose(state: AuctionState, now?: Date): boolean;
}
