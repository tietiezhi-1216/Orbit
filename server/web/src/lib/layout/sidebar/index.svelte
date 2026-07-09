<script lang="ts">
	import { ChevronRight, Layers3 } from '@lucide/svelte';
	import ThemeToggle from '$lib/layout/theme-toggle/index.svelte';
	import type { Component } from 'svelte';
	import type { ConfigSnapshot, StatusResponse } from '$lib/types';

	type NavItem = {
		href: string;
		label: string;
		accent: string;
		icon: Component;
	};

	let {
		navItems,
		activeHref,
		status,
		config
	}: {
		navItems: NavItem[];
		activeHref: string;
		status: StatusResponse | null;
		config: ConfigSnapshot | null;
	} = $props();
</script>

<aside
	class="hidden h-dvh min-h-0 flex-col border-r border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90 lg:flex"
>
	<div class="shrink-0 px-4 py-5">
		<div class="flex items-center gap-3 px-2">
			<div
				class="flex size-10 items-center justify-center rounded-md bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
			>
				<Layers3 class="size-5" />
			</div>
			<div class="min-w-0">
				<p class="truncate text-sm font-semibold text-slate-950 dark:text-white">tietiezhi</p>
				<p class="truncate text-xs text-slate-500 dark:text-slate-400">本地 Agent 控制台</p>
			</div>
		</div>
	</div>

	<nav class="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 pb-4">
		{#each navItems as item}
			{@const Icon = item.icon}
			<a
				href={item.href}
				class={`group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition ${
					activeHref === item.href
						? 'bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950'
						: 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white'
				}`}
			>
				<span class={`h-2 w-2 shrink-0 rounded-full ${item.accent}`}></span>
				<Icon class="size-4 shrink-0" />
				<span class="min-w-0 flex-1 truncate">{item.label}</span>
				{#if activeHref === item.href}
					<ChevronRight class="size-4 shrink-0" />
				{/if}
			</a>
		{/each}
	</nav>

	<div class="shrink-0 space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
		<div class="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
			<p class="truncate font-medium text-slate-800 dark:text-slate-100">
				{config?.llm.model || status?.model || '未加载模型'}
			</p>
			<p class="mt-1 truncate">{config?.runtime.app_dir || '~/.tietiezhi'}</p>
		</div>
		<ThemeToggle />
	</div>
</aside>
