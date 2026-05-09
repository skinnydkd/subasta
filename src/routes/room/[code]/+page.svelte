<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { createClient } from '$lib/supabase/client';
	import { formatCents } from '$lib/utils/currency';
	import { OpenTimerEngine } from '$lib/auction/engines/openTimer';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const room = $derived(data.room);
	const members = $derived(data.members);
	const isHost = $derived(data.isHost);
	const activeAuction = $derived(data.activeAuction);
	const activePlayer = $derived(data.activePlayer);
	const recentBids = $derived(data.recentBids);

	const settings = $derived(room.settings as Record<string, number>);
	const minOpening = $derived(settings.min_opening_bid_cents ?? 100_000_000);
	const minIncrement = $derived(settings.min_bid_increment_cents ?? 100_000_000);

	const myUserId = $derived(data.user?.id ?? null);
	const myMember = $derived(members.find((m) => m.user_id === myUserId));
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
				status: activeAuction.status,
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
	let starting = $state(false);

	function setBidPreset(amountCents: number) {
		bidInput = `${amountCents / 1_000_000_00}M`;
	}

	// Realtime: re-fetch the load function on any change to auctions/bids/members/rooms.
	onMount(() => {
		const supabase = createClient();
		const channel = supabase
			.channel(`room:${room.id}`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'auctions', filter: `room_id=eq.${room.id}` },
				() => invalidateAll()
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${room.id}` },
				() => invalidateAll()
			)
			.on(
				'postgres_changes',
				{ event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
				() => invalidateAll()
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	});

	function copyCode() {
		navigator.clipboard.writeText(room.code).catch(() => {});
	}
</script>

<main class="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-6">
	<header class="flex items-center justify-between gap-3">
		<button
			type="button"
			onclick={copyCode}
			class="rounded-[var(--radius)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-4 py-2 text-xl tnum tracking-[0.3em] transition-colors hover:bg-[color:var(--color-surface)]"
			style="font-family: var(--font-mono);"
			title="Toca per copiar"
		>
			{room.code}
		</button>
		{#if room.theme}
			<span class="text-right text-xs text-[color:var(--color-text-muted)]">{room.theme.display_name}</span>
		{/if}
	</header>

	<!-- Members + budgets -->
	<section class="flex flex-col gap-2">
		{#each members as member}
			<div
				class="flex items-center justify-between rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
			>
				<div class="flex items-center gap-2">
					<span>{member.profile?.display_name ?? 'Convidat'}</span>
					{#if member.user_id === room.host_id}
						<span class="rounded-full bg-[color:var(--color-accent-muted)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--color-on-accent)]">host</span>
					{/if}
				</div>
				<span class="tnum text-[color:var(--color-text-muted)]">{formatCents(member.budget_remaining_cents)}</span>
			</div>
		{/each}
	</section>

	{#if room.status === 'lobby'}
		<section class="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-center">
			<p class="text-sm text-[color:var(--color-text-muted)]">
				{members.length} jugador{members.length === 1 ? '' : 's'} a la sala. Mínim 2 per a començar.
			</p>
			{#if isHost}
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
			{:else}
				<p class="mt-3 text-sm text-[color:var(--color-text-muted)]">
					Esperant que l'amfitrió inicie…
				</p>
			{/if}
		</section>
	{:else if room.status === 'drafting' && activeAuction && activePlayer}
		<!-- Active auction card -->
		<section class="rounded-[var(--radius-lg)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] p-5">
			<div class="flex items-baseline justify-between gap-2">
				<div>
					<p class="text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">
						{activePlayer.primary_position} · #{activeAuction.sequence_number}
					</p>
					<h2 class="mt-1 text-2xl" style="font-family: var(--font-display);">{activePlayer.name}</h2>
				</div>
				<div class="text-right">
					<p class="text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">temps</p>
					<p class="text-3xl tnum" style="font-family: var(--font-mono);">{secondsLeft}s</p>
				</div>
			</div>

			<div class="mt-4 flex items-baseline justify-between border-t border-[color:var(--color-border)] pt-4">
				<div>
					<p class="text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">puja actual</p>
					{#if activeAuction.current_bid_cents}
						<p class="mt-1 text-2xl tnum">{formatCents(activeAuction.current_bid_cents)}</p>
						<p class="text-xs text-[color:var(--color-text-muted)]">
							per {members.find((m) => m.user_id === activeAuction.current_bidder_id)?.profile?.display_name ?? '—'}
						</p>
					{:else}
						<p class="mt-1 text-base text-[color:var(--color-text-muted)]">sense pujades</p>
					{/if}
				</div>
				{#if activePlayer.market_value_cents}
					<div class="text-right">
						<p class="text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">valor</p>
						<p class="mt-1 text-sm tnum text-[color:var(--color-text-muted)]">
							{formatCents(activePlayer.market_value_cents)}
						</p>
					</div>
				{/if}
			</div>
		</section>

		<!-- Bid form -->
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
				{#each [1_000_000_00, 5_000_000_00, 10_000_000_00] as preset}
					<button
						type="button"
						onclick={() => setBidPreset(Math.max(preset, minNextBid))}
						class="flex-1 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-2 text-sm transition-colors hover:bg-[color:var(--color-elevated)]"
					>
						+{formatCents(preset)}
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
					class="flex-1 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-lg outline-none focus:border-[color:var(--color-accent)]"
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

		<!-- Recent bids -->
		{#if recentBids.length > 0}
			<section class="flex flex-col gap-1">
				<h3 class="text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">historial</h3>
				<ul class="flex flex-col gap-1">
					{#each recentBids as bid}
						<li class="flex justify-between rounded-[var(--radius-sm)] bg-[color:var(--color-surface)] px-3 py-1.5 text-sm">
							<span>{bid.profile?.display_name ?? '—'}</span>
							<span class="tnum">{formatCents(bid.amount_cents)}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Host controls -->
		{#if isHost}
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
		{/if}
	{:else if room.status === 'drafting'}
		<section class="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-center">
			<p class="text-sm text-[color:var(--color-text-muted)]">Carregant subhasta…</p>
		</section>
	{:else if room.status === 'voting'}
		<section class="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-center">
			<p>Fase de votació (aviat).</p>
		</section>
	{:else}
		<section class="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-center">
			<p>Partida finalitzada.</p>
		</section>
	{/if}

	<a href="/" class="text-center text-sm text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]">
		← Tornar al lobby
	</a>
</main>
