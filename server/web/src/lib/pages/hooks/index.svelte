<script lang="ts">
	import { onMount } from 'svelte';
	import { apiGet, cleanupError } from '$lib/utils/http';
	import type { HookRule } from '$lib/types';

	let hooks = $state<{ rules: HookRule[]; enabled: boolean; total: number }>({
		rules: [],
		enabled: false,
		total: 0
	});
	let loading = $state(false);
	let error = $state('');

	onMount(() => {
		void loadHooks();
	});

	async function loadHooks() {
		loading = true;
		error = '';
		try {
			hooks = await apiGet<{ rules: HookRule[]; enabled: boolean; total: number }>('/v1/hooks');
		} catch (err) {
			error = cleanupError(err);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Hooks - tietiezhi 控制台</title>
</svelte:head>

<section class="panel">
	<div class="mb-4 flex items-center justify-between">
		<div>
			<h2 class="text-base font-semibold">Hooks</h2>
			<p class="text-sm text-slate-500 dark:text-slate-400">{hooks.enabled ? '已启用' : '未启用'}</p>
		</div>
		<div class="flex items-center gap-2">
			<span class="text-sm text-slate-500 dark:text-slate-400">{hooks.total} 条</span>
			<button type="button" class="secondary-button" onclick={() => void loadHooks()} disabled={loading}>
				刷新
			</button>
		</div>
	</div>
	{#if error}
		<div class="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
			{error}
		</div>
	{/if}
	<div class="space-y-3">
		{#each hooks.rules as rule}
			<div class="rounded-md border border-slate-200 p-3 dark:border-slate-800">
				<div class="flex flex-wrap gap-2 text-sm">
					<span class="rounded-md bg-orange-50 px-2 py-1 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">{rule.event}</span>
					<span class="badge">{rule.type}</span>
					<span class="badge">{rule.timeout}s</span>
				</div>
				<p class="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">{rule.matcher}</p>
				<p class="mt-1 font-mono text-xs text-slate-700 dark:text-slate-300">{rule.command || rule.script}</p>
			</div>
		{:else}
			<p class="rounded-md bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
				暂无 Hook 规则
			</p>
		{/each}
	</div>
</section>
