<script lang="ts">
	import { onMount } from 'svelte';
	import { apiGet, cleanupError } from '$lib/utils/http';
	import type { SessionItem } from '$lib/types';

	let sessions = $state<SessionItem[]>([]);
	let loading = $state(false);
	let error = $state('');

	onMount(() => {
		void loadSessions();
	});

	async function loadSessions() {
		loading = true;
		error = '';
		try {
			const data = await apiGet<{ sessions: SessionItem[]; total: number }>('/v1/sessions');
			sessions = data.sessions ?? [];
		} catch (err) {
			error = cleanupError(err);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>会话 - tietiezhi 控制台</title>
</svelte:head>

<section class="panel">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-base font-semibold">会话</h2>
		<div class="flex items-center gap-2">
			<span class="text-sm text-slate-500 dark:text-slate-400">{sessions.length} 个</span>
			<button type="button" class="secondary-button" onclick={() => void loadSessions()} disabled={loading}>
				刷新
			</button>
		</div>
	</div>
	{#if error}
		<div class="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
			{error}
		</div>
	{/if}
	<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
		{#each sessions as session}
			<div class="rounded-md border border-slate-200 p-3 dark:border-slate-800">
				<p class="truncate font-mono text-sm text-slate-800 dark:text-slate-200">{session.key}</p>
				<p class="mt-2 text-sm text-slate-500 dark:text-slate-400">{session.messages} 条消息</p>
			</div>
		{:else}
			<p class="rounded-md bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
				暂无会话
			</p>
		{/each}
	</div>
</section>
