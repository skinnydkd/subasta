import { BOTS, botById, isBot, type BotDifficulty } from '$lib/bots/roster';
import { decideBid, type BotSnapshot } from '$lib/bots/strategy';
import { query, rpc } from './db';
import { updateRoomSettings } from './rooms';

const M = 100_000_000;

/** Seat `count` unused bots in a lobby room and switch it to the simulated tournament. */
export async function addBots(
	hostId: string,
	room: { id: string; code: string },
	count: number,
	difficulty?: BotDifficulty
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
	const members = await query<{ user_id: string }>(
		null,
		'select user_id from public.room_members where room_id = $1',
		[room.id]
	);
	const seated = new Set(members.map((m) => m.user_id));
	const free = BOTS.filter((b) => !seated.has(b.id)).slice(0, count);
	if (free.length === 0) return { ok: false, error: 'Ja hi ha tots els bots a la sala.' };

	// Settings first: only the host can change them, so this also checks the caller.
	const patch: Record<string, unknown> = { result_mode: 'simulation' };
	if (difficulty) patch.bot_difficulty = difficulty;
	const settings = await updateRoomSettings(hostId, room.id, patch);
	if (!settings.ok) return settings;

	let added = 0;
	for (const bot of free) {
		const r = await rpc(bot.id, 'join_room', { p_code: room.code }, 'rows');
		if (!r.ok) return added ? { ok: true, added } : { ok: false, error: r.error };
		added++;
	}
	return { ok: true, added };
}

type View = {
	room: { id: string; status: string; settings: Record<string, unknown> };
	members: Array<{ user_id: string; budget_remaining_cents: number }>;
	active_auction: null | {
		id: string;
		status: string;
		current_bid_cents: number | null;
		current_bidder_id: string | null;
		ends_at: string | null;
		started_at: string | null;
		position_slot: string;
	};
	active_player: null | { market_value_cents: number | null };
	recent_bids: Array<{ created_at: string }>;
};

/**
 * Let the bots in a drafting room react to the current auction. Runs on every
 * poll of a human player (there is no background process), places at most one
 * bid per call, and swallows errors: a rejected bid just means someone was faster.
 */
export async function botTick(view: View): Promise<void> {
	const a = view.active_auction;
	if (view.room.status !== 'drafting' || !a || a.status !== 'active') return;
	const bots = view.members.filter((m) => isBot(m.user_id));
	if (bots.length === 0) return;

	const settings = view.room.settings;
	const formation = (settings.formation ?? {}) as Record<string, number>;
	const extras = Number(settings.extra_per_position ?? 1);
	const need = Object.fromEntries(Object.entries(formation).map(([p, n]) => [p, n + extras]));
	const difficulty = (settings.bot_difficulty as BotDifficulty) ?? 'normal';

	const pending = await query<{ position_slot: string; n: number }>(
		null,
		`select position_slot, count(*)::int as n from public.auctions
		 where room_id = $1 and status = 'pending' group by position_slot`,
		[view.room.id]
	);
	const upcoming = Object.fromEntries(pending.map((r) => [r.position_slot, r.n]));
	// get_room_view only shows the caller's own team while drafting, so read the
	// bots' squads directly.
	const won = await query<{ winner_id: string; position_slot: string; n: number }>(
		null,
		`select winner_id, position_slot, count(*)::int as n from public.auctions
		 where room_id = $1 and winner_id = any($2::uuid[]) group by winner_id, position_slot`,
		[view.room.id, bots.map((b) => b.user_id)]
	);
	const lastBid = view.recent_bids[0]?.created_at;
	const lastActivityAt = Date.parse(lastBid ?? a.started_at ?? '') || Date.now();

	// Random order so no bot always gets the first word.
	for (const m of [...bots].sort(() => Math.random() - 0.5)) {
		const bot = botById(m.user_id)!;
		const owned = Object.fromEntries(
			won.filter((w) => w.winner_id === m.user_id).map((w) => [w.position_slot, w.n])
		);
		const snapshot: BotSnapshot = {
			now: Date.now(),
			auction: {
				currentBidCents: a.current_bid_cents === null ? null : Number(a.current_bid_cents),
				currentBidderId: a.current_bidder_id,
				endsAt: a.ends_at ? Date.parse(a.ends_at) : null,
				lastActivityAt,
				positionSlot: a.position_slot
			},
			marketValueCents:
				view.active_player?.market_value_cents == null
					? null
					: Number(view.active_player.market_value_cents),
			budgetCents: Number(m.budget_remaining_cents),
			owned,
			need,
			upcoming,
			minOpeningCents: Number(settings.min_opening_bid_cents ?? M),
			minIncrementCents: Number(settings.min_bid_increment_cents ?? M)
		};
		const amount = decideBid(snapshot, bot, difficulty, Math.random);
		if (amount === null) continue;
		const r = await rpc(bot.id, 'place_bid', {
			p_auction_id: a.id,
			p_amount_cents: String(amount)
		});
		if (r.ok) return; // one bid per tick: the others react next poll
	}
}
