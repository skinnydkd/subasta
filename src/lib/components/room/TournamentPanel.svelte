<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import type { MatchResult, TournamentResult } from '$lib/sim';
	import type { RoomData } from './shared';

	let { data }: { data: RoomData } = $props();

	const tournament = $derived(data.tournament as TournamentResult | null);
	const names = $derived(
		new Map(data.members.map((m) => [m.user_id, m.profile?.display_name ?? 'Convidat']))
	);
	const name = (id: string | null) => (id ? (names.get(id) ?? '—') : '—');

	// Reveal the matches one by one, like a results ticker. Everything shows at
	// once for people who prefer reduced motion, or after "Veure-ho tot".
	const total = $derived(tournament ? tournament.matches.length + (tournament.final ? 1 : 0) : 0);
	let shown = $state(0);
	const done = $derived(shown >= total);
	let simulating = $state(false);

	onMount(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			shown = Infinity;
			return;
		}
		const t = setInterval(() => {
			if (!tournament) return;
			shown += 1;
			if (shown >= total) clearInterval(t);
		}, 650);
		return () => clearInterval(t);
	});

	function score(m: MatchResult) {
		const pens = m.penalties ? ` (${m.penalties.home}-${m.penalties.away} pen.)` : '';
		return `${m.homeGoals}-${m.awayGoals}${m.extraTime && !m.penalties ? ' (pr.)' : ''}${pens}`;
	}
	function scorers(m: MatchResult) {
		return m.goals.map((g) => `${g.scorer} ${g.minute}'`).join(', ');
	}
</script>

{#if !tournament}
	<!-- Draft over, tournament not played yet -->
	<section
		class="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] p-6 text-center"
	>
		<h2 class="text-2xl" style="font-family: var(--font-display);">Torneig</h2>
		<p class="text-sm text-[color:var(--color-text-muted)]">
			Lliga a anada i tornada entre tots els equips. Els dos primers juguen la final. La força de
			cada línia ix del valor dels jugadors; els d'ofici puntuen baix.
		</p>
		{#if data.isHost && !data.readOnly}
			<form
				method="POST"
				action="?/finishVoting"
				use:enhance={() => {
					simulating = true;
					return async ({ update }) => {
						await update();
						simulating = false;
					};
				}}
			>
				<button
					type="submit"
					disabled={simulating}
					class="w-full rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-3 text-base font-medium text-[color:var(--color-on-accent)] transition-colors hover:bg-[color:var(--color-accent-hover)] active:bg-[color:var(--color-accent-active)] disabled:opacity-50"
				>
					{simulating ? 'Simulant…' : 'Simular torneig'}
				</button>
			</form>
		{:else}
			<p class="text-sm">Esperant que el host simule el torneig…</p>
		{/if}
	</section>
{:else}
	<section class="flex flex-col gap-4">
		{#if done && tournament.championId}
			<div
				class="rounded-[var(--radius-lg)] border border-[color:var(--color-accent)] bg-[color:var(--color-surface)] px-4 py-5 text-center"
			>
				<p class="text-sm text-[color:var(--color-text-muted)]">Campió</p>
				<p class="text-3xl" style="font-family: var(--font-display);">
					{name(tournament.championId)}
				</p>
				{#if tournament.topScorer}
					<p class="mt-2 text-sm text-[color:var(--color-text-muted)]">
						Màxim golejador: <span class="text-[color:var(--color-text)]"
							>{tournament.topScorer.name}</span
						>
						({name(tournament.topScorer.teamId)}), {tournament.topScorer.goals} gols
					</p>
				{/if}
			</div>
		{/if}

		{#if tournament.final && shown > tournament.matches.length}
			<div
				class="rounded-[var(--radius-lg)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-4 py-3"
			>
				<p class="text-sm text-[color:var(--color-text-muted)]">Final</p>
				<p class="tnum text-lg">
					{name(tournament.final.homeId)}
					<span class="px-1">{score(tournament.final)}</span>
					{name(tournament.final.awayId)}
				</p>
				{#if tournament.final.goals.length}
					<p class="text-xs text-[color:var(--color-text-muted)]">{scorers(tournament.final)}</p>
				{/if}
			</div>
		{/if}

		{#if tournament.matches.length && done}
			<div class="overflow-x-auto">
				<table class="tnum w-full text-sm">
					<caption class="mb-2 text-left text-sm text-[color:var(--color-text-muted)]"
						>Classificació</caption
					>
					<thead class="text-xs text-[color:var(--color-text-faint)]">
						<tr>
							<th class="py-1 text-left font-normal">Equip</th>
							<th class="font-normal" title="Partits jugats">PJ</th>
							<th class="font-normal" title="Guanyats">G</th>
							<th class="font-normal" title="Empatats">E</th>
							<th class="font-normal" title="Perduts">P</th>
							<th class="font-normal" title="Gols a favor i en contra">Gols</th>
							<th class="font-normal">Pts</th>
						</tr>
					</thead>
					<tbody>
						{#each tournament.table as row, i (row.teamId)}
							<tr class="border-t border-[color:var(--color-border)] text-center">
								<td class="py-2 text-left">
									<span class="text-[color:var(--color-text-faint)]">{i + 1}</span>
									{name(row.teamId)}
								</td>
								<td>{row.played}</td>
								<td>{row.won}</td>
								<td>{row.drawn}</td>
								<td>{row.lost}</td>
								<td>{row.goalsFor}:{row.goalsAgainst}</td>
								<td class="font-medium">{row.points}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		{#if tournament.matches.length}
			<ol class="flex flex-col gap-1.5">
				{#each tournament.matches.slice(0, shown) as m, i (i)}
					<li class="rounded-[var(--radius)] bg-[color:var(--color-surface)] px-3 py-2 text-sm">
						<p class="tnum">
							{name(m.homeId)} <span class="px-1 font-medium">{score(m)}</span>
							{name(m.awayId)}
						</p>
						{#if m.goals.length}
							<p class="text-xs text-[color:var(--color-text-faint)]">{scorers(m)}</p>
						{/if}
					</li>
				{/each}
			</ol>
		{/if}

		{#if !done}
			<button
				type="button"
				onclick={() => (shown = Infinity)}
				class="rounded-[var(--radius)] border border-[color:var(--color-border-strong)] px-4 py-2 text-sm hover:bg-[color:var(--color-elevated)]"
			>
				Veure-ho tot
			</button>
		{/if}
	</section>
{/if}
