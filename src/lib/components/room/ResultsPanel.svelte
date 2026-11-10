<script lang="ts">
	import { formatCents } from '$lib/utils/currency';
	import Pitch from '$lib/components/Pitch.svelte';
	import { FORMATION_ROWS, teamByPosition, teamSpentCents } from './shared';
	import type { RoomData } from './shared';
	import type { RoomSettings } from '$lib/auction/settings';

	let { data }: { data: RoomData } = $props();

	const room = $derived(data.room);
	const members = $derived(data.members);
	const teamsByUser = $derived(data.teamsByUser);
	const tally = $derived(data.tally);

	const podium = $derived.by(() => {
		// Build full ranking including members with 0 points
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const byUser = new Map<string, { points: number; received: number }>();
		for (const t of tally) {
			byUser.set(t.user_id, { points: t.total_points, received: t.votes_received });
		}
		return members
			.map((m) => ({
				user_id: m.user_id,
				display_name: m.profile?.display_name ?? '—',
				points: byUser.get(m.user_id)?.points ?? 0,
				received: byUser.get(m.user_id)?.received ?? 0
			}))
			.sort((a, b) => b.points - a.points || b.received - a.received);
	});

	async function shareResults() {
		const winner = podium[0];
		const text =
			`Resultats subhasta — ${room.theme.display_name}\n` +
			`Guanyador: ${winner?.display_name ?? '—'} (${winner?.points ?? 0} pts)\n\n` +
			members
				.map(
					(m) =>
						`${m.profile?.display_name ?? 'Convidat'} — ${formatCents(teamSpentCents(teamsByUser, m.user_id))}`
				)
				.join('\n');
		const url = typeof window !== 'undefined' ? window.location.href : '';
		const shareData = { title: 'subasta — resultats', text, url };
		try {
			if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.(shareData)) {
				await navigator.share(shareData);
				return;
			}
		} catch {
			// User cancelled or share failed — fall through to clipboard.
		}
		try {
			await navigator.clipboard.writeText(`${text}\n${url}`);
			alert('Resultats copiats al porta-retalls.');
		} catch {
			alert("No s'ha pogut compartir.");
		}
	}
</script>

<!-- finished -->
<section class="flex flex-col gap-4">
	<header class="text-center">
		<h2 class="text-3xl" style="font-family: var(--font-display);">Resultats</h2>
	</header>

	<ol class="flex flex-col gap-2">
		{#each podium as row, i (row.user_id)}
			<li
				class="flex items-baseline justify-between rounded-[var(--radius-lg)] border bg-[color:var(--color-surface)] px-4 py-3"
				class:border-[color:var(--color-accent)]={i === 0}
				class:border-[color:var(--color-border-strong)]={i !== 0}
			>
				<div class="flex items-baseline gap-3">
					<span
						class="tnum text-2xl text-[color:var(--color-text-muted)]"
						style="font-family: var(--font-display);">{i + 1}</span
					>
					<span class="text-lg">{row.display_name}</span>
				</div>
				<div class="text-right">
					<p class="tnum text-xl">
						{row.points} <span class="text-sm text-[color:var(--color-text-muted)]">pts</span>
					</p>
					<p class="text-xs text-[color:var(--color-text-faint)]">
						{row.received} vot{row.received === 1 ? '' : 's'}
					</p>
				</div>
			</li>
		{/each}
	</ol>

	<!-- Pitch view per team -->
	<div class="flex flex-col gap-4">
		{#each members as member (member.user_id)}
			{@const team = teamsByUser[member.user_id] ?? []}
			<Pitch
				{team}
				formation={room.settings.formation as RoomSettings['formation'] | undefined}
				displayName={member.profile?.display_name ?? 'Convidat'}
				spent={formatCents(teamSpentCents(teamsByUser, member.user_id))}
			/>
		{/each}
	</div>

	<!-- Share + textual breakdown -->
	<div class="flex flex-col gap-2">
		<button
			type="button"
			onclick={shareResults}
			class="rounded-[var(--radius)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-4 py-2 text-sm transition-colors hover:bg-[color:var(--color-surface)]"
		>
			Comparteix la sala
		</button>
		<details
			class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
		>
			<summary class="cursor-pointer px-4 py-3 text-sm"> Veure tots els equips en text </summary>
			<div class="flex flex-col gap-4 border-t border-[color:var(--color-border)] px-4 py-3">
				{#each members as member (member.user_id)}
					{@const team = teamsByUser[member.user_id] ?? []}
					{@const byPos = teamByPosition(team)}
					<div>
						<p class="font-medium">
							{member.profile?.display_name ?? 'Convidat'}
							<span class="text-xs text-[color:var(--color-text-faint)]"
								>— {formatCents(teamSpentCents(teamsByUser, member.user_id))}</span
							>
						</p>
						<div class="mt-1 text-sm">
							{#each FORMATION_ROWS as row (row.label)}
								{@const playersInRow = row.positions.flatMap((pos) => byPos[pos] ?? [])}
								{#if playersInRow.length > 0}
									<div class="mb-1.5 last:mb-0">
										<p
											class="text-[10px] tracking-widest text-[color:var(--color-text-faint)] uppercase"
										>
											{row.label}
										</p>
										<ul class="flex flex-col gap-0.5">
											{#each playersInRow as p (p.auction_id)}
												{@const isAuto = p.auction_status === 'auto_assigned'}
												<li class="flex justify-between gap-2">
													<span>
														<span
															class="inline-block min-w-[28px] rounded-[2px] bg-[color:var(--color-accent-muted)] px-1 py-0.5 text-center text-[10px] font-semibold tracking-wider text-[color:var(--color-on-accent)] uppercase"
															>{p.position_slot}</span
														>
														<span
															class="ml-2"
															class:text-[color:var(--color-text-faint)]={isAuto}
															class:italic={isAuto}
														>
															{p.player_name}{isAuto ? ' (auto)' : ''}
														</span>
													</span>
													<span class="tnum text-xs text-[color:var(--color-text-muted)]">
														{p.final_price_cents ? formatCents(p.final_price_cents) : 'auto'}
													</span>
												</li>
											{/each}
										</ul>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</details>
	</div>
</section>
