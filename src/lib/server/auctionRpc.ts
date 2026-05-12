import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/db';

/**
 * Wrappers around the auction RPCs. db.ts hasn't been regenerated since the
 * migration was added; we cast through `unknown` here in one place. Once
 * `pnpm db:types` is run after applying the migration, these casts can go
 * away in favour of typed `Database['public']['Functions']` entries.
 */

type RpcAny = (
	fn: string,
	args: unknown
) => Promise<{ data: unknown; error: { message: string } | null }>;

function rawRpc(supabase: SupabaseClient<Database>): RpcAny {
	return (supabase.rpc as unknown as RpcAny).bind(supabase);
}

export type RpcResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function startRoom(
	supabase: SupabaseClient<Database>,
	roomId: string
): Promise<RpcResult<null>> {
	const { error } = await rawRpc(supabase)('start_room', { p_room_id: roomId });
	if (error) return { ok: false, error: error.message };
	return { ok: true, data: null };
}

export async function placeBid(
	supabase: SupabaseClient<Database>,
	auctionId: string,
	amountCents: bigint | number
): Promise<RpcResult<null>> {
	const amount = typeof amountCents === 'bigint' ? amountCents.toString() : amountCents;
	const { error } = await rawRpc(supabase)('place_bid', {
		p_auction_id: auctionId,
		p_amount_cents: amount
	});
	if (error) return { ok: false, error: error.message };
	return { ok: true, data: null };
}

export type AdvanceResult = {
	next_auction_id: string | null;
	phase: 'drafting' | 'voting';
};

export async function advanceAuction(
	supabase: SupabaseClient<Database>,
	roomId: string
): Promise<RpcResult<AdvanceResult>> {
	const { data, error } = await rawRpc(supabase)('advance_auction', { p_room_id: roomId });
	if (error) return { ok: false, error: error.message };
	return { ok: true, data: data as AdvanceResult };
}
