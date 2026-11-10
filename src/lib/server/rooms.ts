import { query, rpc } from './db';

type Ok = { ok: true } | { ok: false; error: string };
type RoomRef = { ok: true; code: string; roomId: string } | { ok: false; error: string };

export type CreateRoomResult = RoomRef;
export type JoinRoomResult = RoomRef;

async function roomRef(
	result: ReturnType<typeof rpc<Array<{ room_id: string; code: string }>>>,
	emptyMessage: string
): Promise<RoomRef> {
	const r = await result;
	if (!r.ok) return r;
	if (!r.data?.length) return { ok: false, error: emptyMessage };
	return { ok: true, code: r.data[0].code, roomId: r.data[0].room_id };
}

const ok = async (result: Promise<{ ok: boolean; error?: string }>): Promise<Ok> => {
	const r = await result;
	return r.ok ? { ok: true } : { ok: false, error: r.error ?? '' };
};

export function createRoom(
	userId: string,
	input: { themeId: string; settings?: Record<string, unknown> | null }
): Promise<CreateRoomResult> {
	return roomRef(
		rpc(
			userId,
			'create_room',
			{
				p_theme_id: input.themeId,
				p_settings: input.settings ? JSON.stringify(input.settings) : null
			},
			'rows'
		),
		"No s'ha pogut crear la sala."
	);
}

export function joinRoom(userId: string, code: string): Promise<JoinRoomResult> {
	return roomRef(
		rpc(userId, 'join_room', { p_code: code }, 'rows'),
		"No s'ha pogut unir a la sala."
	);
}

export function updateRoomSettings(
	userId: string,
	roomId: string,
	settings: Record<string, unknown>
): Promise<Ok> {
	return ok(
		rpc(userId, 'update_room_settings', {
			p_room_id: roomId,
			p_settings: JSON.stringify(settings)
		})
	);
}

export function leaveRoom(userId: string, roomId: string): Promise<Ok> {
	return ok(rpc(userId, 'leave_room', { p_room_id: roomId }));
}

export function deleteRoom(userId: string, roomId: string): Promise<Ok> {
	return ok(rpc(userId, 'delete_room', { p_room_id: roomId }));
}

export function kickMember(userId: string, roomId: string, targetId: string): Promise<Ok> {
	return ok(rpc(userId, 'kick_member', { p_room_id: roomId, p_user_id: targetId }));
}

export function transferHost(userId: string, roomId: string, newHostId: string): Promise<Ok> {
	return ok(rpc(userId, 'transfer_host', { p_room_id: roomId, p_new_host_user_id: newHostId }));
}

export type UserStats = {
	rooms_played: number;
	first_places: number;
	second_places: number;
	third_places: number;
	total_spent_cents: number;
	players_won: number;
	top_position: string | null;
	top_position_count: number;
};

export async function getUserStats(userId: string): Promise<UserStats | null> {
	const r = await rpc<UserStats | null>(userId, 'get_user_stats', { p_user_id: userId });
	return r.ok ? r.data : null;
}

/** Room id + host for a code, or null. Authorisation lives in the SQL functions. */
export async function roomByCode(code: string): Promise<{ id: string; host_id: string } | null> {
	const rows = await query<{ id: string; host_id: string }>(
		null,
		'select id, host_id from public.rooms where code = $1',
		[code]
	);
	return rows[0] ?? null;
}

/**
 * Marks `userId` as seen in the room and returns who has polled recently.
 * ponytail: one row write per poll per player; fine for a handful of players,
 * move to an in-memory/KV heartbeat if rooms ever get big.
 */
export async function touchPresence(roomId: string, userId: string): Promise<string[]> {
	const rows = await query<{ user_id: string }>(
		null,
		`with touch as (
			update public.room_members set last_seen_at = now()
			where room_id = $1 and user_id = $2
		)
		select user_id from public.room_members
		where room_id = $1 and (user_id = $2 or last_seen_at > now() - interval '10 seconds')`,
		[roomId, userId]
	);
	return rows.map((r) => r.user_id);
}

/** Most players a theme's pool can support (themes.filter_config.max_members), or null if unlimited. */
export async function themeMaxMembers(
	where: { themeId: string } | { roomId: string }
): Promise<number | null> {
	const rows =
		'themeId' in where
			? await query<{ cap: number | null }>(
					null,
					`select (filter_config->>'max_members')::int as cap from public.themes where id = $1`,
					[where.themeId]
				)
			: await query<{ cap: number | null }>(
					null,
					`select (t.filter_config->>'max_members')::int as cap
					 from public.rooms r join public.themes t on t.id = r.theme_id where r.id = $1`,
					[where.roomId]
				);
	return rows[0]?.cap ?? null;
}
