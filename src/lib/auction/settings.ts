import type { Database } from '$lib/types/db';

export type AuctionType = Database['public']['Enums']['auction_type'];
export type PositionCode = Database['public']['Enums']['position_code'];

export type RoomSettings = {
	formation: Partial<Record<PositionCode, number>>;
	extra_per_position: number;
	starting_budget_cents: number;
	auction_type: AuctionType;
	timer_seconds: number;
	min_bid_increment_cents: number;
	min_opening_bid_cents: number;
	max_members: number;
};

// 1.000M€ in cents
export const STARTING_BUDGET_CENTS = 100_000_000_000;

// Default 4-3-3: 1 GK, 4 def (1 LB, 1 RB, 2 CB), 3 mid (3 CM), 3 fwd (1 LW, 1 RW, 1 ST)
export const DEFAULT_FORMATION: RoomSettings['formation'] = {
	GK: 1,
	LB: 1,
	RB: 1,
	CB: 2,
	CM: 3,
	LW: 1,
	RW: 1,
	ST: 1
};

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
	formation: DEFAULT_FORMATION,
	extra_per_position: 1,
	starting_budget_cents: STARTING_BUDGET_CENTS,
	auction_type: 'open_timer',
	timer_seconds: 60,
	min_bid_increment_cents: 1_000_000_00, // 1M€
	min_opening_bid_cents: 1_000_000_00, // 1M€
	max_members: 5
};
