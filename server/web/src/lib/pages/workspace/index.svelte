<script lang="ts">
	import { FileText, FolderOpen, Save, Search } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { apiGet, apiSend, cleanupError } from '$lib/utils/http';
	import { formatBytes } from '$lib/utils';
	import type { WorkspaceFile } from '$lib/types';

	let workspace = $state<{ files: WorkspaceFile[]; base_path: string; total: number }>({
		files: [],
		base_path: '',
		total: 0
	});
	let workspaceSearch = $state('');
	let selectedFile = $state('');
	let filePathInput = $state('');
	let fileContent = $state('');
	let fileLoading = $state(false);
	let loading = $state(false);
	let notice = $state('');
	let error = $state('');

	const filteredWorkspaceFiles = $derived.by(() => {
		const keyword = workspaceSearch.trim().toLowerCase();
		return workspace.files
			.filter((file) => !keyword || file.path.toLowerCase().includes(keyword))
			.sort((a, b) => {
				if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
				return a.path.localeCompare(b.path);
			});
	});

	onMount(() => {
		void loadWorkspace();
	});

	async function loadWorkspace() {
		loading = true;
		error = '';
		try {
			workspace = await apiGet<{ files: WorkspaceFile[]; base_path: string; total: number }>(
				'/v1/workspace'
			);
		} catch (err) {
			error = cleanupError(err);
		} finally {
			loading = false;
		}
	}

	async function openWorkspaceFile(path: string) {
		if (!path) return;
		fileLoading = true;
		error = '';
		try {
			const data = await apiGet<{ path: string; content: string; size: number }>(
				`/v1/workspace/file?path=${encodeURIComponent(path)}`
			);
			selectedFile = data.path;
			filePathInput = data.path;
			fileContent = data.content;
		} catch (err) {
			error = cleanupError(err);
		} finally {
			fileLoading = false;
		}
	}

	async function saveWorkspaceFile() {
		error = '';
		notice = '';
		try {
			await apiSend<{ success: boolean; path: string }>('/v1/workspace/file', 'PUT', {
				path: filePathInput,
				content: fileContent
			});
			selectedFile = filePathInput;
			notice = '工作区文件已保存';
			await loadWorkspace();
		} catch (err) {
			error = cleanupError(err);
		}
	}
</script>

<svelte:head>
	<title>工作区 - tietiezhi 控制台</title>
</svelte:head>

<section class="grid gap-5 xl:grid-cols-[360px_1fr]">
	<div class="panel flex min-h-[640px] flex-col">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-base font-semibold">文件</h2>
			<div class="flex items-center gap-2">
				<span class="text-sm text-slate-500 dark:text-slate-400">{workspace.total} 个</span>
				<button type="button" class="secondary-button" onclick={() => void loadWorkspace()} disabled={loading}>
					刷新
				</button>
			</div>
		</div>
		<label class="mb-3 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
			<Search class="size-4 text-slate-400" />
			<input
				class="min-w-0 flex-1 bg-transparent text-sm outline-none"
				placeholder="过滤文件"
				bind:value={workspaceSearch}
			/>
		</label>
		<div class="min-h-0 flex-1 space-y-1 overflow-auto pr-1">
			{#each filteredWorkspaceFiles as file}
				<button
					type="button"
					class={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
						selectedFile === file.path
							? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
							: 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
					}`}
					disabled={file.is_dir}
					onclick={() => void openWorkspaceFile(file.path)}
				>
					{#if file.is_dir}
						<FolderOpen class="size-4 text-slate-400" />
					{:else}
						<FileText class="size-4 text-indigo-500" />
					{/if}
					<span class="min-w-0 flex-1 truncate">{file.path}</span>
					<span class="text-xs text-slate-400">{file.is_dir ? '' : formatBytes(file.size)}</span>
				</button>
			{/each}
		</div>
	</div>

	<div class="panel">
		<div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div>
				<h2 class="text-base font-semibold">编辑文件</h2>
				<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{workspace.base_path}</p>
			</div>
			<button type="button" class="primary-button" onclick={() => void saveWorkspaceFile()}>
				<Save class="size-4" />
				保存文件
			</button>
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
			<label class="space-y-1">
				<span class="field-label">相对路径</span>
				<input class="input-control" bind:value={filePathInput} />
			</label>
			<label class="space-y-1">
				<span class="field-label">{fileLoading ? '读取中' : '文件内容'}</span>
				<textarea
					class="textarea-control min-h-[520px] font-mono text-xs leading-5"
					bind:value={fileContent}
				></textarea>
			</label>
		</div>
	</div>
</section>
