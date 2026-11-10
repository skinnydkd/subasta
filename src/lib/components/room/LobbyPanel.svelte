<script lang="ts">
	import { enhance } from '$app/forms';
	import type { RoomData, RoomForm } from './shared';

	let { data, form }: { data: RoomData; form: RoomForm } = $props();

	const room = $derived(data.room);
	const members = $derived(data.members);
	const isHost = $derived(data.isHost);
	const isReadOnly = $derived(data.readOnly ?? false);
	const settings = $derived(room.settings as Record<string, number>);

	let starting = $state(false);
</script>

<section
	class="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-center"
>
	<p class="text-sm text-[color:var(--color-text-muted)]">
		{members.length} jugador{members.length === 1 ? '' : 's'} a la sala. Mínim 2 per a començar.
	</p>
	{#if isHost && !isReadOnly}
		<form
			method="POST"
			action="?/startRoom"
			class="mt-4"
			use:enhance={() => {
				starting = true;
				return async ({ update }) => {
					await update();
					starting = false;
				};
			}}
		>
			<button
				type="submit"
				disabled={starting || members.length < 2}
				class="w-full rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-3 text-base font-medium text-[color:var(--color-on-accent)] transition-colors hover:bg-[color:var(--color-accent-hover)] disabled:opacity-50"
			>
				{starting ? 'Iniciant…' : 'Iniciar subhasta'}
			</button>
		</form>
		{#if form && 'startRoom' in form && form.startRoom && 'error' in form.startRoom}
			<p class="mt-2 text-sm text-[color:var(--color-accent)]">{form.startRoom.error}</p>
		{/if}

		<details
			class="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-left"
		>
			<summary
				class="cursor-pointer text-xs tracking-widest text-[color:var(--color-text-faint)] uppercase"
			>
				Editar configuració
			</summary>
			<form method="POST" action="?/updateSettings" class="mt-3 flex flex-col gap-2" use:enhance>
				<label
					class="flex items-center justify-between gap-2 text-xs text-[color:var(--color-text-muted)]"
				>
					<span class="tracking-wider uppercase">Formació</span>
					<select
						name="formation"
						class="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
					>
						<option value="">— sense canvi —</option>
						<option value="4-3-3">4-3-3</option>
						<option value="4-4-2">4-4-2</option>
						<option value="3-5-2">3-5-2</option>
						<option value="5-3-2">5-3-2</option>
					</select>
				</label>
				<label
					class="flex items-center justify-between gap-2 text-xs text-[color:var(--color-text-muted)]"
				>
					<span class="tracking-wider uppercase">Timer</span>
					<select
						name="timer"
						class="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
					>
						<option value="">— sense canvi —</option>
						<option value="30">30s</option>
						<option value="60">60s</option>
						<option value="90">90s</option>
						<option value="120">120s</option>
					</select>
				</label>
				<div class="grid grid-cols-2 gap-2">
					<label class="flex flex-col gap-1 text-xs text-[color:var(--color-text-muted)]">
						<span class="tracking-wider uppercase">Jugadors</span>
						<input
							type="number"
							name="max_members"
							min="2"
							max="8"
							placeholder={String(settings.max_members ?? 5)}
							class="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
						/>
					</label>
					<label class="flex flex-col gap-1 text-xs text-[color:var(--color-text-muted)]">
						<span class="tracking-wider uppercase">Extres</span>
						<input
							type="number"
							name="extras"
							min="0"
							max="3"
							placeholder={String(settings.extra_per_position ?? 1)}
							class="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
						/>
					</label>
				</div>
				{#if form && 'settings' in form && form.settings && 'error' in form.settings}
					<p class="text-xs text-[color:var(--color-accent)]">{form.settings.error}</p>
				{/if}
				<button
					type="submit"
					class="rounded-[var(--radius-sm)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-3 py-2 text-sm transition-colors hover:bg-[color:var(--color-surface)]"
				>
					Aplicar canvis
				</button>
			</form>
		</details>

		<form
			method="POST"
			action="?/deleteRoom"
			class="mt-3"
			use:enhance={({ cancel }) => {
				if (!confirm('Tancar la sala? Els altres jugadors quedaran fora.')) cancel();
			}}
		>
			<button
				type="submit"
				class="text-xs text-[color:var(--color-text-faint)] hover:text-[color:var(--color-accent)]"
			>
				Tancar sala
			</button>
		</form>
	{:else}
		<p class="mt-3 text-sm text-[color:var(--color-text-muted)]">Esperant que l'amfitrió inicie…</p>
		{#if !isReadOnly}
			<form method="POST" action="?/leaveRoom" class="mt-4" use:enhance>
				<button
					type="submit"
					class="text-xs text-[color:var(--color-text-faint)] hover:text-[color:var(--color-accent)]"
				>
					Sortir de la sala
				</button>
			</form>
		{/if}
	{/if}
</section>
