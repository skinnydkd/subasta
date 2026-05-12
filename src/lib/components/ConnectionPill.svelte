<script lang="ts">
  import type { KeepaliveStatus } from '$lib/realtime/keepalive.svelte';

  let { status }: { status: KeepaliveStatus } = $props();

  const label = $derived(
    status === 'live' ? 'En directe' :
    status === 'offline' ? 'Sense connexió' :
    status === 'reconnecting' ? 'Reconnectant…' :
    'Connectant…'
  );

  const color = $derived(
    status === 'live' ? 'var(--color-success)' :
    status === 'offline' ? 'var(--color-danger)' :
    'var(--color-warning)'
  );
</script>

{#if status !== 'live'}
  <span
    role="status"
    class="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-2 py-0.5 text-[10px] uppercase tracking-wider"
    style="color: {color};"
  >
    <span class="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style="background: {color};"></span>
    {label}
  </span>
{/if}
