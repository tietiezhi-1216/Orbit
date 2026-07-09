<script lang="ts">
	import { goto } from '$app/navigation';
	import { LoaderCircle, RefreshCw } from '@lucide/svelte';
	import ThemeToggle from '$lib/layout/theme-toggle/index.svelte';
	import type { Component } from 'svelte';

	type NavItem = {
		href: string;
		label: string;
		accent: string;
		icon: Component;
	};

	let {
		navItems,
		activeItem,
		lastRefresh,
		loading,
		onRefresh
	}: {
		navItems: NavItem[];
		activeItem: NavItem;
		lastRefresh: string;
		loading: boolean;
		onRefresh: () => void;
	} = $props();

	function changeRoute(event: Event) {
		const target = event.currentTarget as HTMLSelectElement;
		void goto(target.value);
	}
</script>

<header
	class="shrink-0 border-b border-slate-200 bg-[#f7faf9]/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
>
	<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<div class="min-w-0">
			<div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
				<span class={`h-2 w-2 shrink-0 rounded-full ${activeItem.accent}`}></span>
				<span>最后刷新 {lastRefresh}</span>
			</div>
			<h1 class="mt-1 truncate text-2xl font-semibold tracking-normal text-slate-950 dark:text-white">
				{activeItem.label}
			</h1>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<select class="input-control w-auto min-w-36 lg:hidden" value={activeItem.href} onchange={changeRoute}>
				{#each navItems as item}
					<option value={item.href}>{item.label}</option>
				{/each}
			</select>
			<button type="button" class="secondary-button" onclick={onRefresh} disabled={loading}>
				{#if loading}
					<LoaderCircle class="size-4 animate-spin" />
				{:else}
					<RefreshCw class="size-4" />
				{/if}
				刷新状态
			</button>
			<div class="hidden sm:block">
				<ThemeToggle />
			</div>
		</div>
	</div>
</header>
