import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/db';
import type { RpcResult } from './auctionRpc';

type RpcAny = (
	fn: string,
	args: unknown
) => Promise<{ data: unknown; error: { message: string } | null }>;

function rawRpc(supabase: SupabaseClient<Database>): RpcAny {
	return (supabase.rpc as unknown as RpcAny).bind(supabase);
}

export type VoteInput = {
	rank1: string;
	rank2?: string | null;
	rank3?: string | null;
};

export async function castVote(
	supabase: SupabaseClient<Database>,
	roomId: string,
	vote: VoteInput
): Promise<RpcResult<null>> {
	const { error } = await rawRpc(supabase)('cast_vote', {
		p_room_id: roomId,
		p_rank_1: vote.rank1,
		p_rank_2: vote.rank2 ?? null,
		p_rank_3: vote.rank3 ?? null
	});
	if (error) return { ok: false, error: error.message };
	return { ok: true, data: null };
}

export async function finishVoting(
	supabase: SupabaseClient<Database>,
	roomId: string
): Promise<RpcResult<null>> {
	const { error } = await rawRpc(supabase)('finish_voting', { p_room_id: roomId });
	if (error) return { ok: false, error: error.message };
	return { ok: true, data: null };
}
