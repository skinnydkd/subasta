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
	import { createRealtimeKeepalive } from '$lib/realtime/keepalive.svelte';
	import ConnectionPill from '$lib/components/ConnectionPill.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const room = $derived(data.room);
	const members = $derived(data.members);
	const isHost = $derived(data.isHost);
	const isReadOnly = $derived(data.readOnly ?? false);
	const activeAuction = $derived(data.activeAuction);
	const activePlayer = $derived(data.activePlayer);
	const recentBids = $derived(data.recentBids);
	const lastClosedAuction = $derived(data.lastClosedAuction);

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

	function teamSpentCents(userId: string): number {
		return (teamsByUser[userId] ?? []).reduce((sum, p) => sum + (p.final_price_cents ?? 0), 0);
	}

	// Formation rendering order: top → bottom of pitch.
	const FORMATION_ROWS: { label: string; positions: string[] }[] = [
		{ label: 'Davanters', positions: ['LW', 'ST', 'RW'] },
		{ label: 'Migcampistes', positions: ['CM'] },
		{ label: 'Defenses', positions: ['LB', 'CB', 'RB'] },
		{ label: 'Porter', positions: ['GK'] }
	];

	type TeamPlayer = {
		auction_id: string;
		position_slot: string;
		final_price_cents: number | null;
		auction_status: string;
		player_id: string;
		player_name: string;
		player_position: string;
	};

	function teamByPosition(team: TeamPlayer[]): Record<string, TeamPlayer[]> {
		const out: Record<string, TeamPlayer[]> = {};
		for (const p of team) (out[p.position_slot] ||= []).push(p);
		return out;
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
			const list = raw
				? (JSON.parse(raw) as Array<{ code: string; visited_at: number; status?: string }>)
				: [];
			const filtered = list.filter((r) => r.code !== room.code);
			filtered.unshift({ code: room.code, visited_at: Date.now(), status: room.status });
			localStorage.setItem(key, JSON.stringify(filtered.slice(0, 8)));
		} catch {
			// storage unavailable — ignore
		}

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
	// Keepalive handles visibility / online / offline reconnect + wake lock.
	let keepalive = $state<ReturnType<typeof createRealtimeKeepalive> | null>(null);

	onMount(() => {
		if (isReadOnly) {
			if (room.status === 'finished') return;
			const id = setInterval(() => invalidateAll(), 3000);
			return () => clearInterval(id);
		}

		const supabase = createClient();

		const ka = createRealtimeKeepalive({
			client: supabase,
			channels: () => {
				const db = supabase
					.channel(`room:${room.id}`)
					.on(
						'postgres_changes',
						{ event: '*', schema: 'public', table: 'auctions', filter: `room_id=eq.${room.id}` },
						() => invalidateAll()
					)
					.on(
						'postgres_changes',
						{
							event: '*',
							schema: 'public',
							table: 'room_members',
							filter: `room_id=eq.${room.id}`
						},
						() => invalidateAll()
					)
					.on(
						'postgres_changes',
						{ event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
						() => invalidateAll()
					);

				const presence = supabase.channel(`room:${room.id}:presence`, {
					config: { presence: { key: myUserId ?? 'anon' } }
				});
				presence.on('presence', { event: 'sync' }, () => {
					const state = presence.presenceState();
					onlineUserIds = new Set(Object.keys(state));
				});

				// Wrap subscribe so presence.track fires once the channel is up,
				// while still letting keepalive observe the status callback.
				const origSubscribe = presence.subscribe.bind(presence);
				presence.subscribe = ((cb?: (status: string) => void) =>
					origSubscribe(async (status: string) => {
						cb?.(status);
						if (status === 'SUBSCRIBED' && myUserId) {
							await presence.track({ user_id: myUserId, online_at: Date.now() });
						}
					})) as typeof presence.subscribe;

				return [db, presence];
			},
			onResync: () => {
				invalidateAll();
			},
			isAuctionActive: () => activeAuction?.status === 'active'
		});

		ka.start();
		keepalive = ka;

		// Fallback polling: even with realtime, refresh every 3s while drafting
		// or voting so the UI is never more than a beat behind. Cheap insurance
		// when postgres_changes events fail to arrive (network, RLS, channel
		// hiccup) — and stops on its own when the room finishes.
		const pollId = setInterval(() => {
			if (room.status === 'drafting' || room.status === 'voting') {
				invalidateAll();
			}
		}, 3000);

		return () => {
			clearInterval(pollId);
			ka.stop();
			keepalive = null;
		};
	});

	// Re-evaluate the wake lock when the active auction transitions.
	$effect(() => {
		// Re-run on auction status changes.
		void activeAuction?.status;
		void keepalive?.refreshWakeLock();
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
			class="tnum rounded-[var(--radius)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-4 py-2 text-xl tracking-[0.3em] transition-colors hover:bg-[color:var(--color-surface)]"
			style="font-family: var(--font-mono);"
			title="Toca per copiar"
		>
			{room.code}
		</button>
		<div class="flex items-center gap-2">
			{#if !isReadOnly && keepalive}
				<ConnectionPill status={keepalive.status} />
			{/if}
			{#if isReadOnly}
				<span
					class="rounded-full border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-2 py-0.5 text-[10px] tracking-wider text-[color:var(--color-text-muted)] uppercase"
				>
					Espectador
				</span>
			{/if}
			{#if room.theme}
				<span class="text-right text-xs text-[color:var(--color-text-muted)]"
					>{room.theme.display_name}</span
				>
			{/if}
			<button
				type="button"
				onclick={toggleMute}
				class="min-h-[36px] rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-xs tracking-wider uppercase transition-colors hover:bg-[color:var(--color-elevated)]"
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
		{#each members as member (member.user_id)}
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
						<span
							class="rounded-full bg-[color:var(--color-accent-muted)] px-1.5 py-0.5 text-[10px] tracking-wider text-[color:var(--color-on-accent)] uppercase"
							>host</span
						>
					{/if}
				</div>
				<div class="flex items-center gap-2">
					<span class="tnum text-[color:var(--color-text-muted)]"
						>{formatCents(member.budget_remaining_cents)}</span
					>
					{#if isHost && !isReadOnly && member.user_id !== myUserId && room.status !== 'finished'}
						<details class="relative">
							<summary
								class="cursor-pointer list-none rounded px-1.5 py-0.5 text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text)]"
								aria-label="Accions">⋯</summary
							>
							<div
								class="absolute top-full right-0 z-10 mt-1 flex flex-col rounded-[var(--radius-sm)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] py-1 text-xs shadow"
							>
								<form
									method="POST"
									action="?/transferHost"
									use:enhance={({ cancel }) => {
										if (!confirm('Transferir el rol de host a aquest jugador?')) cancel();
									}}
								>
									<input type="hidden" name="user_id" value={member.user_id} />
									<button
										type="submit"
										class="w-full px-3 py-1.5 text-left whitespace-nowrap hover:bg-[color:var(--color-surface)]"
									>
										Fer host
									</button>
								</form>
								{#if room.status === 'lobby'}
									<form
										method="POST"
										action="?/kickMember"
										use:enhance={({ cancel }) => {
											if (!confirm('Fer fora aquest jugador?')) cancel();
										}}
									>
										<input type="hidden" name="user_id" value={member.user_id} />
										<button
											type="submit"
											class="w-full px-3 py-1.5 text-left whitespace-nowrap text-[color:var(--color-accent)] hover:bg-[color:var(--color-surface)]"
										>
											Fer fora
										</button>
									</form>
								{/if}
							</div>
						</details>
					{/if}
				</div>
			</div>
		{/each}
	</section>

	{#if room.status === 'lobby'}
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
					<form
						method="POST"
						action="?/updateSettings"
						class="mt-3 flex flex-col gap-2"
						use:enhance
					>
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
		<!-- Adjudicat banner -->
		{#if adjudicatedShown}
			<div
				in:fly={{ y: -8, duration: 200 }}
				out:fly={{ y: -8, duration: 200 }}
				class="fixed inset-x-0 top-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-[var(--radius)] border border-[color:var(--color-accent)] bg-[color:var(--color-elevated)] px-3 py-2 text-sm shadow-lg"
				style="margin-left: max(0.75rem, env(safe-area-inset-left)); margin-right: max(0.75rem, env(safe-area-inset-right));"
			>
				{#if adjudicatedShown.player_photo_url}
					<img
						src={adjudicatedShown.player_photo_url}
						alt={adjudicatedShown.player_name}
						class="h-10 w-10 flex-shrink-0 rounded-full border border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)] object-cover"
					/>
				{:else}
					<div
						class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)] text-xs font-medium"
						style="font-family: var(--font-display);"
					>
						{initials(adjudicatedShown.player_name)}
					</div>
				{/if}
				<div class="flex min-w-0 flex-1 flex-col leading-tight">
					{#if adjudicatedShown.winner_id}
						<span class="text-[10px] tracking-widest text-[color:var(--color-accent)] uppercase"
							>Adjudicat</span
						>
						<span class="truncate text-sm font-medium">
							{adjudicatedShown.player_name} → {adjudicatedShown.winner_name ?? 'auto'}
						</span>
						<span class="tnum text-xs text-[color:var(--color-text-muted)]">
							{adjudicatedShown.final_price_cents
								? formatCents(adjudicatedShown.final_price_cents)
								: 'auto'}
						</span>
					{:else}
						<span class="text-[10px] tracking-widest text-[color:var(--color-text-muted)] uppercase"
							>Sense pujades</span
						>
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
						{#if activePlayer.photo_url}
							<img
								src={activePlayer.photo_url}
								alt={activePlayer.name}
								loading="eager"
								class="h-14 w-14 flex-shrink-0 rounded-full border border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)] object-cover"
							/>
						{:else}
							<div
								class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)] text-xl font-medium tracking-wide"
								style="font-family: var(--font-display);"
								aria-hidden="true"
							>
								{initials(activePlayer.name)}
							</div>
						{/if}
						<div>
							<span
								class="inline-block rounded-[var(--radius-sm)] bg-[color:var(--color-accent-muted)] px-2 py-0.5 text-xs font-semibold tracking-wider text-[color:var(--color-on-accent)] uppercase"
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
					<p class="text-xs tracking-widest text-[color:var(--color-text-faint)] uppercase">
						temps
					</p>
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
				class="mt-4 flex items-baseline justify-between border-t border-[color:var(--color-border)] pt-4"
			>
				<div>
					<p class="text-xs tracking-widest text-[color:var(--color-text-faint)] uppercase">
						puja actual
					</p>
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
						{myTeam.length} jug · {formatCents(teamSpentCents(myUserId))}
					</span>
				</summary>
				{#if myTeam.length === 0}
					<p class="border-t border-[color:var(--color-border)] px-4 py-3 text-xs text-[color:var(--color-text-muted)]">
						Encara no has guanyat cap subhasta.
					</p>
				{:else}
					<div class="border-t border-[color:var(--color-border)] px-4 py-3 text-sm">
						{#each FORMATION_ROWS as row (row.label)}
							{@const playersInRow = row.positions.flatMap((pos) => myByPos[pos] ?? [])}
							{#if playersInRow.length > 0}
								<div class="mb-2 last:mb-0">
									<p
										class="mb-1 text-[10px] tracking-widest text-[color:var(--color-text-faint)] uppercase"
									>
										{row.label}
									</p>
									<ul class="flex flex-col gap-0.5">
										{#each playersInRow as p (p.auction_id)}
											<li class="flex justify-between gap-2">
												<span>
													<span
														class="inline-block min-w-[28px] rounded-[2px] bg-[color:var(--color-accent-muted)] px-1 py-0.5 text-center text-[10px] font-semibold tracking-wider text-[color:var(--color-on-accent)] uppercase"
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
				<h3 class="text-xs tracking-widest text-[color:var(--color-text-faint)] uppercase">
					historial
				</h3>
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
						<span class="tracking-wider uppercase">Timer següent</span>
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
		<section
			class="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-center"
		>
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
								{team.length} jug. · {formatCents(teamSpentCents(member.user_id))}
							</span>
						</summary>
						<div class="border-t border-[color:var(--color-border)] px-4 py-3 text-sm">
							{#each FORMATION_ROWS as row (row.label)}
								{@const playersInRow = row.positions.flatMap((pos) => byPos[pos] ?? [])}
								{#if playersInRow.length > 0}
									<div class="mb-2 last:mb-0">
										<p
											class="mb-1 text-[10px] tracking-widest text-[color:var(--color-text-faint)] uppercase"
										>
											{row.label}
										</p>
										<ul class="flex flex-col gap-0.5">
											{#each playersInRow as p (p.auction_id)}
												{@const isAuto = p.auction_status === 'auto_assigned'}
												<li class="flex items-baseline justify-between gap-2">
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
															{isAuto ? '(auto-assignat)' : p.player_name}
														</span>
													</span>
													<span class="tnum text-xs text-[color:var(--color-text-muted)]">
														{p.final_price_cents
															? formatCents(p.final_price_cents)
															: 'auto'}
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
						<span class="text-xs tracking-widest text-[color:var(--color-text-faint)] uppercase"
							>Top 1 — 3 pts (obligatori)</span
						>
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
						<span class="text-xs tracking-widest text-[color:var(--color-text-faint)] uppercase"
							>Top 2 — 2 pts</span
						>
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
						<span class="text-xs tracking-widest text-[color:var(--color-text-faint)] uppercase"
							>Top 3 — 1 pt</span
						>
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
	{:else}
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

			<!-- Teams revealed in formation order -->
			<div class="flex flex-col gap-4">
				{#each members as member (member.user_id)}
					{@const team = teamsByUser[member.user_id] ?? []}
					{@const byPos = teamByPosition(team)}
					<details
						class="rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
					>
						<summary class="flex cursor-pointer items-baseline justify-between px-4 py-3">
							<span class="font-medium">{member.profile?.display_name ?? 'Convidat'}</span>
							<span class="tnum text-xs text-[color:var(--color-text-muted)]">
								{team.length} jug · {formatCents(teamSpentCents(member.user_id))}
							</span>
						</summary>
						<div class="border-t border-[color:var(--color-border)] px-4 py-3 text-sm">
							{#each FORMATION_ROWS as row (row.label)}
								{@const playersInRow = row.positions.flatMap((pos) => byPos[pos] ?? [])}
								{#if playersInRow.length > 0}
									<div class="mb-2 last:mb-0">
										<p
											class="mb-1 text-[10px] tracking-widest text-[color:var(--color-text-faint)] uppercase"
										>
											{row.label}
										</p>
										<ul class="flex flex-col gap-0.5">
											{#each playersInRow as p (p.auction_id)}
												<li class="flex justify-between gap-2">
													<span>
														<span
															class="inline-block min-w-[28px] rounded-[2px] bg-[color:var(--color-accent-muted)] px-1 py-0.5 text-center text-[10px] font-semibold tracking-wider text-[color:var(--color-on-accent)] uppercase"
															>{p.position_slot}</span
														>
														<span class="ml-2">{p.player_name}</span>
													</span>
													<span class="tnum text-xs text-[color:var(--color-text-muted)]">
														{p.final_price_cents
															? formatCents(p.final_price_cents)
															: 'auto'}
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
		</section>
	{/if}

	<a
		href="/"
		class="text-center text-sm text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
	>
		← Tornar al lobby
	</a>
</main>
