import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/db';

export type CreateRoomResult =
	| { ok: true; code: string; roomId: string }
	| { ok: false; error: string };

type RpcAny = (
	fn: string,
	args: unknown
) => Promise<{ data: unknown; error: { message: string } | null }>;

function rawRpc(supabase: SupabaseClient<Database>): RpcAny {
	return (supabase.rpc as unknown as RpcAny).bind(supabase);
}

export async function createRoom(
	supabase: SupabaseClient<Database>,
	input: { themeId: string; settings?: Record<string, unknown> | null }
): Promise<CreateRoomResult> {
	const { data, error } = await rawRpc(supabase)('create_room', {
		p_theme_id: input.themeId,
		p_settings: input.settings ?? null
	});
	if (error) return { ok: false, error: error.message };
	const rows = data as Array<{ room_id: string; code: string }>;
	if (!rows?.length) return { ok: false, error: 'No s\'ha pogut crear la sala.' };
	return { ok: true, code: rows[0].code, roomId: rows[0].room_id };
}

export async function updateRoomSettings(
	supabase: SupabaseClient<Database>,
	roomId: string,
	settings: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
	const { error } = await rawRpc(supabase)('update_room_settings', {
		p_room_id: roomId,
		p_settings: settings
	});
	if (error) return { ok: false, error: error.message };
	return { ok: true };
}

export type JoinRoomResult =
	| { ok: true; code: string; roomId: string }
	| { ok: false; error: string };

export async function joinRoom(
	supabase: SupabaseClient<Database>,
	code: string
): Promise<JoinRoomResult> {
	const { data, error } = await rawRpc(supabase)('join_room', { p_code: code });
	if (error) return { ok: false, error: error.message };
	const rows = data as Array<{ room_id: string; code: string }>;
	if (!rows?.length) return { ok: false, error: 'No s\'ha pogut unir a la sala.' };
	return { ok: true, code: rows[0].code, roomId: rows[0].room_id };
}

export async function leaveRoom(
	supabase: SupabaseClient<Database>,
	roomId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	const { error } = await rawRpc(supabase)('leave_room', { p_room_id: roomId });
	if (error) return { ok: false, error: error.message };
	return { ok: true };
}

export async function deleteRoom(
	supabase: SupabaseClient<Database>,
	roomId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	const { error } = await rawRpc(supabase)('delete_room', { p_room_id: roomId });
	if (error) return { ok: false, error: error.message };
	return { ok: true };
}

export async function kickMember(
	supabase: SupabaseClient<Database>,
	roomId: string,
	userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	const { error } = await rawRpc(supabase)('kick_member', {
		p_room_id: roomId,
		p_user_id: userId
	});
	if (error) return { ok: false, error: error.message };
	return { ok: true };
}

export async function transferHost(
	supabase: SupabaseClient<Database>,
	roomId: string,
	newHostUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
	const { error } = await rawRpc(supabase)('transfer_host', {
		p_room_id: roomId,
		p_new_host_user_id: newHostUserId
	});
	if (error) return { ok: false, error: error.message };
	return { ok: true };
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

export async function getUserStats(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<UserStats | null> {
	const { data, error } = await rawRpc(supabase)('get_user_stats', { p_user_id: userId });
	if (error) return null;
	return data as UserStats | null;
}
