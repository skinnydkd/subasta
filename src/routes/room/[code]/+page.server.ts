import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isValidRoomCode, normalizeRoomCode } from '$lib/utils/roomCode';

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

	return {
		room,
		members: members ?? [],
		isHost: room.host_id === locals.user.id
	};
};
