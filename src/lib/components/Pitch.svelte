<script lang="ts">
	import { DEFAULT_FORMATION, type RoomSettings } from '$lib/auction/settings';

	type TeamPlayer = {
		auction_id: string;
		position_slot: string;
		final_price_cents: number | null;
		auction_status: string;
		player_id: string;
		player_name: string;
		player_position: string;
	};

	let {
		team,
		displayName,
		spent,
		formation = DEFAULT_FORMATION
	}: {
		team: TeamPlayer[];
		displayName: string;
		spent: string;
		formation?: RoomSettings['formation'];
	} = $props();

	// Rows from attack (top) to goal (bottom) in a portrait viewBox 100x140.
	// Within a row the left-to-right order follows ROW_ORDER, spread evenly.
	const ROWS: { y: number; order: string[] }[] = [
		{ y: 24, order: ['LW', 'ST', 'RW'] },
		{ y: 58, order: ['CAM', 'CM', 'CDM'] },
		{ y: 93, order: ['LB', 'CB', 'RB'] },
		{ y: 122, order: ['GK'] }
	];

	type Slot = { pos: string; x: number; y: number; player?: TeamPlayer };

	const slots = $derived.by(() => {
		const out: Slot[] = [];
		for (const row of ROWS) {
			const pos = row.order.flatMap((p) =>
				Array<string>(formation[p as keyof typeof formation] ?? 0).fill(p)
			);
			pos.forEach((p, i) => {
				// Wide rows keep a margin so labels stay inside the touchline.
				out.push({ pos: p, x: (100 * (i + 1)) / (pos.length + 1), y: row.y });
			});
		}
		return out;
	});

	// Give each player a free slot of the same position; the rest go to the bench.
	const placed = $derived.by(() => {
		const filled = slots.map((s) => ({ ...s }));
		const bench: TeamPlayer[] = [];
		for (const p of team) {
			const slot = filled.find((s) => s.pos === p.position_slot && !s.player);
			if (slot) slot.player = p;
			else bench.push(p);
		}
		return { filled, bench };
	});

	function shortName(name: string): string {
		// "Pedro Rodríguez" → "P. Rodríguez". Single-word stays single.
		const parts = name.trim().split(/\s+/);
		if (parts.length === 1) return parts[0];
		return parts[0][0] + '. ' + parts.slice(1).join(' ');
	}
</script>

<div
	class="rounded-[var(--radius-lg)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] p-3"
>
	<header class="mb-2 flex items-baseline justify-between gap-2">
		<h3 class="text-base font-medium">{displayName}</h3>
		<span class="tnum text-xs text-[color:var(--color-text-muted)]">{spent}</span>
	</header>

	<svg viewBox="0 0 100 140" class="block w-full" style="aspect-ratio: 100/140;">
		<!-- Pitch background -->
		<rect x="0" y="0" width="100" height="140" rx="3" fill="#22382b" />
		<!-- Outer line -->
		<rect
			x="3"
			y="3"
			width="94"
			height="134"
			rx="2"
			fill="none"
			stroke="rgba(255,255,255,0.25)"
			stroke-width="0.4"
		/>
		<!-- Halfway line -->
		<line x1="3" y1="70" x2="97" y2="70" stroke="rgba(255,255,255,0.25)" stroke-width="0.4" />
		<!-- Center circle -->
		<circle cx="50" cy="70" r="8" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="0.4" />
		<circle cx="50" cy="70" r="0.6" fill="rgba(255,255,255,0.35)" />
		<!-- Penalty boxes -->
		<rect
			x="30"
			y="3"
			width="40"
			height="14"
			fill="none"
			stroke="rgba(255,255,255,0.25)"
			stroke-width="0.4"
		/>
		<rect
			x="30"
			y="123"
			width="40"
			height="14"
			fill="none"
			stroke="rgba(255,255,255,0.25)"
			stroke-width="0.4"
		/>
		<!-- 6-yard boxes -->
		<rect
			x="40"
			y="3"
			width="20"
			height="6"
			fill="none"
			stroke="rgba(255,255,255,0.25)"
			stroke-width="0.4"
		/>
		<rect
			x="40"
			y="131"
			width="20"
			height="6"
			fill="none"
			stroke="rgba(255,255,255,0.25)"
			stroke-width="0.4"
		/>

		<!-- Players -->
		{#each placed.filled as slot, i (i)}
			{@const p = slot.player}
			{@const isAuto = p?.auction_status === 'auto_assigned'}
			{@const labelText = p ? (isAuto ? '(auto)' : shortName(p.player_name)) : slot.pos}
			<g>
				<circle
					cx={slot.x}
					cy={slot.y}
					r="3.5"
					fill={p ? (isAuto ? 'oklch(35% 0.010 60)' : 'oklch(60% 0.22 25)') : 'rgba(0,0,0,0.35)'}
					stroke="rgba(255,255,255,0.7)"
					stroke-width="0.35"
				/>
				<text
					x={slot.x}
					y={slot.y + 0.6}
					font-size="2.4"
					font-weight="700"
					text-anchor="middle"
					dominant-baseline="middle"
					fill="white"
				>
					{slot.pos}
				</text>
				<text
					x={slot.x}
					y={slot.y + 6.5}
					font-size="2.6"
					text-anchor="middle"
					fill="white"
					style="paint-order: stroke; stroke: rgba(0,0,0,0.7); stroke-width: 0.7px;"
				>
					{labelText}
				</text>
			</g>
		{/each}
	</svg>

	{#if placed.bench.length > 0}
		<p class="mt-2 text-xs text-[color:var(--color-text-muted)]">
			<span class="text-[color:var(--color-text-faint)]">Banqueta:</span>
			{placed.bench.map((p) => `${shortName(p.player_name)} (${p.position_slot})`).join(', ')}
		</p>
	{/if}
</div>
