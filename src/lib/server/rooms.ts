import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/db';
import { generateRoomCode } from '$lib/utils/roomCode';
import { DEFAULT_ROOM_SETTINGS, STARTING_BUDGET_CENTS } from '$lib/auction/settings';

export type CreateRoomInput = {
	hostId: string;
	themeId: string;
};

export type CreateRoomResult =
	| { ok: true; code: string; roomId: string }
	| { ok: false; error: string };

const MAX_CODE_RETRIES = 5;

export async function createRoom(
	supabase: SupabaseClient<Database>,
	input: CreateRoomInput
): Promise<CreateRoomResult> {
	for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
		const code = generateRoomCode();
		const { data: room, error } = await supabase
			.from('rooms')
			.insert({
				code,
				host_id: input.hostId,
				theme_id: input.themeId,
				settings: DEFAULT_ROOM_SETTINGS as never
			})
			.select('id, code')
			.single();

		if (error) {
			// 23505 = unique_violation (code collision); retry
			if (error.code === '23505') continue;
			return { ok: false, error: error.message };
		}

		const { error: memberError } = await supabase.from('room_members').insert({
			room_id: room.id,
			user_id: input.hostId,
			budget_remaining_cents: STARTING_BUDGET_CENTS
		});

		if (memberError) {
			return { ok: false, error: memberError.message };
		}

		return { ok: true, code: room.code, roomId: room.id };
	}

	return { ok: false, error: 'No s\'ha pogut generar un codi únic. Torna-ho a provar.' };
}

export type JoinRoomResult =
	| { ok: true; code: string; roomId: string }
	| { ok: false; error: string };

export async function joinRoom(
	supabase: SupabaseClient<Database>,
	userId: string,
	code: string
): Promise<JoinRoomResult> {
	const { data: room, error } = await supabase
		.from('rooms')
		.select('id, code, status, settings')
		.eq('code', code)
		.maybeSingle();

	if (error) return { ok: false, error: error.message };
	if (!room) return { ok: false, error: 'Sala no trobada.' };
	if (room.status !== 'lobby') {
		return { ok: false, error: 'La sala ja ha començat o ha acabat.' };
	}

	// Capacity check
	const settings = room.settings as { max_members?: number };
	const maxMembers = settings.max_members ?? DEFAULT_ROOM_SETTINGS.max_members;
	const { count } = await supabase
		.from('room_members')
		.select('*', { count: 'exact', head: true })
		.eq('room_id', room.id);

	if ((count ?? 0) >= maxMembers) {
		return { ok: false, error: 'La sala ja està plena.' };
	}

	// Idempotent: if already a member, just return success.
	const { error: memberError } = await supabase.from('room_members').upsert(
		{
			room_id: room.id,
			user_id: userId,
			budget_remaining_cents: STARTING_BUDGET_CENTS
		},
		{ onConflict: 'room_id,user_id', ignoreDuplicates: true }
	);

	if (memberError) return { ok: false, error: memberError.message };

	return { ok: true, code: room.code, roomId: room.id };
}
