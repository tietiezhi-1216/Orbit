<script lang="ts">
	import { onMount } from 'svelte';
	import { apiGet, apiSend, cleanupError } from '$lib/utils/http';
	import type { SkillItem } from '$lib/types';

	let skills = $state<SkillItem[]>([]);
	let loading = $state(false);
	let notice = $state('');
	let error = $state('');

	onMount(() => {
		void loadSkills();
	});

	async function loadSkills() {
		loading = true;
		error = '';
		try {
			const data = await apiGet<{ skills: SkillItem[]; total: number }>('/v1/skills');
			skills = data.skills ?? [];
		} catch (err) {
			error = cleanupError(err);
		} finally {
			loading = false;
		}
	}

	async function loadSkill(name: string) {
		error = '';
		notice = '';
		try {
			await apiSend<{ success: boolean }>('/v1/skills/load', 'POST', { name });
			notice = `Skill 已加载: ${name}`;
		} catch (err) {
			error = cleanupError(err);
		}
	}
</script>

<svelte:head>
	<title>Skills - tietiezhi 控制台</title>
</svelte:head>

<section class="panel">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-base font-semibold">Skills</h2>
		<div class="flex items-center gap-2">
			<span class="text-sm text-slate-500 dark:text-slate-400">{skills.length} 个</span>
			<button type="button" class="secondary-button" onclick={() => void loadSkills()} disabled={loading}>
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
	<div class="grid gap-3 xl:grid-cols-2">
		{#each skills as skill}
			<div class="rounded-md border border-slate-200 p-4 dark:border-slate-800">
				<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div class="min-w-0">
						<p class="truncate font-semibold">{skill.name}</p>
						<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{skill.description || '无描述'}</p>
						<p class="mt-2 truncate font-mono text-xs text-slate-400">{skill.dir_path}</p>
					</div>
					<button
						type="button"
						class="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-950"
						onclick={() => void loadSkill(skill.name)}
					>
						加载
					</button>
				</div>
				<div class="mt-3 flex flex-wrap gap-2">
					{#each skill.allowed_tools ?? [] as tool}
						<span class="badge">{tool}</span>
					{/each}
					{#each skill.mcp_servers ?? [] as server}
						<span class="rounded-md bg-teal-50 px-2 py-1 text-xs text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">{server}</span>
					{/each}
				</div>
			</div>
		{:else}
			<p class="rounded-md bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
				暂无 Skill
			</p>
		{/each}
	</div>
</section>
