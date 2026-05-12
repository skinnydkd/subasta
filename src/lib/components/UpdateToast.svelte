<script lang="ts">
  import { onMount } from 'svelte';
  import { swUpdate } from '$lib/pwa/swUpdate.svelte';

  onMount(() => swUpdate.init());
</script>

{#if swUpdate.updateReady}
  <div
    role="status"
    class="fixed inset-x-0 bottom-0 z-50 mx-auto mb-4 flex max-w-md items-center justify-between gap-3 rounded-[var(--radius)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-elevated)] px-4 py-3 text-sm shadow-lg"
    style="margin-left: max(1rem, env(safe-area-inset-left)); margin-right: max(1rem, env(safe-area-inset-right)); margin-bottom: max(1rem, env(safe-area-inset-bottom));"
  >
    <span>Versió nova disponible.</span>
    <button
      type="button"
      onclick={() => swUpdate.apply()}
      class="rounded-[var(--radius-sm)] bg-[color:var(--color-accent)] px-3 py-1 text-xs font-medium uppercase tracking-wider text-white hover:bg-[color:var(--color-accent-hover)]"
    >
      Refresca
    </button>
  </div>
{/if}
