<script lang="ts">
	import { onMount } from 'svelte';
	import type { ChallengeResult, Medal } from '$lib/sim';
	import type { Challenge } from '$lib/server/legends';
	import type { RoomData } from './shared';

	let { data }: { data: RoomData } = $props();

	const challenge = $derived(data.challenge as Challenge | null);
	const myUserId = $derived(data.user?.id ?? null);
	const mine = $derived(myUserId && challenge ? (challenge.results[myUserId] ?? null) : null);
	const names = $derived(
		new Map(data.members.map((m) => [m.user_id, m.profile?.display_name ?? 'Convidat']))
	);

	const MEDAL: Record<Exclude<Medal, null>, { label: string; text: string }> = {
		or: { label: 'Or', text: '7-0. Repte superat!' },
		plata: { label: 'Plata', text: 'Golejada.' },
		bronze: { label: 'Bronze', text: 'Victòria.' }
	};

	// Which rivals this browser has already watched (only to skip the replay;
	// the result itself is fixed by the room, player and rival).
	const storageKey = $derived(`subasta:challenge:${data.room.id}`);
	let played = $state<string[]>([]);
	onMount(() => {
		try {
			played = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
		} catch {
			played = [];
		}
	});
	function remember(key: string) {
		played = [...played, key];
		try {
			localStorage.setItem(storageKey, JSON.stringify(played));
		} catch {
			// storage unavailable: the replay will just show again
		}
	}

	// Live replay: the match clock runs 0 → 90 in a few seconds.
	let live = $state<{ key: string; minute: number } | null>(null);
	function play(key: string) {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			remember(key);
			return;
		}
		live = { key, minute: 0 };
		const t = setInterval(() => {
			if (!live) return clearInterval(t);
			live = { key, minute: live.minute + 1 };
			if (live.minute >= 90) {
				clearInterval(t);
				live = null;
				remember(key);
			}
		}, 55);
	}

	function scoreAt(r: ChallengeResult, rivalId: string, minute: number) {
		const goals = r.match.goals.filter((g) => g.minute <= minute);
		const against = goals.filter((g) => g.teamId === rivalId).length;
		return { gf: goals.length - against, ga: against, goals };
	}

	function othersFor(key: string) {
		if (!challenge) return [];
		return Object.entries(challenge.results)
			.map(([userId, byRival]) => ({ userId, r: byRival[key] }))
			.filter((x) => x.r)
			.sort((a, b) => b.r.goalsFor - b.r.goalsAgainst - (a.r.goalsFor - a.r.goalsAgainst));
	}
</script>

{#if challenge}
	<section class="flex flex-col gap-3">
		<header>
			<h2 class="text-2xl" style="font-family: var(--font-display);">Repte 7-0</h2>
			<p class="text-sm text-[color:var(--color-text-muted)]">
				El teu equip visita tres rivals històrics. Un sol intent per rival: guanya per bronze,
				golejada de tres per plata, i un 7-0 per l'or.
			</p>
		</header>

		<div class="grid gap-3 lg:grid-cols-3">
			{#each challenge.rivals as rival (rival.key)}
				{@const result = mine?.[rival.key]}
				{@const isLive = live?.key === rival.key}
				{@const seen = played.includes(rival.key)}
				<article
					class="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] p-4"
				>
					<div>
						<p class="text-xs text-[color:var(--color-text-muted)]">{rival.tierLabel}</p>
						<h3 class="text-xl" style="font-family: var(--font-display);">{rival.name}</h3>
						<p class="tnum text-xs text-[color:var(--color-text-faint)]">
							Valoració {rival.rating}
						</p>
					</div>

					<details class="text-xs text-[color:var(--color-text-muted)]">
						<summary class="cursor-pointer">Onze</summary>
						<p class="mt-1">
							{rival.team.players.map((p) => `${p.name} (${p.position})`).join(', ')}
						</p>
					</details>

					{#if result && (isLive || seen)}
						{@const s = scoreAt(result, rival.team.id, isLive ? live!.minute : 120)}
						<div class="text-center" aria-live="polite">
							<p class="tnum text-4xl" style="font-family: var(--font-display);">
								{s.gf}-{s.ga}
							</p>
							<p class="tnum text-xs text-[color:var(--color-text-muted)]">
								{isLive ? `${live!.minute}'` : 'Final'}
							</p>
							{#if s.goals.length}
								<p class="mt-1 text-xs text-[color:var(--color-text-faint)]">
									{s.goals.map((g) => `${g.scorer} ${g.minute}'`).join(', ')}
								</p>
							{/if}
						</div>
						{#if !isLive}
							<p
								class="rounded-[var(--radius)] px-3 py-2 text-center text-sm"
								class:bg-[color:var(--color-accent)]={result.medal === 'or'}
								class:text-[color:var(--color-on-accent)]={result.medal === 'or'}
								class:bg-[color:var(--color-elevated)]={result.medal !== 'or'}
							>
								{#if result.medal}
									<span class="font-medium">{MEDAL[result.medal].label}</span> · {MEDAL[
										result.medal
									].text}
								{:else}
									Sense medalla.
								{/if}
							</p>
						{/if}
					{:else if result}
						<button
							type="button"
							onclick={() => play(rival.key)}
							disabled={!!live}
							class="rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-[color:var(--color-on-accent)] transition-colors hover:bg-[color:var(--color-accent-hover)] active:bg-[color:var(--color-accent-active)] disabled:opacity-50"
						>
							Jugar
						</button>
					{/if}

					{#if !result || (seen && !isLive)}
						<div>
							<p class="mb-1 text-xs text-[color:var(--color-text-muted)]">
								Com ho han fet els altres
							</p>
							<ol class="flex flex-col gap-0.5 text-sm">
								{#each othersFor(rival.key) as o (o.userId)}
									<li class="tnum flex justify-between gap-2">
										<span class="truncate">{names.get(o.userId) ?? '—'}</span>
										<span
											>{o.r.goalsFor}-{o.r.goalsAgainst}{o.r.medal
												? ` · ${MEDAL[o.r.medal].label}`
												: ''}</span
										>
									</li>
								{/each}
							</ol>
						</div>
					{/if}
				</article>
			{/each}
		</div>
	</section>
{/if}
