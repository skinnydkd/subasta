<script lang="ts">
	import { onMount } from 'svelte';
	import { installPrompt } from '$lib/pwa/installPrompt.svelte';

	onMount(() => installPrompt.init());
</script>

{#if installPrompt.canInstall}
	<div
		class="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-3 py-2 text-sm"
	>
		<span>Instal·la l'app per a una millor experiència.</span>
		<div class="flex gap-2">
			<button
				type="button"
				onclick={() => installPrompt.install()}
				class="rounded-[var(--radius-sm)] bg-[color:var(--color-accent)] px-3 py-1 text-xs font-medium tracking-wider text-white uppercase hover:bg-[color:var(--color-accent-hover)]"
			>
				Instal·la
			</button>
			<button
				type="button"
				onclick={() => installPrompt.dismiss()}
				class="rounded-[var(--radius-sm)] px-2 py-1 text-xs text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
				aria-label="Tanca"
			>
				✕
			</button>
		</div>
	</div>
{:else if installPrompt.iosInstallHint}
	<div
		class="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-xs text-[color:var(--color-text-muted)]"
	>
		<span
			>Per instal·lar: toca <span class="text-[color:var(--color-text)]">Compartir</span> →
			<span class="text-[color:var(--color-text)]">Afig a inici</span>.</span
		>
		<button
			type="button"
			onclick={() => installPrompt.dismiss()}
			class="text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text)]"
			aria-label="Tanca"
		>
			✕
		</button>
	</div>
{/if}
