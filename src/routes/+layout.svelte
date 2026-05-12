<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import UpdateToast from '$lib/components/UpdateToast.svelte';

	let { children }: { children: Snippet } = $props();
</script>

{@render children()}
<UpdateToast />
