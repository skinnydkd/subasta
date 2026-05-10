import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createRoom, getUserStats, joinRoom } from '$lib/server/rooms';
import { isValidRoomCode, normalizeRoomCode } from '$lib/utils/roomCode';
import { FORMATION_PRESETS, type FormationPreset } from '$lib/auction/settings';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { user: null, profile: null, themes: [], stats: null };
	}

	const [{ data: profile }, { data: themes }, stats] = await Promise.all([
		locals.supabase
			.from('profiles')
			.select('id, display_name')
			.eq('id', locals.user.id)
			.maybeSingle(),
		locals.supabase
			.from('themes')
			.select('id, slug, display_name, description, cover_image_url')
			.eq('is_published', true)
			.order('display_name'),
		getUserStats(locals.supabase, locals.user.id)
	]);

	return { user: locals.user, profile, themes: themes ?? [], stats };
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

	linkEmail: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { linkEmail: { error: 'No autenticat.' } });

		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim().toLowerCase();
		if (!email || !email.includes('@') || email.length > 254) {
			return fail(400, { linkEmail: { error: 'Email invàlid.' } });
		}

		const { error } = await locals.supabase.auth.updateUser({ email });
		if (error) {
			return fail(400, { linkEmail: { error: error.message } });
		}
		return { linkEmail: { ok: true, email } };
	},

	createRoom: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { create: { error: 'No autenticat.' } });

		const formData = await request.formData();
		const themeId = String(formData.get('theme_id') ?? '').trim();
		if (!themeId) return fail(400, { create: { error: 'Selecciona un tema.' } });

		// Optional advanced settings.
		const formation = String(formData.get('formation') ?? '4-3-3') as FormationPreset;
		const timer = Number.parseInt(String(formData.get('timer') ?? '60'), 10);
		const maxMembers = Number.parseInt(String(formData.get('max_members') ?? '5'), 10);
		const extras = Number.parseInt(String(formData.get('extras') ?? '1'), 10);

		const settings: Record<string, unknown> = {};
		if (FORMATION_PRESETS[formation]) {
			settings.formation = FORMATION_PRESETS[formation];
		}
		if (Number.isFinite(timer) && timer >= 10 && timer <= 600) {
			settings.timer_seconds = timer;
		}
		if (Number.isFinite(maxMembers) && maxMembers >= 2 && maxMembers <= 8) {
			settings.max_members = maxMembers;
		}
		if (Number.isFinite(extras) && extras >= 0 && extras <= 3) {
			settings.extra_per_position = extras;
		}

		const result = await createRoom(locals.supabase, { themeId, settings });

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

		const result = await joinRoom(locals.supabase, code);
		if (!result.ok) {
			return fail(400, { join: { error: result.error } });
		}

		throw redirect(303, `/room/${result.code}`);
	}
};
