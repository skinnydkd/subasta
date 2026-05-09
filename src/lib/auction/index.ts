import type { AuctionEngine } from './engine';
import { OpenTimerEngine } from './engines/openTimer';
import type { AuctionType } from './settings';

const ENGINES: Record<AuctionType, AuctionEngine> = {
	open_timer: OpenTimerEngine,
	// v2 placeholders — registered but unimplemented
	sealed_first: OpenTimerEngine,
	sealed_vickrey: OpenTimerEngine,
	turn_based: OpenTimerEngine
};

export function getEngine(type: AuctionType): AuctionEngine {
	const engine = ENGINES[type];
	if (!engine) throw new Error(`No engine registered for auction type: ${type}`);
	return engine;
}

export type { AuctionEngine, AuctionState, BidValidation, BidRejectReason, Bidder, RoomConfig } from './engine';
