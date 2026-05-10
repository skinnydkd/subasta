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
	input: { themeId: string }
): Promise<CreateRoomResult> {
	const { data, error } = await rawRpc(supabase)('create_room', { p_theme_id: input.themeId });
	if (error) return { ok: false, error: error.message };
	const rows = data as Array<{ room_id: string; code: string }>;
	if (!rows?.length) return { ok: false, error: 'No s\'ha pogut crear la sala.' };
	return { ok: true, code: rows[0].code, roomId: rows[0].room_id };
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
