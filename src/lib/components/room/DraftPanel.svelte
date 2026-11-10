<script lang="ts">
	import PlayerAvatar from '$lib/components/PlayerAvatar.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import { formatCents } from '$lib/utils/currency';
	import { OpenTimerEngine } from '$lib/auction/engines/openTimer';
	import { sounds } from '$lib/utils/sounds';
	import { FORMATION_ROWS, teamByPosition, teamSpentCents } from './shared';
	import type { RoomData, RoomForm } from './shared';

	let { data, form }: { data: RoomData; form: RoomForm } = $props();

	const room = $derived(data.room);
	const members = $derived(data.members);
	const isHost = $derived(data.isHost);
	const isReadOnly = $derived(data.readOnly ?? false);
	const activeAuction = $derived(data.activeAuction);
	const activePlayer = $derived(data.activePlayer);
	const recentBids = $derived(data.recentBids);
	const lastClosedAuction = $derived(data.lastClosedAuction);
	const teamsByUser = $derived(data.teamsByUser);

	const settings = $derived(room.settings as Record<string, number>);
	const minOpening = $derived(settings.min_opening_bid_cents ?? 100_000_000);
	const minIncrement = $derived(settings.min_bid_increment_cents ?? 100_000_000);

	const myUserId = $derived(data.user?.id ?? null);
	const isCurrentBidder = $derived(activeAuction?.current_bidder_id === myUserId);

	// Countdown
	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (now = Date.now()), 250);
		return () => clearInterval(id);
	});

	const secondsLeft = $derived.by(() => {
		if (!activeAuction?.ends_at) return 0;
		return OpenTimerEngine.secondsRemaining(
			{
				id: activeAuction.id,
				roomId: room.id,
				status: activeAuction.status as
					| 'pending'
					| 'active'
					| 'closed'
					| 'auto_assigned'
					| 'skipped',
				currentBidCents: activeAuction.current_bid_cents,
				currentBidderId: activeAuction.current_bidder_id,
				endsAt: new Date(activeAuction.ends_at)
			},
			new Date(now)
		);
	});

	const minNextBid = $derived(
		activeAuction?.current_bid_cents != null
			? activeAuction.current_bid_cents + minIncrement
			: minOpening
	);

	let bidInput = $state('');
	let bidSubmitting = $state(false);
	let advancing = $state(false);

	function setBidPreset(amountCents: number) {
		bidInput = `${amountCents / 1_000_000_00}M`;
	}

	// Timer styling: red+pulse under 10s, normal otherwise.
	// Total length of the current timer, for the progress bar (a bid can extend it).
	const timerTotal = $derived(Math.max(1, Number(settings.timer_seconds ?? 60)));
	const timerLow = $derived(secondsLeft > 0 && secondsLeft <= 10);

	// Flash when current_bid_cents changes — track previous value.
	let lastBidCents = $state<number | null>(null);
	let lastBidderId = $state<string | null>(null);
	let bidJustChanged = $state(false);
	$effect(() => {
		const cur = activeAuction?.current_bid_cents ?? null;
		const curBidder = activeAuction?.current_bidder_id ?? null;
		if (cur !== lastBidCents) {
			// Skip the very first read (initial mount).
			if (lastBidCents !== null || cur !== null) {
				if (curBidder && curBidder !== myUserId && lastBidderId === myUserId) {
					sounds.outbid();
				} else if (curBidder && curBidder !== myUserId) {
					sounds.bid();
				}
			}
			lastBidCents = cur;
			lastBidderId = curBidder;
			bidJustChanged = true;
			const id = setTimeout(() => (bidJustChanged = false), 600);
			return () => clearTimeout(id);
		}
	});

	// Timer warning: fire once when secondsLeft passes through 5.
	let warnedFor = $state<string | null>(null);
	$effect(() => {
		if (!activeAuction) return;
		if (secondsLeft === 5 && warnedFor !== activeAuction.id) {
			warnedFor = activeAuction.id;
			sounds.warning();
		}
	});

	// Win sound when an auction closes in your favour.
	let lastSeenAuctionId = $state<string | null>(null);
	$effect(() => {
		if (activeAuction?.id && activeAuction.id !== lastSeenAuctionId) {
			// Auction changed → previous one was just closed. The realtime
			// payload includes winner if we re-fetch, but recentBids is for
			// the new auction. So we use the simpler heuristic: if the most
			// recent bid we saw was ours and the auction just changed, we
			// likely won.
			if (lastSeenAuctionId !== null && lastBidderId === myUserId) {
				sounds.win();
			} else if (lastSeenAuctionId !== null) {
				sounds.close();
			}
			lastSeenAuctionId = activeAuction.id;
		}
	});

	// "Adjudicat" celebration banner. Fires whenever last_closed_auction.id
	// changes (i.e. an auction just resolved). Auto-hides after 3 seconds.
	let adjudicatedShown = $state<typeof lastClosedAuction | null>(null);
	let lastSeenClosedId = $state<string | null>(null);
	$effect(() => {
		if (!lastClosedAuction) return;
		if (lastSeenClosedId === lastClosedAuction.id) return;
		// First load: don't celebrate retroactively.
		const isFirstSee = lastSeenClosedId === null;
		lastSeenClosedId = lastClosedAuction.id;
		if (isFirstSee) return;
		adjudicatedShown = lastClosedAuction;
		const t = setTimeout(() => {
			adjudicatedShown = null;
		}, 3000);
		return () => clearTimeout(t);
	});

	// Auto-advance: when the active auction's timer hits zero, any client
	// pings the advance endpoint. The server is idempotent on terminal
	// states and rate-limits expired auctions to one progression, so it's
	// safe for several clients to race each other on the same tick.
	let lastAutoAdvanceAt = 0;
	$effect(() => {
		if (!activeAuction) return;
		if (secondsLeft > 0) return;
		// Retry at most every 2s: a non-forced advance no-ops while the server
		// still considers the auction live (clock skew), so we must re-try until
		// it genuinely expires server-side, but without hammering the endpoint.
		if (now - lastAutoAdvanceAt < 2000) return;
		lastAutoAdvanceAt = now;
		fetch('?/advanceAuction', { method: 'POST', body: new FormData() })
			.then(() => invalidateAll())
			.catch(() => {});
	});
</script>

{#if activeAuction && activePlayer}
	<!-- Adjudicat banner -->
	{#if adjudicatedShown}
		<div
			in:fly={{ y: -8, duration: 200 }}
			out:fly={{ y: -8, duration: 200 }}
			class="fixed inset-x-0 top-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-[var(--radius)] border border-[color:var(--color-accent)] bg-[color:var(--color-elevated)] px-3 py-2 text-sm shadow-lg"
			style="margin-left: max(0.75rem, env(safe-area-inset-left)); margin-right: max(0.75rem, env(safe-area-inset-right));"
		>
			<PlayerAvatar
				name={adjudicatedShown.player_name}
				team={adjudicatedShown.player_team}
				photoUrl={adjudicatedShown.player_photo_url}
				size={40}
			/>
			<div class="flex min-w-0 flex-1 flex-col leading-tight">
				{#if adjudicatedShown.winner_id}
					<span class="text-xs text-[color:var(--color-accent)]">Adjudicat</span>
					<span class="truncate text-sm font-medium">
						{adjudicatedShown.player_name} → {adjudicatedShown.winner_name ?? 'auto'}
					</span>
					<span class="tnum text-xs text-[color:var(--color-text-muted)]">
						{adjudicatedShown.final_price_cents
							? formatCents(adjudicatedShown.final_price_cents)
							: 'auto'}
					</span>
				{:else}
					<span class="text-xs text-[color:var(--color-text-muted)]">Sense pujades</span>
					<span class="truncate text-sm">
						{adjudicatedShown.player_name}
					</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Active auction card -->
	<section
		class="rounded-[var(--radius-lg)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] p-5"
	>
		<div class="flex items-baseline justify-between gap-3">
			{#key activeAuction.id}
				<div in:fly={{ y: 8, duration: 250 }} class="flex items-center gap-3">
					<PlayerAvatar
						name={activePlayer.name}
						team={typeof activePlayer.metadata?.team === 'string'
							? activePlayer.metadata.team
							: null}
						photoUrl={activePlayer.photo_url}
						size={64}
					/>
					<div>
						<span
							class="inline-block rounded-[var(--radius-sm)] bg-[color:var(--color-accent-muted)] px-2 py-0.5 text-xs font-semibold text-[color:var(--color-on-accent)]"
						>
							{activePlayer.primary_position}
						</span>
						<h2 class="mt-1.5 text-xl leading-tight" style="font-family: var(--font-display);">
							{activePlayer.name}
						</h2>
						{#if activePlayer.metadata && typeof activePlayer.metadata.team === 'string'}
							<p class="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
								{activePlayer.metadata.team}
							</p>
						{/if}
					</div>
				</div>
			{/key}
			<div class="text-right">
				<p class="text-xs text-[color:var(--color-text-faint)]">temps</p>
				<p
					class="tnum text-3xl transition-colors"
					class:text-[color:var(--color-accent)]={timerLow}
					class:animate-pulse={timerLow}
					style="font-family: var(--font-mono);"
				>
					{secondsLeft}s
				</p>
			</div>
		</div>

		<div
			class="mt-4 h-1 overflow-hidden rounded-full bg-[color:var(--color-border)]"
			role="progressbar"
			aria-label="Temps restant"
			aria-valuenow={secondsLeft}
			aria-valuemin="0"
			aria-valuemax={timerTotal}
		>
			<div
				class="h-full rounded-full transition-[width] duration-1000 ease-linear"
				class:bg-[color:var(--color-accent)]={timerLow}
				class:bg-[color:var(--color-text-muted)]={!timerLow}
				style="width: {Math.min(100, (secondsLeft / timerTotal) * 100)}%"
			></div>
		</div>

		<div
			class="mt-4 flex items-baseline justify-between border-t border-[color:var(--color-border)] pt-4"
		>
			<div>
				<p class="text-xs text-[color:var(--color-text-faint)]">puja actual</p>
				{#if activeAuction.current_bid_cents}
					<p
						class="tnum mt-1 text-2xl transition-all duration-300"
						class:scale-110={bidJustChanged}
						class:text-[color:var(--color-accent)]={bidJustChanged}
					>
						{formatCents(activeAuction.current_bid_cents)}
					</p>
					<p class="text-xs text-[color:var(--color-text-muted)]">
						per {members.find((m) => m.user_id === activeAuction.current_bidder_id)?.profile
							?.display_name ?? '—'}
					</p>
				{:else}
					<p class="mt-1 text-base text-[color:var(--color-text-muted)]">sense pujades</p>
				{/if}
			</div>
		</div>
	</section>

	<!-- Bid form (members only) -->
	{#if !isReadOnly}
		<form
			method="POST"
			action="?/placeBid"
			class="flex flex-col gap-3"
			use:enhance={() => {
				bidSubmitting = true;
				return async ({ update }) => {
					await update();
					bidSubmitting = false;
					bidInput = '';
				};
			}}
		>
			<input type="hidden" name="auction_id" value={activeAuction.id} />
			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => setBidPreset(minNextBid)}
					class="flex-1 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-2 text-sm transition-colors hover:bg-[color:var(--color-elevated)]"
				>
					Mín ({formatCents(minNextBid)})
				</button>
				{#each [5_000_000_00, 10_000_000_00] as bump (bump)}
					<button
						type="button"
						onclick={() => setBidPreset(minNextBid + bump)}
						class="flex-1 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-2 text-sm transition-colors hover:bg-[color:var(--color-elevated)]"
					>
						+{formatCents(bump)}
					</button>
				{/each}
			</div>
			<div class="flex gap-2">
				<input
					name="amount"
					bind:value={bidInput}
					type="text"
					inputmode="decimal"
					placeholder={`mín ${formatCents(minNextBid)}`}
					class="min-w-0 flex-1 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-lg outline-none focus:border-[color:var(--color-accent)]"
					style="font-family: var(--font-mono);"
				/>
				<button
					type="submit"
					disabled={bidSubmitting || isCurrentBidder}
					class="rounded-[var(--radius)] bg-[color:var(--color-accent)] px-6 py-3 text-base font-medium text-[color:var(--color-on-accent)] transition-colors hover:bg-[color:var(--color-accent-hover)] disabled:opacity-50"
				>
					{bidSubmitting ? '…' : 'Pujar'}
				</button>
			</div>
			{#if form && 'bid' in form && form.bid && 'error' in form.bid}
				<p class="text-sm text-[color:var(--color-accent)]">{form.bid.error}</p>
			{/if}
		</form>
	{/if}

	<!-- My team so far (during drafting). Helps decide whether to bid. -->
	{#if !isReadOnly && myUserId}
		{@const myTeam = teamsByUser[myUserId] ?? []}
		{@const myByPos = teamByPosition(myTeam)}
		<details
			class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
		>
			<summary class="flex cursor-pointer items-baseline justify-between px-4 py-2 text-sm">
				<span class="font-medium">El meu equip</span>
				<span class="tnum text-xs text-[color:var(--color-text-muted)]">
					{myTeam.length} jug · {formatCents(teamSpentCents(teamsByUser, myUserId))}
				</span>
			</summary>
			{#if myTeam.length === 0}
				<p
					class="border-t border-[color:var(--color-border)] px-4 py-3 text-xs text-[color:var(--color-text-muted)]"
				>
					Encara no has guanyat cap subhasta.
				</p>
			{:else}
				<div class="border-t border-[color:var(--color-border)] px-4 py-3 text-sm">
					{#each FORMATION_ROWS as row (row.label)}
						{@const playersInRow = row.positions.flatMap((pos) => myByPos[pos] ?? [])}
						{#if playersInRow.length > 0}
							<div class="mb-2 last:mb-0">
								<p class="mb-1 text-xs text-[color:var(--color-text-faint)]">
									{row.label}
								</p>
								<ul class="flex flex-col gap-0.5">
									{#each playersInRow as p (p.auction_id)}
										<li class="flex justify-between gap-2">
											<span>
												<span
													class="inline-block min-w-[28px] rounded-[2px] bg-[color:var(--color-accent-muted)] px-1 py-0.5 text-center text-xs font-semibold text-[color:var(--color-on-accent)]"
													>{p.position_slot}</span
												>
												<span class="ml-2">{p.player_name}</span>
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
			{/if}
		</details>
	{/if}

	<!-- Recent bids -->
	{#if recentBids.length > 0}
		<section class="flex flex-col gap-1">
			<h3 class="text-xs text-[color:var(--color-text-faint)]">historial</h3>
			<ul class="flex flex-col gap-1">
				{#each recentBids as bid (bid.id)}
					<li
						in:fly={{ y: -6, duration: 200 }}
						class="flex justify-between rounded-[var(--radius-sm)] bg-[color:var(--color-surface)] px-3 py-1.5 text-sm"
					>
						<span>{bid.profile?.display_name ?? '—'}</span>
						<span class="tnum">{formatCents(bid.amount_cents)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Host controls -->
	{#if isHost && !isReadOnly}
		<div class="flex flex-col gap-2">
			<form
				method="POST"
				action="?/advanceAuction"
				use:enhance={() => {
					advancing = true;
					return async ({ update }) => {
						await update();
						advancing = false;
					};
				}}
			>
				<input type="hidden" name="force" value="true" />
				<button
					type="submit"
					disabled={advancing}
					class="w-full rounded-[var(--radius)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-4 py-3 text-sm transition-colors hover:bg-[color:var(--color-surface)] disabled:opacity-50"
				>
					{advancing ? 'Avançant…' : secondsLeft === 0 ? 'Tancar i següent' : 'Següent (forçar)'}
				</button>
				{#if form && 'advance' in form && form.advance && 'error' in form.advance}
					<p class="mt-2 text-sm text-[color:var(--color-accent)]">{form.advance.error}</p>
				{/if}
			</form>

			<form method="POST" action="?/updateSettings" class="flex items-center gap-2" use:enhance>
				<label
					class="flex flex-1 items-center justify-between gap-2 text-xs text-[color:var(--color-text-muted)]"
				>
					<span class="">Timer següent</span>
					<select
						name="timer"
						value={String(settings.timer_seconds ?? 60)}
						class="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
						onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
					>
						<option value="30">30s</option>
						<option value="60">60s</option>
						<option value="90">90s</option>
						<option value="120">120s</option>
					</select>
				</label>
				{#if form && 'settings' in form && form.settings && 'error' in form.settings}
					<span class="text-xs text-[color:var(--color-accent)]">{form.settings.error}</span>
				{/if}
			</form>
		</div>
	{/if}
{:else}
	<section
		class="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-center"
	>
		<p class="text-sm text-[color:var(--color-text-muted)]">Carregant subhasta…</p>
	</section>
{/if}
