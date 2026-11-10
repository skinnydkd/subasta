import { rpc, type RpcResult } from './db';

export type { RpcResult };

export function startRoom(userId: string, roomId: string): Promise<RpcResult<null>> {
	return rpc(userId, 'start_room', { p_room_id: roomId });
}

export function placeBid(
	userId: string,
	auctionId: string,
	amountCents: bigint | number
): Promise<RpcResult<null>> {
	return rpc(userId, 'place_bid', {
		p_auction_id: auctionId,
		p_amount_cents: amountCents.toString()
	});
}

export type AdvanceResult = {
	next_auction_id: string | null;
	phase: 'drafting' | 'voting';
};

export function advanceAuction(
	userId: string,
	roomId: string,
	force = false
): Promise<RpcResult<AdvanceResult>> {
	return rpc(userId, 'advance_auction', { p_room_id: roomId, p_force: force });
}
