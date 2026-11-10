import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createRoom, getUserStats, joinRoom } from '$lib/server/rooms';
import { isValidRoomCode, normalizeRoomCode } from '$lib/utils/roomCode';
import { query } from '$lib/server/db';
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from '$lib/server/session';
import { env } from '$env/dynamic/private';
import { FORMATION_PRESETS, type FormationPreset } from '$lib/auction/settings';

type Theme = {
	id: string;
	slug: string;
	display_name: string;
	description: string | null;
	cover_image_url: string | null;
};

export const load: PageServerLoad = async ({ locals }) => {
	const none = { user: null, profile: null, themes: [], stats: null };
	if (!locals.user) return none;
	const uid = locals.user.id;

	const [profiles, themes, stats] = await Promise.all([
		query<{ id: string; display_name: string }>(
			null,
			'select id, display_name from public.profiles where id = $1',
			[uid]
		),
		query<Theme>(
			null,
			`select id, slug, display_name, description, cover_image_url
			 from public.themes where is_published order by display_name`
		),
		getUserStats(uid)
	]);

	// A valid cookie for a user that no longer exists (e.g. after a DB reset):
	// treat as signed out so the name form shows again.
	if (!profiles[0]) return none;

	return { user: locals.user, profile: profiles[0], themes, stats };
};

export const actions: Actions = {
	signIn: async ({ request, cookies, url }) => {
		const formData = await request.formData();
		const displayName = String(formData.get('display_name') ?? '').trim();

		if (!displayName) {
			return fail(400, { signIn: { error: "Posa't un nom." } });
		}
		if (displayName.length > 30) {
			return fail(400, { signIn: { error: 'El nom és massa llarg (màx 30).' } });
		}

		let id: string;
		try {
			const rows = await query<{ id: string }>(
				null,
				`insert into auth.users (raw_user_meta_data)
				 values (jsonb_build_object('display_name', $1::text)) returning id`,
				[displayName]
			);
			id = rows[0].id;
		} catch (err) {
			console.error('signIn failed', err);
			return fail(500, { signIn: { error: "No s'ha pogut crear el jugador." } });
		}

		cookies.set(SESSION_COOKIE, await signSession(id, env.SESSION_SECRET!), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: SESSION_MAX_AGE
		});

		return { signIn: { ok: true } };
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

		const result = await createRoom(locals.user.id, { themeId, settings });

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

		const result = await joinRoom(locals.user.id, code);
		if (!result.ok) {
			return fail(400, { join: { error: result.error } });
		}

		throw redirect(303, `/room/${result.code}`);
	}
};
