<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatCents } from '$lib/utils/currency';
	import type { Member, RoomData } from './shared';

	let {
		room,
		members,
		isHost,
		isReadOnly,
		myUserId,
		onlineUserIds
	}: {
		room: RoomData['room'];
		members: Member[];
		isHost: boolean;
		isReadOnly: boolean;
		myUserId: string | null;
		onlineUserIds: Set<string>;
	} = $props();
</script>

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
