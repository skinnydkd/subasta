<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const room = $derived(data.room);
	const members = $derived(data.members);
	const isHost = $derived(data.isHost);
	const status = $derived(room.status);

	function copyCode() {
		navigator.clipboard.writeText(room.code).catch(() => {});
	}
</script>

<main class="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-6 py-10">
	<header class="flex flex-col gap-3 text-center">
		<p class="text-xs uppercase tracking-[0.3em] text-[color:var(--color-text-faint)]">Codi de sala</p>
		<button
			type="button"
			onclick={copyCode}
			class="rounded-[var(--radius-lg)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-6 py-4 text-4xl tracking-[0.4em] tnum transition-colors hover:bg-[color:var(--color-surface)]"
			style="font-family: var(--font-mono);"
			title="Toca per copiar"
		>
			{room.code}
		</button>
		{#if room.theme}
			<p class="text-sm text-[color:var(--color-text-muted)]">
				Tema: <span class="text-[color:var(--color-text)]">{room.theme.display_name}</span>
			</p>
		{/if}
	</header>

	<section class="flex flex-col gap-3">
		<div class="flex items-baseline justify-between">
			<h2 class="text-xl">Jugadors</h2>
			<span class="text-sm text-[color:var(--color-text-muted)] tnum">{members.length}/5</span>
		</div>
		<ul class="flex flex-col gap-2">
			{#each members as member}
				<li
					class="flex items-center justify-between rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3"
				>
					<span>{member.profile?.display_name ?? 'Convidat'}</span>
					{#if member.user_id === room.host_id}
						<span class="rounded-full bg-[color:var(--color-accent-muted)] px-2 py-0.5 text-xs uppercase tracking-wider text-[color:var(--color-on-accent)]">
							host
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section class="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-center">
		{#if status === 'lobby'}
			<p class="text-sm text-[color:var(--color-text-muted)]">
				Esperant que {isHost ? 'inicies' : 'l\'amfitrió inicie'} la subhasta…
			</p>
			{#if isHost}
				<button
					type="button"
					disabled
					title="Disponible quan l'auction engine estigui llest (fase 4)"
					class="mt-4 rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-3 text-base font-medium text-[color:var(--color-on-accent)] opacity-50"
				>
					Iniciar subhasta
				</button>
			{/if}
		{:else if status === 'drafting'}
			<p>Subhasta en marxa.</p>
		{:else if status === 'voting'}
			<p>Fase de votació.</p>
		{:else}
			<p>Partida finalitzada.</p>
		{/if}
	</section>

	<a href="/" class="text-center text-sm text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]">
		← Tornar al lobby
	</a>
</main>
