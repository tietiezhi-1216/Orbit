<script lang="ts">
	import { onMount } from 'svelte';
	import { apiGet, cleanupError } from '$lib/utils/http';
	import type { MCPServer } from '$lib/types';

	let servers = $state<MCPServer[]>([]);
	let loading = $state(false);
	let error = $state('');

	onMount(() => {
		void loadMCP();
	});

	async function loadMCP() {
		loading = true;
		error = '';
		try {
			const data = await apiGet<{ servers: MCPServer[]; total: number }>('/v1/mcp');
			servers = data.servers ?? [];
		} catch (err) {
			error = cleanupError(err);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>MCP - tietiezhi 控制台</title>
</svelte:head>

<section class="panel">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-base font-semibold">MCP Servers</h2>
		<div class="flex items-center gap-2">
			<span class="text-sm text-slate-500 dark:text-slate-400">{servers.length} 个</span>
			<button type="button" class="secondary-button" onclick={() => void loadMCP()} disabled={loading}>
				刷新
			</button>
		</div>
	</div>
	{#if error}
		<div class="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
			{error}
		</div>
	{/if}
	<div class="grid gap-3 xl:grid-cols-2">
		{#each servers as server}
			<div class="rounded-md border border-slate-200 p-4 dark:border-slate-800">
				<p class="font-semibold">{server.name}</p>
				<div class="mt-3 space-y-2">
					{#each server.tools ?? [] as tool}
						<div class="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-950">
							<p class="text-sm font-medium">{tool.name}</p>
							<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{tool.description}</p>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<p class="rounded-md bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
				暂无 MCP Server
			</p>
		{/each}
	</div>
</section>
