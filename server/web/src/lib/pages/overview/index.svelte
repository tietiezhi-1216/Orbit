<script lang="ts">
	import { Activity, Bot, CalendarClock, Database, Server, SlidersHorizontal } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { apiGet, cleanupError } from '$lib/utils/http';
	import { formatDate } from '$lib/utils';
	import type { ConfigSnapshot, StatusResponse } from '$lib/types';

	let status = $state<StatusResponse | null>(null);
	let config = $state<ConfigSnapshot | null>(null);
	let loading = $state(false);
	let error = $state('');

	const featureEntries = $derived(status ? Object.entries(status.features) : []);
	const runtimePaths = $derived(
		config
			? [
					['配置文件', config.runtime.config_path],
					['应用目录', config.runtime.app_dir],
					['记忆工作区', config.runtime.workspace],
					['Skills', config.runtime.skills_path],
					['定时任务', config.runtime.scheduler_path],
					['会话', config.runtime.sessions_path],
					['子代理', config.runtime.subagents_path],
					['审计日志', config.runtime.audit_log_path]
				]
			: []
	);

	onMount(() => {
		void loadOverview();
	});

	async function loadOverview() {
		loading = true;
		error = '';
		try {
			const [nextStatus, nextConfig] = await Promise.all([
				apiGet<StatusResponse>('/v1/status'),
				apiGet<ConfigSnapshot>('/v1/config')
			]);
			status = nextStatus;
			config = nextConfig;
		} catch (err) {
			error = cleanupError(err);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>总览 - tietiezhi 控制台</title>
</svelte:head>

<section class="app-page">
	<div class="flex items-center justify-between gap-3">
		<div>
			<p class="text-sm text-slate-500 dark:text-slate-400">
				{status ? `状态时间 ${formatDate(status.timestamp * 1000)}` : '状态未加载'}
			</p>
			<h2 class="mt-1 text-xl font-semibold">运行总览</h2>
		</div>
		<button type="button" class="secondary-button" onclick={() => void loadOverview()} disabled={loading}>
			刷新
		</button>
	</div>

	{#if error}
		<div class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
			{error}
		</div>
	{/if}

	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		<div class="panel">
			<div class="flex items-center justify-between">
				<p class="text-sm text-slate-500 dark:text-slate-400">模型</p>
				<Bot class="size-4 text-cyan-600 dark:text-cyan-400" />
			</div>
			<p class="mt-3 truncate text-2xl font-semibold">{status?.model || '-'}</p>
			<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{config?.llm.provider || 'openai'}</p>
		</div>
		<div class="panel">
			<div class="flex items-center justify-between">
				<p class="text-sm text-slate-500 dark:text-slate-400">配置端口</p>
				<Server class="size-4 text-indigo-600 dark:text-indigo-400" />
			</div>
			<p class="mt-3 text-2xl font-semibold">{config?.server.port ?? '-'}</p>
			<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{config?.server.host || '0.0.0.0'}</p>
		</div>
		<div class="panel">
			<div class="flex items-center justify-between">
				<p class="text-sm text-slate-500 dark:text-slate-400">定时任务</p>
				<CalendarClock class="size-4 text-amber-600 dark:text-amber-400" />
			</div>
			<p class="mt-3 text-2xl font-semibold">{status?.counts.cron_jobs ?? 0}</p>
			<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
				{config?.scheduler.enabled ? '已启用' : '未启用'}
			</p>
		</div>
		<div class="panel">
			<div class="flex items-center justify-between">
				<p class="text-sm text-slate-500 dark:text-slate-400">子代理</p>
				<Activity class="size-4 text-rose-600 dark:text-rose-400" />
			</div>
			<p class="mt-3 text-2xl font-semibold">{status?.counts.agents ?? 0}</p>
			<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
				{config?.subagent.enabled ? '已启用' : '未启用'}
			</p>
		</div>
	</div>

	<div class="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
		<div class="panel">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-base font-semibold">功能开关</h2>
				<SlidersHorizontal class="size-4 text-slate-400" />
			</div>
			<div class="grid gap-2 sm:grid-cols-2">
				{#each featureEntries as [name, enabled]}
					<div
						class={`rounded-md border px-3 py-2 text-sm ${
							enabled
								? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
								: 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400'
						}`}
					>
						<div class="flex items-center justify-between gap-2">
							<span class="font-medium">{name}</span>
							<span>{enabled ? 'ON' : 'OFF'}</span>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="panel">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-base font-semibold">运行时目录</h2>
				<Database class="size-4 text-slate-400" />
			</div>
			<div class="space-y-2">
				{#each runtimePaths as [label, path]}
					<div class="grid gap-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950 md:grid-cols-[96px_1fr]">
						<span class="text-slate-500 dark:text-slate-400">{label}</span>
						<span class="min-w-0 truncate font-mono text-xs text-slate-700 dark:text-slate-300">{path}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="panel">
		<h2 class="mb-4 text-base font-semibold">资源计数</h2>
		<div class="grid gap-3 md:grid-cols-5">
			{#each Object.entries(status?.counts ?? {}) as [key, value]}
				<div class="rounded-md bg-slate-50 p-3 dark:bg-slate-950">
					<p class="text-xs uppercase text-slate-500 dark:text-slate-400">{key}</p>
					<p class="mt-1 text-xl font-semibold">{value}</p>
				</div>
			{/each}
		</div>
	</div>
</section>
