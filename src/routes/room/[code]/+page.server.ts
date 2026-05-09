import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isValidRoomCode, normalizeRoomCode } from '$lib/utils/roomCode';
import { advanceAuction, placeBid, startRoom } from '$lib/server/auctionRpc';
import { parseAmountToCents } from '$lib/utils/currency';

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

	return {
		room,
		members: members ?? [],
		isHost: room.host_id === locals.user.id,
		activeAuction,
		activePlayer,
		recentBids
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

		const code = normalizeRoomCode(params.code!);
		const { data: room } = await locals.supabase
			.from('rooms')
			.select('id, host_id')
			.eq('code', code)
			.maybeSingle();
		if (!room) return fail(404, { advance: { error: 'Sala no trobada.' } });
		if (room.host_id !== locals.user.id) {
			return fail(403, { advance: { error: 'Només el host.' } });
		}

		const result = await advanceAuction(locals.supabase, room.id);
		if (!result.ok) return fail(400, { advance: { error: result.error } });
		return { advance: { ok: true, ...result.data } };
	}
};
