import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createRoom, joinRoom } from '$lib/server/rooms';
import { isValidRoomCode, normalizeRoomCode } from '$lib/utils/roomCode';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { user: null, profile: null, themes: [] };
	}

	const [{ data: profile }, { data: themes }] = await Promise.all([
		locals.supabase
			.from('profiles')
			.select('id, display_name')
			.eq('id', locals.user.id)
			.maybeSingle(),
		locals.supabase
			.from('themes')
			.select('id, slug, display_name, description, cover_image_url')
			.eq('is_published', true)
			.order('display_name')
	]);

	return { user: locals.user, profile, themes: themes ?? [] };
};

export const actions: Actions = {
	signIn: async ({ request, locals }) => {
		const formData = await request.formData();
		const displayName = String(formData.get('display_name') ?? '').trim();

		if (!displayName) {
			return fail(400, { signIn: { error: 'Posa\'t un nom.' } });
		}
		if (displayName.length > 30) {
			return fail(400, { signIn: { error: 'El nom és massa llarg (màx 30).' } });
		}

		const { error } = await locals.supabase.auth.signInAnonymously({
			options: { data: { display_name: displayName } }
		});

		if (error) {
			return fail(500, { signIn: { error: error.message } });
		}

		return { signIn: { ok: true } };
	},

	createRoom: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { create: { error: 'No autenticat.' } });

		const formData = await request.formData();
		const themeId = String(formData.get('theme_id') ?? '').trim();
		if (!themeId) return fail(400, { create: { error: 'Selecciona un tema.' } });

		const result = await createRoom(locals.supabase, {
			hostId: locals.user.id,
			themeId
		});

		if (!result.ok) {
			return fail(500, { create: { error: result.error } });
		}

		throw redirect(303, `/room/${result.code}`);
	},

	joinRoom: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { join: { error: 'No autenticat.' } });

		const formData = await request.formData();
		const raw = String(formData.get('code') ?? '');
		const code = normalizeRoomCode(raw);

		if (!isValidRoomCode(code)) {
			return fail(400, { join: { error: 'Codi invàlid (6 caràcters).' } });
		}

		const result = await joinRoom(locals.supabase, locals.user.id, code);
		if (!result.ok) {
			return fail(400, { join: { error: result.error } });
		}

		throw redirect(303, `/room/${result.code}`);
	}
};
