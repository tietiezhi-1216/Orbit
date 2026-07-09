<script lang="ts">
	import { Trash2 } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { apiGet, apiSend, cleanupError } from '$lib/utils/http';
	import { formatDate } from '$lib/utils';
	import type { AgentItem } from '$lib/types';

	let agents = $state<AgentItem[]>([]);
	let loading = $state(false);
	let notice = $state('');
	let error = $state('');

	onMount(() => {
		void loadAgents();
	});

	async function loadAgents() {
		loading = true;
		error = '';
		try {
			const data = await apiGet<{ agents: AgentItem[]; total: number }>('/v1/agents');
			agents = data.agents ?? [];
		} catch (err) {
			error = cleanupError(err);
		} finally {
			loading = false;
		}
	}

	async function killAgent(spawnID: string) {
		error = '';
		notice = '';
		try {
			await apiSend<{ success: boolean }>(`/v1/agents/${encodeURIComponent(spawnID)}`, 'DELETE');
			notice = '子代理已终止';
			await loadAgents();
		} catch (err) {
			error = cleanupError(err);
		}
	}
</script>

<svelte:head>
	<title>子代理 - tietiezhi 控制台</title>
</svelte:head>

<section class="panel">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-base font-semibold">子代理</h2>
		<div class="flex items-center gap-2">
			<span class="text-sm text-slate-500 dark:text-slate-400">{agents.length} 个</span>
			<button type="button" class="secondary-button" onclick={() => void loadAgents()} disabled={loading}>
				刷新
			</button>
		</div>
	</div>
	{#if error}
		<div class="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
			{error}
		</div>
	{/if}
	{#if notice}
		<div class="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
			{notice}
		</div>
	{/if}
	<div class="space-y-3">
		{#each agents as agent}
			<div class="rounded-md border border-slate-200 p-3 dark:border-slate-800">
				<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<p class="font-medium">{agent.label || agent.spawn_id}</p>
							<span class="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
								{agent.status}
							</span>
						</div>
						<p class="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">{agent.session_key}</p>
						<p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
							{formatDate(agent.started_at)} - {formatDate(agent.ended_at)}
						</p>
						{#if agent.error}
							<p class="mt-2 text-sm text-rose-600 dark:text-rose-300">{agent.error}</p>
						{/if}
					</div>
					<button type="button" class="danger-button" onclick={() => void killAgent(agent.spawn_id)}>
						<Trash2 class="size-4" />
						终止
					</button>
				</div>
			</div>
		{:else}
			<p class="rounded-md bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
				暂无子代理
			</p>
		{/each}
	</div>
</section>
