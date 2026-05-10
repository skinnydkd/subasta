import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isValidRoomCode, normalizeRoomCode } from '$lib/utils/roomCode';
import { advanceAuction, placeBid, startRoom } from '$lib/server/auctionRpc';
import { castVote, finishVoting } from '$lib/server/votingRpc';
import { parseAmountToCents } from '$lib/utils/currency';

type TeamPlayer = {
	auction_id: string;
	position_slot: string;
	final_price_cents: number | null;
	auction_status: string;
	player_id: string;
	player_name: string;
	player_position: string;
};

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(303, '/');
	}

	const code = normalizeRoomCode(params.code);
	if (!isValidRoomCode(code)) {
		throw error(404, 'Sala no trobada.');
	}

	const { data: room, error: roomError } = await locals.supabase
		.from('rooms')
		.select('id, code, host_id, status, settings, theme:themes(id, slug, display_name)')
		.eq('code', code)
		.maybeSingle();

	if (roomError) throw error(500, roomError.message);
	if (!room) throw error(404, 'Sala no trobada.');

	const { data: members } = await locals.supabase
		.from('room_members')
		.select('user_id, budget_remaining_cents, joined_at, profile:profiles(id, display_name)')
		.eq('room_id', room.id)
		.order('joined_at');

	let activeAuction = null;
	let activePlayer = null;
	let recentBids: Array<{
		id: string;
		amount_cents: number;
		created_at: string;
		user_id: string;
		profile: { display_name: string } | null;
	}> = [];

	if (room.status === 'drafting') {
		const { data: auction } = await locals.supabase
			.from('auctions')
			.select(
				'id, sequence_number, status, current_bid_cents, current_bidder_id, ends_at, started_at, position_slot, player_id'
			)
			.eq('room_id', room.id)
			.eq('status', 'active')
			.maybeSingle();

		if (auction) {
			activeAuction = auction;

			const { data: player } = await locals.supabase
				.from('players')
				.select('id, name, photo_url, primary_position, secondary_positions, market_value_cents, metadata')
				.eq('id', auction.player_id)
				.maybeSingle();
			activePlayer = player;

			const { data: bids } = await locals.supabase
				.from('bids')
				.select('id, amount_cents, created_at, user_id, profile:profiles(display_name)')
				.eq('auction_id', auction.id)
				.order('created_at', { ascending: false })
				.limit(10);
			recentBids = (bids ?? []) as never;
		}
	}

	let teamsByUser: Record<string, TeamPlayer[]> = {};
	let myVote: {
		rank_1_user_id: string;
		rank_2_user_id: string | null;
		rank_3_user_id: string | null;
	} | null = null;
	let tally: Array<{ user_id: string; total_points: number; votes_received: number }> = [];

	if (room.status === 'voting' || room.status === 'finished') {
		const { data: rows } = await locals.supabase
			.from('auctions')
			.select(
				'id, winner_id, position_slot, final_price_cents, status, player:players(id, name, primary_position)'
			)
			.eq('room_id', room.id)
			.not('winner_id', 'is', null);

		teamsByUser = {};
		for (const row of rows ?? []) {
			if (!row.winner_id || !row.player) continue;
			(teamsByUser[row.winner_id] ??= []).push({
				auction_id: row.id,
				position_slot: row.position_slot,
				final_price_cents: row.final_price_cents,
				auction_status: row.status,
				player_id: row.player.id,
				player_name: row.player.name,
				player_position: row.player.primary_position
			});
		}

		const { data: vote } = await locals.supabase
			.from('votes')
			.select('rank_1_user_id, rank_2_user_id, rank_3_user_id')
			.eq('room_id', room.id)
			.eq('voter_id', locals.user.id)
			.maybeSingle();
		myVote = vote;
	}

	if (room.status === 'finished') {
		const { data: tallyData } = await locals.supabase
			.from('vote_tally' as never)
			.select('user_id, total_points, votes_received')
			.eq('room_id', room.id);
		tally = (tallyData ?? []) as never;
	}

	return {
		room,
		members: members ?? [],
		isHost: room.host_id === locals.user.id,
		activeAuction,
		activePlayer,
		recentBids,
		teamsByUser,
		myVote,
		tally
	};
};

export const actions: Actions = {
	startRoom: async ({ params, locals }) => {
		if (!locals.user) return fail(401, { startRoom: { error: 'No autenticat.' } });

		const code = normalizeRoomCode(params.code!);
		const { data: room } = await locals.supabase
			.from('rooms')
			.select('id, host_id')
			.eq('code', code)
			.maybeSingle();
		if (!room) return fail(404, { startRoom: { error: 'Sala no trobada.' } });
		if (room.host_id !== locals.user.id) {
			return fail(403, { startRoom: { error: 'Només el host pot iniciar.' } });
		}

		const result = await startRoom(locals.supabase, room.id);
		if (!result.ok) return fail(400, { startRoom: { error: result.error } });
		return { startRoom: { ok: true } };
	},

	placeBid: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { bid: { error: 'No autenticat.' } });

		const formData = await request.formData();
		const auctionId = String(formData.get('auction_id') ?? '');
		const amountInput = String(formData.get('amount') ?? '');

		const amount = parseAmountToCents(amountInput);
		if (!amount || amount <= 0n) {
			return fail(400, { bid: { error: 'Quantitat invàlida.' } });
		}
		if (!auctionId) return fail(400, { bid: { error: 'Subhasta no especificada.' } });

		const result = await placeBid(locals.supabase, auctionId, amount);
		if (!result.ok) return fail(400, { bid: { error: result.error } });
		return { bid: { ok: true } };
	},

	advanceAuction: async ({ params, locals }) => {
		if (!locals.user) return fail(401, { advance: { error: 'No autenticat.' } });

		// Authorization is enforced by the RPC: host can always advance,
		// any room member can advance an expired or queue-done auction.
		const code = normalizeRoomCode(params.code!);
		const { data: room } = await locals.supabase
			.from('rooms')
			.select('id')
			.eq('code', code)
			.maybeSingle();
		if (!room) return fail(404, { advance: { error: 'Sala no trobada.' } });

		const result = await advanceAuction(locals.supabase, room.id);
		if (!result.ok) return fail(400, { advance: { error: result.error } });
		return { advance: { ok: true, ...result.data } };
	},

	castVote: async ({ request, params, locals }) => {
		if (!locals.user) return fail(401, { vote: { error: 'No autenticat.' } });

		const formData = await request.formData();
		const rank1 = String(formData.get('rank_1') ?? '').trim() || null;
		const rank2 = String(formData.get('rank_2') ?? '').trim() || null;
		const rank3 = String(formData.get('rank_3') ?? '').trim() || null;

		if (!rank1) return fail(400, { vote: { error: 'Tria almenys el Top 1.' } });

		const code = normalizeRoomCode(params.code!);
		const { data: room } = await locals.supabase
			.from('rooms')
			.select('id')
			.eq('code', code)
			.maybeSingle();
		if (!room) return fail(404, { vote: { error: 'Sala no trobada.' } });

		const result = await castVote(locals.supabase, room.id, {
			rank1,
			rank2,
			rank3
		});
		if (!result.ok) return fail(400, { vote: { error: result.error } });
		return { vote: { ok: true } };
	},

	finishVoting: async ({ params, locals }) => {
		if (!locals.user) return fail(401, { finishVoting: { error: 'No autenticat.' } });

		const code = normalizeRoomCode(params.code!);
		const { data: room } = await locals.supabase
			.from('rooms')
			.select('id, host_id')
			.eq('code', code)
			.maybeSingle();
		if (!room) return fail(404, { finishVoting: { error: 'Sala no trobada.' } });
		if (room.host_id !== locals.user.id) {
			return fail(403, { finishVoting: { error: 'Només el host.' } });
		}

		const result = await finishVoting(locals.supabase, room.id);
		if (!result.ok) return fail(400, { finishVoting: { error: result.error } });
		return { finishVoting: { ok: true } };
	}
};
