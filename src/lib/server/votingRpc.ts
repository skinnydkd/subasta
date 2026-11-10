import { rpc, type RpcResult } from './db';

export type VoteInput = {
	rank1: string;
	rank2?: string | null;
	rank3?: string | null;
};

export function castVote(
	userId: string,
	roomId: string,
	vote: VoteInput
): Promise<RpcResult<null>> {
	return rpc(userId, 'cast_vote', {
		p_room_id: roomId,
		p_rank_1: vote.rank1,
		p_rank_2: vote.rank2 ?? null,
		p_rank_3: vote.rank3 ?? null
	});
}

export function finishVoting(userId: string, roomId: string): Promise<RpcResult<null>> {
	return rpc(userId, 'finish_voting', { p_room_id: roomId });
}
