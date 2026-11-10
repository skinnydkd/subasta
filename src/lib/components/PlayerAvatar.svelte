<script lang="ts">
	import { initials, kitFor } from '$lib/utils/kit';

	let {
		name,
		team = null,
		photoUrl = null,
		size = 56
	}: { name: string; team?: string | null; photoUrl?: string | null; size?: number } = $props();

	const kit = $derived(kitFor(team, name));
	const uid = $props.id();
	// Shirt silhouette in a 48x48 box; the stripes/hoops are clipped to the body.
	const BODY =
		'M16 6 L8 10 L2 20 L9 24 L12 21 L12 44 L36 44 L36 21 L39 24 L46 20 L40 10 L32 6 Q24 12 16 6 Z';
</script>

{#if photoUrl}
	<img
		src={photoUrl}
		alt={name}
		width={size}
		height={size}
		class="flex-shrink-0 rounded-full border border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)] object-cover"
		style="width: {size}px; height: {size}px;"
	/>
{:else}
	<svg
		viewBox="0 0 48 48"
		width={size}
		height={size}
		class="flex-shrink-0"
		role="img"
		aria-label={name}
	>
		<defs>
			<clipPath id="shirt-{uid}"><path d={BODY} /></clipPath>
		</defs>
		<path d={BODY} fill={kit.primary} />
		<g clip-path="url(#shirt-{uid})">
			{#if kit.pattern === 'stripes'}
				{#each [7, 17, 27, 37] as x (x)}
					<rect {x} y="0" width="5" height="48" fill={kit.secondary} />
				{/each}
			{:else if kit.pattern === 'hoops'}
				{#each [12, 22, 32] as y (y)}
					<rect x="0" {y} width="48" height="5" fill={kit.secondary} />
				{/each}
			{/if}
			<!-- Sleeves in the secondary colour for plain shirts -->
			{#if kit.pattern === 'plain'}
				<path d="M8 10 L2 20 L9 24 L12 21 L12 11 Z" fill={kit.secondary} />
				<path d="M40 10 L46 20 L39 24 L36 21 L36 11 Z" fill={kit.secondary} />
			{/if}
		</g>
		<path d="M16 6 Q24 12 32 6" fill="none" stroke={kit.secondary} stroke-width="2" />
		<path d={BODY} fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="0.8" />
		<!-- Initials sit on a small plate so they stay readable over stripes -->
		<rect x="15" y="22" width="18" height="13" rx="3" fill={kit.primary} opacity="0.92" />
		<text
			x="24"
			y="29"
			text-anchor="middle"
			dominant-baseline="central"
			font-size="10.5"
			font-weight="600"
			fill={kit.ink}
			style="font-family: var(--font-display);"
		>
			{initials(name)}
		</text>
	</svg>
{/if}
