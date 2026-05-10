<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { createClient } from '$lib/supabase/client';
	import { formatCents } from '$lib/utils/currency';
	import { OpenTimerEngine } from '$lib/auction/engines/openTimer';
	import { enableAudio, isMuted, setMuted, sounds } from '$lib/utils/sounds';
	import { fly } from 'svelte/transition';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const room = $derived(data.room);
	const members = $derived(data.members);
	const isHost = $derived(data.isHost);
	const isReadOnly = $derived(data.readOnly ?? false);
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
				status: activeAuction.status as 'pending' | 'active' | 'closed' | 'auto_assigned' | 'skipped',
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
	let voteSubmitting = $state(false);
	let finishingVoting = $state(false);

	// Voting state
	const teamsByUser = $derived(data.teamsByUser);
	const myVote = $derived(data.myVote);
	const tally = $derived(data.tally);

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

	const podium = $derived.by(() => {
		// Build full ranking including members with 0 points
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

	function teamSpentCents(userId: string): number {
		return (teamsByUser[userId] ?? []).reduce((sum, p) => sum + (p.final_price_cents ?? 0), 0);
	}

	function memberName(userId: string | null | undefined): string {
		if (!userId) return '—';
		return members.find((m) => m.user_id === userId)?.profile?.display_name ?? '—';
	}

	function initials(fullName: string): string {
		const parts = fullName.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return '?';
		if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	}

	function setBidPreset(amountCents: number) {
		bidInput = `${amountCents / 1_000_000_00}M`;
	}

	// Pending auctions for the "next up" preview (sequence_number > active).
	const upcomingAuctions = $derived(data.upcomingAuctions ?? []);

	// Timer styling: red+pulse under 10s, normal otherwise.
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

	// Voting phase fanfare: fires when room transitions away from drafting.
	let lastRoomStatus = $state<string | null>(null);
	$effect(() => {
		if (lastRoomStatus !== null && room.status !== lastRoomStatus && room.status === 'voting') {
			sounds.voting();
		}
		lastRoomStatus = room.status;
	});

	// Mute toggle (persisted) + audio unlock on first user gesture.
	let isMutedState = $state(false);
	onMount(() => {
		isMutedState = isMuted();
		const unlock = () => {
			enableAudio();
			document.removeEventListener('click', unlock);
		};
		document.addEventListener('click', unlock, { once: true });

		// Track recent rooms in localStorage so the lobby can list them.
		try {
			const key = 'subasta:recent_rooms';
			const raw = localStorage.getItem(key);
			const list = raw ? (JSON.parse(raw) as Array<{ code: string; visited_at: number; status?: string }>) : [];
			const filtered = list.filter((r) => r.code !== room.code);
			filtered.unshift({ code: room.code, visited_at: Date.now(), status: room.status });
			localStorage.setItem(key, JSON.stringify(filtered.slice(0, 8)));
		} catch {}

		return () => document.removeEventListener('click', unlock);
	});
	function toggleMute() {
		isMutedState = !isMutedState;
		setMuted(isMutedState);
	}

	// Auto-advance: when the active auction's timer hits zero, any client
	// pings the advance endpoint. The server is idempotent on terminal
	// states and rate-limits expired auctions to one progression, so it's
	// safe for several clients to race each other on the same tick.
	let lastAutoAdvanceAuctionId = $state<string | null>(null);
	$effect(() => {
		if (!activeAuction) return;
		if (secondsLeft > 0) return;
		if (lastAutoAdvanceAuctionId === activeAuction.id) return;

		lastAutoAdvanceAuctionId = activeAuction.id;
		fetch('?/advanceAuction', { method: 'POST', body: new FormData() })
			.then(() => invalidateAll())
			.catch(() => {});
	});

	// Presence: track which member ids are currently connected to this room.
	let onlineUserIds = $state<Set<string>>(new Set());

	// Realtime for members; polling for spectators (RLS hides events from
	// non-members so postgres_changes wouldn't reach them).
	onMount(() => {
		if (isReadOnly) {
			if (room.status === 'finished') return; // no need to refresh once done
			const id = setInterval(() => invalidateAll(), 3000);
			return () => clearInterval(id);
		}

		const supabase = createClient();

		const dbChannel = supabase
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

		const presenceChannel = supabase
			.channel(`room:${room.id}:presence`, {
				config: { presence: { key: myUserId ?? 'anon' } }
			})
			.on('presence', { event: 'sync' }, () => {
				const state = presenceChannel.presenceState();
				onlineUserIds = new Set(Object.keys(state));
			})
			.subscribe(async (status) => {
				if (status === 'SUBSCRIBED' && myUserId) {
					await presenceChannel.track({ user_id: myUserId, online_at: Date.now() });
				}
			});

		return () => {
			supabase.removeChannel(dbChannel);
			supabase.removeChannel(presenceChannel);
		};
	});

	function copyCode() {
		navigator.clipboard.writeText(room.code).catch(() => {});
	}
</script>

<main
	class="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-6"
	style="padding-bottom: max(1.5rem, env(safe-area-inset-bottom)); padding-top: max(1.5rem, env(safe-area-inset-top));"
>
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
		<div class="flex items-center gap-2">
			{#if isReadOnly}
				<span class="rounded-full border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
					Espectador
				</span>
			{/if}
			{#if room.theme}
				<span class="text-right text-xs text-[color:var(--color-text-muted)]">{room.theme.display_name}</span>
			{/if}
			<button
				type="button"
				onclick={toggleMute}
				class="min-h-[36px] rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-xs uppercase tracking-wider transition-colors hover:bg-[color:var(--color-elevated)]"
				class:text-[color:var(--color-text-muted)]={isMutedState}
				class:text-[color:var(--color-text)]={!isMutedState}
				class:line-through={isMutedState}
				title={isMutedState ? 'Activar sons' : 'Silenciar sons'}
				aria-label={isMutedState ? 'Activar sons' : 'Silenciar sons'}
			>
				Sons
			</button>
		</div>
	</header>

	<!-- Members + budgets -->
	<section class="flex flex-col gap-2">
		{#each members as member}
			<div
				class="flex items-center justify-between rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
			>
				<div class="flex items-center gap-2">
					<span
						class="inline-block h-2 w-2 rounded-full transition-colors"
						class:bg-[color:var(--color-success)]={onlineUserIds.has(member.user_id)}
						class:bg-[color:var(--color-text-faint)]={!onlineUserIds.has(member.user_id)}
						title={onlineUserIds.has(member.user_id) ? 'Connectat' : 'Desconnectat'}
					></span>
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
				<p class="mt-3 text-sm text-[color:var(--color-text-muted)]">
					Esperant que l'amfitrió inicie…
				</p>
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
	{:else if room.status === 'drafting' && activeAuction && activePlayer}
		<!-- Active auction card -->
		<section class="rounded-[var(--radius-lg)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] p-5">
			<div class="flex items-baseline justify-between gap-3">
				{#key activeAuction.id}
					<div in:fly={{ y: 8, duration: 250 }} class="flex items-center gap-3">
						<div
							class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)] text-xl font-medium tracking-wide"
							style="font-family: var(--font-display);"
							aria-hidden="true"
						>
							{initials(activePlayer.name)}
						</div>
						<div>
							<p class="text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">
								{activePlayer.primary_position} · #{activeAuction.sequence_number}
							</p>
							<h2 class="mt-1 text-xl leading-tight" style="font-family: var(--font-display);">{activePlayer.name}</h2>
						</div>
					</div>
				{/key}
				<div class="text-right">
					<p class="text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">temps</p>
					<p
						class="text-3xl tnum transition-colors"
						class:text-[color:var(--color-accent)]={timerLow}
						class:animate-pulse={timerLow}
						style="font-family: var(--font-mono);"
					>
						{secondsLeft}s
					</p>
				</div>
			</div>

			<div class="mt-4 flex items-baseline justify-between border-t border-[color:var(--color-border)] pt-4">
				<div>
					<p class="text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">puja actual</p>
					{#if activeAuction.current_bid_cents}
						<p
							class="mt-1 text-2xl tnum transition-all duration-300"
							class:scale-110={bidJustChanged}
							class:text-[color:var(--color-accent)]={bidJustChanged}
						>
							{formatCents(activeAuction.current_bid_cents)}
						</p>
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
				{#each [5_000_000_00, 10_000_000_00] as bump}
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
		{/if}

		<!-- Recent bids -->
		{#if recentBids.length > 0}
			<section class="flex flex-col gap-1">
				<h3 class="text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">historial</h3>
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

		<!-- Next up -->
		{#if upcomingAuctions.length > 0}
			<section class="flex flex-col gap-1">
				<h3 class="text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">següents</h3>
				<ul class="flex flex-col gap-1">
					{#each upcomingAuctions as up}
						<li class="flex justify-between rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-3 py-1.5 text-sm text-[color:var(--color-text-muted)]">
							<span>
								<span class="text-xs uppercase tracking-wider text-[color:var(--color-text-faint)]">{up.position_slot}</span>
								<span class="ml-2">{up.player_name}</span>
							</span>
							<span class="tnum text-xs">#{up.sequence_number}</span>
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

				<form
					method="POST"
					action="?/updateTimer"
					class="flex items-center gap-2"
					use:enhance
				>
					<label class="flex flex-1 items-center justify-between gap-2 text-xs text-[color:var(--color-text-muted)]">
						<span class="uppercase tracking-wider">Timer següent</span>
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
	{:else if room.status === 'drafting'}
		<section class="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-center">
			<p class="text-sm text-[color:var(--color-text-muted)]">Carregant subhasta…</p>
		</section>
	{:else if room.status === 'voting'}
		<section class="flex flex-col gap-3">
			<header class="text-center">
				<h2 class="text-2xl" style="font-family: var(--font-display);">Vota</h2>
				<p class="mt-1 text-sm text-[color:var(--color-text-muted)]">
					Tria els 3 millors equips. 3-2-1 punts. No pots votar-te.
				</p>
			</header>

			<!-- Other members' teams -->
			<div class="flex flex-col gap-3">
				{#each otherMembers as member}
					{@const team = teamsByUser[member.user_id] ?? []}
					<details class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
						<summary class="flex cursor-pointer items-center justify-between px-4 py-3 text-sm">
							<span class="font-medium">{member.profile?.display_name ?? 'Convidat'}</span>
							<span class="tnum text-[color:var(--color-text-muted)]">
								{team.length} jug. · {formatCents(teamSpentCents(member.user_id))}
							</span>
						</summary>
						<ul class="flex flex-col gap-1 border-t border-[color:var(--color-border)] px-4 py-3 text-sm">
							{#each team as p}
								<li class="flex items-baseline justify-between gap-3">
									<span>
										<span class="text-xs uppercase tracking-wider text-[color:var(--color-text-faint)]">{p.position_slot}</span>
										<span class="ml-2">{p.player_name}</span>
									</span>
									<span class="tnum text-xs text-[color:var(--color-text-muted)]">
										{p.final_price_cents ? formatCents(p.final_price_cents) : 'auto'}
									</span>
								</li>
							{/each}
						</ul>
					</details>
				{/each}
			</div>

			<!-- Vote form (members only) -->
			{#if isReadOnly}
				<p class="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-center text-sm text-[color:var(--color-text-muted)]">
					Espectador — esperant que els jugadors votin.
				</p>
			{:else if myVote && !editingVote}
				<div class="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
					<p class="text-sm text-[color:var(--color-text-muted)]">El teu vot:</p>
					<ol class="mt-2 flex flex-col gap-1 text-sm">
						<li><span class="tnum">1.</span> {memberName(myVote.rank_1_user_id)} <span class="text-[color:var(--color-text-faint)]">(3 pts)</span></li>
						{#if myVote.rank_2_user_id}<li><span class="tnum">2.</span> {memberName(myVote.rank_2_user_id)} <span class="text-[color:var(--color-text-faint)]">(2 pts)</span></li>{/if}
						{#if myVote.rank_3_user_id}<li><span class="tnum">3.</span> {memberName(myVote.rank_3_user_id)} <span class="text-[color:var(--color-text-faint)]">(1 pt)</span></li>{/if}
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
						<span class="text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">Top 1 — 3 pts (obligatori)</span>
						<select
							name="rank_1"
							required
							bind:value={rank1}
							class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
						>
							<option value="">— tria —</option>
							{#each rankOptions(rank1) as m}
								<option value={m.user_id}>{m.profile?.display_name ?? 'Convidat'}</option>
							{/each}
						</select>
					</label>

					<label class="flex flex-col gap-1">
						<span class="text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">Top 2 — 2 pts</span>
						<select
							name="rank_2"
							bind:value={rank2}
							class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
						>
							<option value="">— cap —</option>
							{#each rankOptions(rank2) as m}
								<option value={m.user_id}>{m.profile?.display_name ?? 'Convidat'}</option>
							{/each}
						</select>
					</label>

					<label class="flex flex-col gap-1">
						<span class="text-xs uppercase tracking-widest text-[color:var(--color-text-faint)]">Top 3 — 1 pt</span>
						<select
							name="rank_3"
							bind:value={rank3}
							disabled={!rank2}
							class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm disabled:opacity-50"
						>
							<option value="">— cap —</option>
							{#each rankOptions(rank3) as m}
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
	{:else}
		<!-- finished -->
		<section class="flex flex-col gap-4">
			<header class="text-center">
				<h2 class="text-3xl" style="font-family: var(--font-display);">Resultats</h2>
			</header>

			<ol class="flex flex-col gap-2">
				{#each podium as row, i}
					<li
						class="flex items-baseline justify-between rounded-[var(--radius-lg)] border bg-[color:var(--color-surface)] px-4 py-3"
						class:border-[color:var(--color-accent)]={i === 0}
						class:border-[color:var(--color-border-strong)]={i !== 0}
					>
						<div class="flex items-baseline gap-3">
							<span class="text-2xl tnum text-[color:var(--color-text-muted)]" style="font-family: var(--font-display);">{i + 1}</span>
							<span class="text-lg">{row.display_name}</span>
						</div>
						<div class="text-right">
							<p class="text-xl tnum">{row.points} <span class="text-sm text-[color:var(--color-text-muted)]">pts</span></p>
							<p class="text-xs text-[color:var(--color-text-faint)]">{row.received} vot{row.received === 1 ? '' : 's'}</p>
						</div>
					</li>
				{/each}
			</ol>

			<!-- Teams revealed -->
			<details class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
				<summary class="cursor-pointer px-4 py-3 text-sm">Veure tots els equips</summary>
				<div class="flex flex-col gap-4 border-t border-[color:var(--color-border)] px-4 py-3">
					{#each members as member}
						{@const team = teamsByUser[member.user_id] ?? []}
						<div>
							<p class="font-medium">{member.profile?.display_name ?? 'Convidat'} <span class="text-xs text-[color:var(--color-text-faint)]">— {formatCents(teamSpentCents(member.user_id))}</span></p>
							<ul class="mt-1 flex flex-col gap-0.5 text-sm">
								{#each team as p}
									<li class="flex justify-between gap-2">
										<span>
											<span class="text-xs uppercase tracking-wider text-[color:var(--color-text-faint)]">{p.position_slot}</span>
											<span class="ml-2">{p.player_name}</span>
										</span>
										<span class="tnum text-xs text-[color:var(--color-text-muted)]">
											{p.final_price_cents ? formatCents(p.final_price_cents) : 'auto'}
										</span>
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
			</details>
		</section>
	{/if}

	<a href="/" class="text-center text-sm text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]">
		← Tornar al lobby
	</a>
</main>
