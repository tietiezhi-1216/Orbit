<script lang="ts">
	import { page } from '$app/state';
	import {
		Bot,
		CalendarClock,
		FolderOpen,
		Gauge,
		PlugZap,
		Settings2,
		Users,
		Workflow,
		Zap
	} from '@lucide/svelte';
	import { onMount, type Snippet } from 'svelte';
	import Sidebar from '$lib/layout/sidebar/index.svelte';
	import Topbar from '$lib/layout/topbar/index.svelte';
	import { apiGet } from '$lib/utils/http';
	import { formatDate } from '$lib/utils';
	import type { ConfigSnapshot, StatusResponse } from '$lib/types';

	type NavItem = {
		href: string;
		label: string;
		accent: string;
		icon: typeof Gauge;
	};

	let { children }: { children: Snippet } = $props();

	const navItems = [
		{ href: '/', label: '总览', icon: Gauge, accent: 'bg-emerald-500' },
		{ href: '/config', label: '配置', icon: Settings2, accent: 'bg-cyan-500' },
		{ href: '/cron', label: '定时任务', icon: CalendarClock, accent: 'bg-amber-500' },
		{ href: '/workspace', label: '工作区', icon: FolderOpen, accent: 'bg-indigo-500' },
		{ href: '/sessions', label: '会话', icon: Users, accent: 'bg-rose-500' },
		{ href: '/skills', label: 'Skills', icon: Zap, accent: 'bg-violet-500' },
		{ href: '/mcp', label: 'MCP', icon: PlugZap, accent: 'bg-teal-500' },
		{ href: '/hooks', label: 'Hooks', icon: Workflow, accent: 'bg-orange-500' },
		{ href: '/agents', label: '子代理', icon: Bot, accent: 'bg-sky-500' }
	] satisfies NavItem[];

	let status = $state<StatusResponse | null>(null);
	let config = $state<ConfigSnapshot | null>(null);
	let loading = $state(false);

	const activeHref = $derived(resolveActiveHref(page.url.pathname));
	const activeItem = $derived(navItems.find((item) => item.href === activeHref) ?? navItems[0]);
	const lastRefresh = $derived(status ? formatDate(status.timestamp * 1000) : '未加载');

	onMount(() => {
		void refreshShell();
	});

	async function refreshShell() {
		loading = true;
		try {
			const [nextStatus, nextConfig] = await Promise.all([
				apiGet<StatusResponse>('/v1/status'),
				apiGet<ConfigSnapshot>('/v1/config')
			]);
			status = nextStatus;
			config = nextConfig;
		} catch {
			status = null;
		} finally {
			loading = false;
		}
	}

	function resolveActiveHref(pathname: string) {
		if (pathname === '/') return '/';
		return navItems.find((item) => item.href !== '/' && pathname.startsWith(item.href))?.href ?? '/';
	}
</script>

<main class="h-dvh overflow-hidden bg-[#f7faf9] text-slate-950 dark:bg-slate-950 dark:text-slate-100">
	<div class="grid h-full min-h-0 lg:grid-cols-[280px_1fr]">
		<Sidebar {navItems} {activeHref} {status} {config} />
		<section class="flex min-h-0 min-w-0 flex-col">
			<Topbar {navItems} {activeItem} lastRefresh={lastRefresh} {loading} onRefresh={refreshShell} />
			<div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
				{@render children()}
			</div>
		</section>
	</div>
</main>
