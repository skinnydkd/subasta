<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { enableAudio, isMuted, setMuted, sounds } from '$lib/utils/sounds';
	import type { ActionData, PageData } from './$types';
	import { createKeepalive } from '$lib/realtime/keepalive.svelte';
	import ConnectionPill from '$lib/components/ConnectionPill.svelte';
	import MemberList from '$lib/components/room/MemberList.svelte';
	import LobbyPanel from '$lib/components/room/LobbyPanel.svelte';
	import DraftPanel from '$lib/components/room/DraftPanel.svelte';
	import VotingPanel from '$lib/components/room/VotingPanel.svelte';
	import ResultsPanel from '$lib/components/room/ResultsPanel.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const room = $derived(data.room);
	const members = $derived(data.members);
	const isHost = $derived(data.isHost);
	const isReadOnly = $derived(data.readOnly ?? false);
	const activeAuction = $derived(data.activeAuction);

	const myUserId = $derived(data.user?.id ?? null);

	// Pending auctions for the "next up" preview (sequence_number > active).
	const upcomingAuctions = $derived(data.upcomingAuctions ?? []);

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

	// Presence: members seen by the server in the last few seconds.
	const onlineUserIds = $derived(new Set(data.onlineUserIds));

	// State arrives by polling the server load. Keepalive handles
	// visibility / online / offline resync + wake lock.
	let keepalive = $state<ReturnType<typeof createKeepalive> | null>(null);

	onMount(() => {
		if (room.status === 'finished') return;

		const ka = createKeepalive({
			onResync: () => {
				invalidateAll();
			},
			isAuctionActive: () => activeAuction?.status === 'active'
		});
		if (!isReadOnly) {
			ka.start();
			keepalive = ka;
		}

		// 1s while drafting (bids move fast), slower otherwise; spectators at 3s.
		// Self-rescheduling setTimeout so the delay follows the room status.
		// ponytail: every viewer polls the full room view; switch to a push
		// channel (SSE / Durable Object) if 1s lag or request volume ever hurts.
		let pollTimer: ReturnType<typeof setTimeout> | null = null;
		const schedulePoll = () => {
			const delay = isReadOnly ? 3000 : room.status === 'drafting' ? 1000 : 2500;
			pollTimer = setTimeout(() => {
				if (room.status !== 'finished' && document.visibilityState === 'visible') {
					invalidateAll();
				}
				schedulePoll();
			}, delay);
		};
		schedulePoll();

		return () => {
			if (pollTimer) clearTimeout(pollTimer);
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
	class="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-6 lg:max-w-5xl"
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
					class="rounded-full border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-2 py-0.5 text-xs text-[color:var(--color-text-muted)]"
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
				class="min-h-[36px] rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-xs transition-colors hover:bg-[color:var(--color-elevated)]"
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

	<div
		class="flex flex-col gap-6 lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start lg:gap-8"
	>
		<MemberList {room} {members} {isHost} {isReadOnly} {myUserId} {onlineUserIds} />

		<div class="flex min-w-0 flex-col gap-6">
			{#if room.status === 'lobby'}
				<LobbyPanel {data} {form} />
			{:else if room.status === 'drafting'}
				<DraftPanel {data} {form} />
			{:else if room.status === 'voting'}
				<VotingPanel {data} {form} />
			{:else}
				<ResultsPanel {data} />
			{/if}
		</div>
	</div>

	<a
		href="/"
		class="text-center text-sm text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
	>
		← Tornar al lobby
	</a>
</main>
