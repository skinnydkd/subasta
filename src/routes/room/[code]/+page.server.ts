import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isValidRoomCode, normalizeRoomCode } from '$lib/utils/roomCode';
import { advanceAuction, placeBid, startRoom } from '$lib/server/auctionRpc';
import { castVote, finishVoting } from '$lib/server/votingRpc';
import {
	deleteRoom,
	kickMember,
	leaveRoom,
	transferHost,
	updateRoomSettings
} from '$lib/server/rooms';
import { FORMATION_PRESETS, type FormationPreset } from '$lib/auction/settings';
import { parseAmountToCents } from '$lib/utils/currency';

type RpcAny = (
	fn: string,
	args: unknown
) => Promise<{ data: unknown; error: { message: string } | null }>;

type TeamPlayer = {
	auction_id: string;
	position_slot: string;
	final_price_cents: number | null;
	auction_status: string;
	player_id: string;
	player_name: string;
	player_position: string;
};

type RoomView = {
	room: {
		id: string;
		code: string;
		host_id: string | null;
		status: string;
		settings: Record<string, unknown>;
		theme: { id: string; display_name: string };
	};
	members: Array<{
		user_id: string;
		display_name: string;
		budget_remaining_cents: number;
		joined_at: string;
	}>;
	active_auction: null | {
		id: string;
		sequence_number: number;
		status: string;
		current_bid_cents: number | null;
		current_bidder_id: string | null;
		ends_at: string | null;
		started_at: string | null;
		position_slot: string;
		player_id: string;
	};
	active_player: null | {
		id: string;
		name: string;
		photo_url: string | null;
		primary_position: string;
		secondary_positions: string[] | null;
		market_value_cents: number | null;
		metadata: Record<string, unknown> | null;
	};
	recent_bids: Array<{
		id: string;
		amount_cents: number;
		created_at: string;
		user_id: string;
		profile: { display_name: string } | null;
	}>;
	upcoming_auctions: Array<{
		sequence_number: number;
		position_slot: string;
		player_name: string;
		team: string | null;
	}>;
	teams: Record<string, TeamPlayer[]>;
	tally: Array<{ user_id: string; total_points: number; votes_received: number }>;
};

export const load: PageServerLoad = async ({ params, locals }) => {
	const code = normalizeRoomCode(params.code);
	if (!isValidRoomCode(code)) throw error(404, 'Sala no trobada.');

	const rpc = (locals.supabase.rpc as unknown as RpcAny).bind(locals.supabase);
	const { data: viewData } = await rpc('get_room_view', { p_code: code });
	if (!viewData) throw error(404, 'Sala no trobada.');

	const view = viewData as RoomView;
	const userId = locals.user?.id ?? null;
	const isMember = !!userId && view.members.some((m) => m.user_id === userId);
	const readOnly = !isMember;

	// Member-only extras: their existing vote (RLS allows the voter to read
	// their own vote regardless of phase).
	let myVote: {
		rank_1_user_id: string;
		rank_2_user_id: string | null;
		rank_3_user_id: string | null;
	} | null = null;
	if (isMember && (view.room.status === 'voting' || view.room.status === 'finished')) {
		const { data } = await locals.supabase
			.from('votes')
			.select('rank_1_user_id, rank_2_user_id, rank_3_user_id')
			.eq('room_id', view.room.id)
			.eq('voter_id', userId!)
			.maybeSingle();
		myVote = data;
	}

	return {
		room: {
			id: view.room.id,
			code: view.room.code,
			host_id: view.room.host_id,
			status: view.room.status,
			settings: view.room.settings,
			theme: { id: view.room.theme.id, slug: '', display_name: view.room.theme.display_name }
		},
		members: view.members.map((m) => ({
			user_id: m.user_id,
			budget_remaining_cents: m.budget_remaining_cents,
			joined_at: m.joined_at,
			profile: { id: m.user_id, display_name: m.display_name }
		})),
		isHost: userId === view.room.host_id,
		activeAuction: view.active_auction,
		activePlayer: view.active_player,
		recentBids: view.recent_bids,
		upcomingAuctions: view.upcoming_auctions,
		teamsByUser: view.teams,
		myVote,
		tally: view.tally,
		readOnly
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

	updateSettings: async ({ request, params, locals }) => {
		if (!locals.user) return fail(401, { settings: { error: 'No autenticat.' } });

		const formData = await request.formData();
		const patch: Record<string, unknown> = {};

		const timerRaw = formData.get('timer');
		if (timerRaw !== null && timerRaw !== '') {
			const timer = Number.parseInt(String(timerRaw), 10);
			if (!Number.isFinite(timer) || timer < 10 || timer > 600) {
				return fail(400, { settings: { error: 'Timer ha de ser entre 10 i 600 segons.' } });
			}
			patch.timer_seconds = timer;
		}

		const formationRaw = formData.get('formation');
		if (formationRaw !== null && formationRaw !== '') {
			const preset = String(formationRaw) as FormationPreset;
			if (!FORMATION_PRESETS[preset]) {
				return fail(400, { settings: { error: 'Formació desconeguda.' } });
			}
			patch.formation = FORMATION_PRESETS[preset];
		}

		const maxMembersRaw = formData.get('max_members');
		if (maxMembersRaw !== null && maxMembersRaw !== '') {
			const m = Number.parseInt(String(maxMembersRaw), 10);
			if (!Number.isFinite(m) || m < 2 || m > 8) {
				return fail(400, { settings: { error: 'Jugadors entre 2 i 8.' } });
			}
			patch.max_members = m;
		}

		const extrasRaw = formData.get('extras');
		if (extrasRaw !== null && extrasRaw !== '') {
			const e = Number.parseInt(String(extrasRaw), 10);
			if (!Number.isFinite(e) || e < 0 || e > 3) {
				return fail(400, { settings: { error: 'Extres entre 0 i 3.' } });
			}
			patch.extra_per_position = e;
		}

		if (Object.keys(patch).length === 0) {
			return fail(400, { settings: { error: 'Cap canvi.' } });
		}

		const code = normalizeRoomCode(params.code!);
		const { data: room } = await locals.supabase
			.from('rooms')
			.select('id')
			.eq('code', code)
			.maybeSingle();
		if (!room) return fail(404, { settings: { error: 'Sala no trobada.' } });

		const result = await updateRoomSettings(locals.supabase, room.id, patch);
		if (!result.ok) return fail(400, { settings: { error: result.error } });
		return { settings: { ok: true } };
	},

	leaveRoom: async ({ params, locals }) => {
		if (!locals.user) return fail(401, { leave: { error: 'No autenticat.' } });

		const code = normalizeRoomCode(params.code!);
		const { data: room } = await locals.supabase
			.from('rooms')
			.select('id')
			.eq('code', code)
			.maybeSingle();
		if (!room) return fail(404, { leave: { error: 'Sala no trobada.' } });

		const result = await leaveRoom(locals.supabase, room.id);
		if (!result.ok) return fail(400, { leave: { error: result.error } });
		throw redirect(303, '/');
	},

	kickMember: async ({ request, params, locals }) => {
		if (!locals.user) return fail(401, { kick: { error: 'No autenticat.' } });

		const formData = await request.formData();
		const userIdToKick = String(formData.get('user_id') ?? '').trim();
		if (!userIdToKick) return fail(400, { kick: { error: 'Falta user_id.' } });

		const code = normalizeRoomCode(params.code!);
		const { data: room } = await locals.supabase
			.from('rooms')
			.select('id')
			.eq('code', code)
			.maybeSingle();
		if (!room) return fail(404, { kick: { error: 'Sala no trobada.' } });

		const result = await kickMember(locals.supabase, room.id, userIdToKick);
		if (!result.ok) return fail(400, { kick: { error: result.error } });
		return { kick: { ok: true } };
	},

	transferHost: async ({ request, params, locals }) => {
		if (!locals.user) return fail(401, { transfer: { error: 'No autenticat.' } });

		const formData = await request.formData();
		const newHostId = String(formData.get('user_id') ?? '').trim();
		if (!newHostId) return fail(400, { transfer: { error: 'Falta user_id.' } });

		const code = normalizeRoomCode(params.code!);
		const { data: room } = await locals.supabase
			.from('rooms')
			.select('id')
			.eq('code', code)
			.maybeSingle();
		if (!room) return fail(404, { transfer: { error: 'Sala no trobada.' } });

		const result = await transferHost(locals.supabase, room.id, newHostId);
		if (!result.ok) return fail(400, { transfer: { error: result.error } });
		return { transfer: { ok: true } };
	},

	deleteRoom: async ({ params, locals }) => {
		if (!locals.user) return fail(401, { deleteRoom: { error: 'No autenticat.' } });

		const code = normalizeRoomCode(params.code!);
		const { data: room } = await locals.supabase
			.from('rooms')
			.select('id')
			.eq('code', code)
			.maybeSingle();
		if (!room) return fail(404, { deleteRoom: { error: 'Sala no trobada.' } });

		const result = await deleteRoom(locals.supabase, room.id);
		if (!result.ok) return fail(400, { deleteRoom: { error: result.error } });
		throw redirect(303, '/');
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
