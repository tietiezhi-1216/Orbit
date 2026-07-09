<script lang="ts">
	import { CalendarClock, Trash2 } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { apiGet, apiSend, cleanupError } from '$lib/utils/http';
	import { formatDate } from '$lib/utils';
	import type { CronJob } from '$lib/types';

	let jobs = $state<CronJob[]>([]);
	let loading = $state(false);
	let notice = $state('');
	let error = $state('');
	let form = $state({
		name: '',
		message: '',
		kind: 'every',
		at: '',
		every_minutes: 60,
		expr: '*/30 * * * *'
	});

	onMount(() => {
		void loadCron();
	});

	async function loadCron() {
		loading = true;
		error = '';
		try {
			const data = await apiGet<{ jobs: CronJob[]; total: number }>('/v1/cron');
			jobs = data.jobs ?? [];
		} catch (err) {
			error = cleanupError(err);
		} finally {
			loading = false;
		}
	}

	async function createCronJob() {
		error = '';
		notice = '';
		try {
			const payload = {
				name: form.name,
				message: form.message,
				kind: form.kind,
				at: form.kind === 'at' && form.at ? new Date(form.at).toISOString() : '',
				every_ms: form.kind === 'every' ? Math.max(1, form.every_minutes) * 60 * 1000 : 0,
				expr: form.kind === 'cron' ? form.expr : ''
			};
			await apiSend<{ success: boolean; job_id: string }>('/v1/cron', 'POST', payload);
			notice = '定时任务已创建';
			form.name = '';
			form.message = '';
			await loadCron();
		} catch (err) {
			error = cleanupError(err);
		}
	}

	async function deleteCronJob(id: string) {
		error = '';
		notice = '';
		try {
			await apiSend<{ success: boolean }>(`/v1/cron/${encodeURIComponent(id)}`, 'DELETE');
			notice = '定时任务已删除';
			await loadCron();
		} catch (err) {
			error = cleanupError(err);
		}
	}

	function scheduleLabel(job: CronJob): string {
		if (job.schedule.kind === 'every') {
			const minutes = Math.round((job.schedule.every_ms ?? 0) / 60000);
			return `每 ${minutes} 分钟`;
		}
		if (job.schedule.kind === 'at') return formatDate(job.schedule.at);
		return job.schedule.expr ?? 'cron';
	}
</script>

<svelte:head>
	<title>定时任务 - tietiezhi 控制台</title>
</svelte:head>

<section class="grid gap-5 xl:grid-cols-[360px_1fr]">
	<div class="panel">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-base font-semibold">创建任务</h2>
			<button type="button" class="secondary-button" onclick={() => void loadCron()} disabled={loading}>
				刷新
			</button>
		</div>
		<div class="space-y-3">
			<label class="space-y-1">
				<span class="field-label">名称</span>
				<input class="input-control" bind:value={form.name} />
			</label>
			<label class="space-y-1">
				<span class="field-label">类型</span>
				<select class="input-control" bind:value={form.kind}>
					<option value="every">every</option>
					<option value="cron">cron</option>
					<option value="at">at</option>
				</select>
			</label>
			{#if form.kind === 'every'}
				<label class="space-y-1">
					<span class="field-label">间隔分钟</span>
					<input class="input-control" type="number" min="1" bind:value={form.every_minutes} />
				</label>
			{:else if form.kind === 'cron'}
				<label class="space-y-1">
					<span class="field-label">Cron 表达式</span>
					<input class="input-control" bind:value={form.expr} />
				</label>
			{:else}
				<label class="space-y-1">
					<span class="field-label">执行时间</span>
					<input class="input-control" type="datetime-local" bind:value={form.at} />
				</label>
			{/if}
			<label class="space-y-1">
				<span class="field-label">消息</span>
				<textarea class="textarea-control" rows="6" bind:value={form.message}></textarea>
			</label>
			<button
				type="button"
				class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
				onclick={() => void createCronJob()}
			>
				<CalendarClock class="size-4" />
				创建任务
			</button>
		</div>
	</div>

	<div class="panel">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-base font-semibold">任务列表</h2>
			<span class="text-sm text-slate-500 dark:text-slate-400">{jobs.length} 个</span>
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
			{#each jobs as job}
				<div class="rounded-md border border-slate-200 p-3 dark:border-slate-800">
					<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
						<div class="min-w-0">
							<p class="truncate font-medium">{job.name || job.id}</p>
							<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{scheduleLabel(job)}</p>
							<p class="mt-2 line-clamp-2 text-sm text-slate-700 dark:text-slate-300">{job.message}</p>
						</div>
						<button type="button" class="danger-button" onclick={() => void deleteCronJob(job.id)}>
							<Trash2 class="size-4" />
							删除
						</button>
					</div>
					<div class="mt-3 grid gap-2 text-xs text-slate-500 dark:text-slate-400 md:grid-cols-3">
						<span>运行 {job.run_count} 次</span>
						<span>上次 {formatDate(job.last_run_at)}</span>
						<span>下次 {formatDate(job.next_run_at)}</span>
					</div>
				</div>
			{:else}
				<p class="rounded-md bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
					暂无任务
				</p>
			{/each}
		</div>
	</div>
</section>
