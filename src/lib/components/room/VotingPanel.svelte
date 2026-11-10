<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatCents } from '$lib/utils/currency';
	import { FORMATION_ROWS, teamByPosition, teamSpentCents } from './shared';
	import type { RoomData, RoomForm } from './shared';

	let { data, form }: { data: RoomData; form: RoomForm } = $props();

	const members = $derived(data.members);
	const isHost = $derived(data.isHost);
	const isReadOnly = $derived(data.readOnly ?? false);
	const myUserId = $derived(data.user?.id ?? null);
	const teamsByUser = $derived(data.teamsByUser);
	const myVote = $derived(data.myVote);

	let voteSubmitting = $state(false);
	let finishingVoting = $state(false);

	const otherMembers = $derived(members.filter((m) => m.user_id !== myUserId));
	let editingVote = $state(false);
	let rank1 = $state('');
	let rank2 = $state('');
	let rank3 = $state('');

	// Initialize rank dropdowns from existing vote if present and not editing
	$effect(() => {
		if (myVote && !editingVote) {
			rank1 = myVote.rank_1_user_id;
			rank2 = myVote.rank_2_user_id ?? '';
			rank3 = myVote.rank_3_user_id ?? '';
		}
	});

	const rankedSet = $derived(new Set([rank1, rank2, rank3].filter(Boolean)));

	function rankOptions(currentValue: string) {
		// Members not yet selected, plus the currently-selected one (so it stays visible)
		return otherMembers.filter((m) => m.user_id === currentValue || !rankedSet.has(m.user_id));
	}

	function memberName(userId: string | null | undefined): string {
		if (!userId) return '—';
		return members.find((m) => m.user_id === userId)?.profile?.display_name ?? '—';
	}
</script>

<section class="flex flex-col gap-3">
	<header class="text-center">
		<h2 class="text-2xl" style="font-family: var(--font-display);">Vota</h2>
		<p class="mt-1 text-sm text-[color:var(--color-text-muted)]">
			Tria els 3 millors equips. 3-2-1 punts. No pots votar-te.
		</p>
	</header>

	<!-- Other members' teams, grouped as a formation -->
	<div class="flex flex-col gap-3">
		{#each otherMembers as member (member.user_id)}
			{@const team = teamsByUser[member.user_id] ?? []}
			{@const byPos = teamByPosition(team)}
			<details
				class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
			>
				<summary class="flex cursor-pointer items-center justify-between px-4 py-3 text-sm">
					<span class="font-medium">{member.profile?.display_name ?? 'Convidat'}</span>
					<span class="tnum text-[color:var(--color-text-muted)]">
						{team.length} jug. · {formatCents(teamSpentCents(teamsByUser, member.user_id))}
					</span>
				</summary>
				<div class="border-t border-[color:var(--color-border)] px-4 py-3 text-sm">
					{#each FORMATION_ROWS as row (row.label)}
						{@const playersInRow = row.positions.flatMap((pos) => byPos[pos] ?? [])}
						{#if playersInRow.length > 0}
							<div class="mb-2 last:mb-0">
								<p class="mb-1 text-xs text-[color:var(--color-text-faint)]">
									{row.label}
								</p>
								<ul class="flex flex-col gap-0.5">
									{#each playersInRow as p (p.auction_id)}
										{@const isAuto = p.auction_status === 'auto_assigned'}
										<li class="flex items-baseline justify-between gap-2">
											<span>
												<span
													class="inline-block min-w-[28px] rounded-[2px] bg-[color:var(--color-accent-muted)] px-1 py-0.5 text-center text-xs font-semibold text-[color:var(--color-on-accent)]"
													>{p.position_slot}</span
												>
												<span
													class="ml-2"
													class:text-[color:var(--color-text-faint)]={isAuto}
													class:italic={isAuto}
												>
													{isAuto ? '(auto-assignat)' : p.player_name}
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
			</details>
		{/each}
	</div>

	<!-- Vote form (members only) -->
	{#if isReadOnly}
		<p
			class="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-center text-sm text-[color:var(--color-text-muted)]"
		>
			Espectador — esperant que els jugadors votin.
		</p>
	{:else if myVote && !editingVote}
		<div
			class="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
		>
			<p class="text-sm text-[color:var(--color-text-muted)]">El teu vot:</p>
			<ol class="mt-2 flex flex-col gap-1 text-sm">
				<li>
					<span class="tnum">1.</span>
					{memberName(myVote.rank_1_user_id)}
					<span class="text-[color:var(--color-text-faint)]">(3 pts)</span>
				</li>
				{#if myVote.rank_2_user_id}<li>
						<span class="tnum">2.</span>
						{memberName(myVote.rank_2_user_id)}
						<span class="text-[color:var(--color-text-faint)]">(2 pts)</span>
					</li>{/if}
				{#if myVote.rank_3_user_id}<li>
						<span class="tnum">3.</span>
						{memberName(myVote.rank_3_user_id)}
						<span class="text-[color:var(--color-text-faint)]">(1 pt)</span>
					</li>{/if}
			</ol>
			<button
				type="button"
				onclick={() => (editingVote = true)}
				class="mt-3 text-sm text-[color:var(--color-accent)] hover:underline"
			>
				Editar vot
			</button>
			<p class="mt-2 text-xs text-[color:var(--color-text-faint)]">
				Esperant que voten els altres. Quan tothom haja votat, els resultats apareixeran.
			</p>
		</div>
	{:else}
		<form
			method="POST"
			action="?/castVote"
			class="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] p-4"
			use:enhance={() => {
				voteSubmitting = true;
				return async ({ update }) => {
					await update();
					voteSubmitting = false;
					editingVote = false;
				};
			}}
		>
			<label class="flex flex-col gap-1">
				<span class="text-xs text-[color:var(--color-text-faint)]">Top 1 — 3 pts (obligatori)</span>
				<select
					name="rank_1"
					required
					bind:value={rank1}
					class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
				>
					<option value="">— tria —</option>
					{#each rankOptions(rank1) as m (m.user_id)}
						<option value={m.user_id}>{m.profile?.display_name ?? 'Convidat'}</option>
					{/each}
				</select>
			</label>

			<label class="flex flex-col gap-1">
				<span class="text-xs text-[color:var(--color-text-faint)]">Top 2 — 2 pts</span>
				<select
					name="rank_2"
					bind:value={rank2}
					class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
				>
					<option value="">— cap —</option>
					{#each rankOptions(rank2) as m (m.user_id)}
						<option value={m.user_id}>{m.profile?.display_name ?? 'Convidat'}</option>
					{/each}
				</select>
			</label>

			<label class="flex flex-col gap-1">
				<span class="text-xs text-[color:var(--color-text-faint)]">Top 3 — 1 pt</span>
				<select
					name="rank_3"
					bind:value={rank3}
					disabled={!rank2}
					class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm disabled:opacity-50"
				>
					<option value="">— cap —</option>
					{#each rankOptions(rank3) as m (m.user_id)}
						<option value={m.user_id}>{m.profile?.display_name ?? 'Convidat'}</option>
					{/each}
				</select>
			</label>

			{#if form && 'vote' in form && form.vote && 'error' in form.vote}
				<p class="text-sm text-[color:var(--color-accent)]">{form.vote.error}</p>
			{/if}

			<button
				type="submit"
				disabled={voteSubmitting || !rank1}
				class="rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-3 text-base font-medium text-[color:var(--color-on-accent)] transition-colors hover:bg-[color:var(--color-accent-hover)] disabled:opacity-50"
			>
				{voteSubmitting ? 'Enviant…' : myVote ? 'Actualitzar vot' : 'Enviar vot'}
			</button>
		</form>
	{/if}

	{#if isHost && !isReadOnly}
		<form
			method="POST"
			action="?/finishVoting"
			use:enhance={() => {
				finishingVoting = true;
				return async ({ update }) => {
					await update();
					finishingVoting = false;
				};
			}}
		>
			<button
				type="submit"
				disabled={finishingVoting}
				class="w-full rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-xs text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-elevated)] disabled:opacity-50"
			>
				{finishingVoting ? 'Tancant…' : 'Forçar tancament de votació (host)'}
			</button>
		</form>
	{/if}
</section>
