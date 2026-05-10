<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { formatCents } from '$lib/utils/currency';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let creating = $state(false);
	let joining = $state(false);
	let signing = $state(false);

	type RecentRoom = { code: string; visited_at: number; status?: string };
	let recentRooms = $state<RecentRoom[]>([]);
	onMount(() => {
		try {
			const raw = localStorage.getItem('subasta:recent_rooms');
			recentRooms = raw ? (JSON.parse(raw) as RecentRoom[]) : [];
		} catch {
			recentRooms = [];
		}
	});

	function clearRecent() {
		recentRooms = [];
		try {
			localStorage.removeItem('subasta:recent_rooms');
		} catch {}
	}
</script>

<main
	class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 px-6 py-16"
	style="padding-bottom: max(4rem, env(safe-area-inset-bottom)); padding-top: max(4rem, env(safe-area-inset-top));"
>
	<header class="space-y-2 text-center">
		<h1 class="text-balance" style="font-family: var(--font-display);">subasta</h1>
		<p class="text-[color:var(--color-text-muted)]">
			Subhasta de jugadors amb amics. 1.000M€. Que guanye el millor equip.
		</p>
	</header>

	{#if !data.user}
		<form
			method="POST"
			action="?/signIn"
			class="flex flex-col gap-3"
			use:enhance={() => {
				signing = true;
				return async ({ update }) => {
					await update();
					signing = false;
				};
			}}
		>
			<label class="flex flex-col gap-2">
				<span class="text-sm text-[color:var(--color-text-muted)]">Quin nom et posem?</span>
				<input
					name="display_name"
					type="text"
					maxlength="30"
					required
					autocomplete="nickname"
					placeholder="Pau"
					class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-base outline-none transition-colors focus:border-[color:var(--color-accent)]"
				/>
			</label>
			{#if form?.signIn && 'error' in form.signIn}
				<p class="text-sm text-[color:var(--color-accent)]">{form.signIn.error}</p>
			{/if}
			<button
				type="submit"
				disabled={signing}
				class="rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-3 text-base font-medium text-[color:var(--color-on-accent)] transition-colors hover:bg-[color:var(--color-accent-hover)] disabled:opacity-50"
			>
				{signing ? 'Entrant…' : 'Entrar'}
			</button>
		</form>
	{:else}
		<div class="flex flex-col gap-2 text-center">
			<p class="text-sm text-[color:var(--color-text-muted)]">Hola,</p>
			<p class="text-2xl" style="font-family: var(--font-display);">{data.profile?.display_name ?? 'Convidat'}</p>
		</div>

		{#if data.user}
			{#if data.user.is_anonymous && !data.user.email}
				<details class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2">
					<summary class="cursor-pointer text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">
						Guardar el teu compte
					</summary>
					<form
						method="POST"
						action="?/linkEmail"
						class="mt-3 flex flex-col gap-2"
						use:enhance
					>
						<p class="text-xs text-[color:var(--color-text-muted)]">
							Si poses un email, podràs recuperar el teu compte i historial des d'altres dispositius.
						</p>
						<input
							name="email"
							type="email"
							required
							placeholder="tu@example.com"
							class="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-sm"
						/>
						{#if form && 'linkEmail' in form && form.linkEmail && 'error' in form.linkEmail}
							<p class="text-xs text-[color:var(--color-accent)]">{form.linkEmail.error}</p>
						{/if}
						{#if form && 'linkEmail' in form && form.linkEmail && 'ok' in form.linkEmail && form.linkEmail.ok}
							<p class="text-xs text-[color:var(--color-success)]">
								Email enviat. Revisa la safata d'entrada per a verificar.
							</p>
						{/if}
						<button
							type="submit"
							class="rounded-[var(--radius-sm)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-3 py-2 text-sm transition-colors hover:bg-[color:var(--color-surface)]"
						>
							Enviar email
						</button>
					</form>
				</details>
			{:else if data.user.email && data.user.is_anonymous}
				<p class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-center text-xs text-[color:var(--color-text-muted)]">
					Email pendent de verificar a <span class="text-[color:var(--color-text)]">{data.user.email}</span>
				</p>
			{:else if data.user.email}
				<p class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-center text-xs text-[color:var(--color-text-muted)]">
					Compte vinculat amb <span class="text-[color:var(--color-text)]">{data.user.email}</span>
				</p>
			{/if}
		{/if}

		<section class="flex flex-col gap-3">
			<h2 class="text-xl">Crear sala</h2>

			{#if data.themes.length === 0}
				<p class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-sm text-[color:var(--color-text-muted)]">
					Cap tema disponible encara. Carrega un tema a la BD per a començar.
				</p>
			{:else}
				<form
					method="POST"
					action="?/createRoom"
					class="flex flex-col gap-3"
					use:enhance={() => {
						creating = true;
						return async ({ update }) => {
							await update();
							creating = false;
						};
					}}
				>
					<label class="flex flex-col gap-2">
						<span class="text-sm text-[color:var(--color-text-muted)]">Tema</span>
						<select
							name="theme_id"
							required
							class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-base outline-none focus:border-[color:var(--color-accent)]"
						>
							{#each data.themes as theme}
								<option value={theme.id}>{theme.display_name}</option>
							{/each}
						</select>
					</label>

					<details class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2">
						<summary class="cursor-pointer text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">
							Configuració avançada
						</summary>
						<div class="mt-3 flex flex-col gap-3">
							<label class="flex flex-col gap-1">
								<span class="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Formació</span>
								<select
									name="formation"
									class="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-sm"
								>
									<option value="4-3-3" selected>4-3-3</option>
									<option value="4-4-2">4-4-2</option>
									<option value="3-5-2">3-5-2</option>
									<option value="5-3-2">5-3-2</option>
								</select>
							</label>

							<label class="flex flex-col gap-1">
								<span class="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Timer per puja (s)</span>
								<select
									name="timer"
									class="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-sm"
								>
									<option value="30">30s — ràpid</option>
									<option value="60" selected>60s — normal</option>
									<option value="90">90s — relaxat</option>
									<option value="120">120s — molt relaxat</option>
								</select>
							</label>

							<div class="grid grid-cols-2 gap-3">
								<label class="flex flex-col gap-1">
									<span class="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Jugadors</span>
									<input
										type="number"
										name="max_members"
										value="5"
										min="2"
										max="8"
										class="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-sm"
									/>
								</label>
								<label class="flex flex-col gap-1">
									<span class="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Extres/posició</span>
									<input
										type="number"
										name="extras"
										value="1"
										min="0"
										max="3"
										class="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-sm"
									/>
								</label>
							</div>
						</div>
					</details>

					{#if form && 'create' in form && form.create && 'error' in form.create}
						<p class="text-sm text-[color:var(--color-accent)]">{form.create.error}</p>
					{/if}
					<button
						type="submit"
						disabled={creating}
						class="rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-3 text-base font-medium text-[color:var(--color-on-accent)] transition-colors hover:bg-[color:var(--color-accent-hover)] disabled:opacity-50"
					>
						{creating ? 'Creant…' : 'Crear sala'}
					</button>
				</form>
			{/if}
		</section>

		<div class="flex items-center gap-3">
			<div class="h-px flex-1 bg-[color:var(--color-border)]"></div>
			<span class="text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">o</span>
			<div class="h-px flex-1 bg-[color:var(--color-border)]"></div>
		</div>

		<section class="flex flex-col gap-3">
			<h2 class="text-xl">Unir-se per codi</h2>
			<form
				method="POST"
				action="?/joinRoom"
				class="flex flex-col gap-3"
				use:enhance={() => {
					joining = true;
					return async ({ update }) => {
						await update();
						joining = false;
					};
				}}
			>
				<input
					name="code"
					type="text"
					inputmode="text"
					maxlength="6"
					autocapitalize="characters"
					autocomplete="off"
					required
					placeholder="ABC234"
					class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-center text-2xl uppercase tracking-[0.4em] tnum outline-none focus:border-[color:var(--color-accent)]"
					style="font-family: var(--font-mono);"
				/>
				{#if form?.join?.error}
					<p class="text-sm text-[color:var(--color-accent)]">{form.join.error}</p>
				{/if}
				<button
					type="submit"
					disabled={joining}
					class="rounded-[var(--radius)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-4 py-3 text-base font-medium text-[color:var(--color-text)] transition-colors hover:bg-[color:var(--color-surface)] disabled:opacity-50"
				>
					{joining ? 'Entrant…' : 'Entrar a la sala'}
				</button>
			</form>
		</section>
	{/if}

	{#if data.stats && data.stats.rooms_played > 0}
		<section class="flex flex-col gap-2">
			<h2 class="text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">Les meves estadístiques</h2>
			<div class="grid grid-cols-3 gap-2">
				<div class="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-center">
					<p class="text-2xl tnum">{data.stats.rooms_played}</p>
					<p class="text-[10px] uppercase tracking-wider text-[color:var(--color-text-faint)]">sales</p>
				</div>
				<div class="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-center">
					<p class="text-2xl tnum">{data.stats.first_places}</p>
					<p class="text-[10px] uppercase tracking-wider text-[color:var(--color-text-faint)]">1rs llocs</p>
				</div>
				<div class="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-center">
					<p class="text-2xl tnum">{data.stats.players_won}</p>
					<p class="text-[10px] uppercase tracking-wider text-[color:var(--color-text-faint)]">jugadors</p>
				</div>
			</div>
			{#if data.stats.total_spent_cents > 0 || data.stats.top_position}
				<div class="flex justify-between rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-xs text-[color:var(--color-text-muted)]">
					{#if data.stats.total_spent_cents > 0}
						<span>Total gastat: <span class="tnum text-[color:var(--color-text)]">{formatCents(data.stats.total_spent_cents)}</span></span>
					{/if}
					{#if data.stats.top_position}
						<span>Posició preferida: <span class="text-[color:var(--color-text)]">{data.stats.top_position}</span></span>
					{/if}
				</div>
			{/if}
		</section>
	{/if}

	{#if recentRooms.length > 0}
		<section class="flex flex-col gap-2">
			<div class="flex items-baseline justify-between">
				<h2 class="text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">Sales recents</h2>
				<button
					type="button"
					onclick={clearRecent}
					class="text-xs text-[color:var(--color-text-faint)] hover:text-[color:var(--color-accent)]"
				>
					Esborrar
				</button>
			</div>
			<ul class="flex flex-col gap-1">
				{#each recentRooms as r (r.code)}
					<li>
						<a
							href={`/room/${r.code}`}
							class="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm transition-colors hover:bg-[color:var(--color-elevated)]"
						>
							<span class="tnum tracking-[0.3em]" style="font-family: var(--font-mono);">{r.code}</span>
							<span class="text-xs text-[color:var(--color-text-faint)]">
								{r.status === 'finished' ? 'acabada' : r.status === 'voting' ? 'votant' : r.status === 'drafting' ? 'en joc' : 'lobby'}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>
