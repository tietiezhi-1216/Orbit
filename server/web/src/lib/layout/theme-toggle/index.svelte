<script lang="ts">
	import { Monitor, Moon, Sun } from '@lucide/svelte';
	import { onMount } from 'svelte';

	type ThemePreference = 'system' | 'light' | 'dark';

	const storageKey = 'tietiezhi-theme';
	const options = [
		{ value: 'system', label: '系统', icon: Monitor },
		{ value: 'light', label: '浅色', icon: Sun },
		{ value: 'dark', label: '夜间', icon: Moon }
	] satisfies Array<{ value: ThemePreference; label: string; icon: typeof Monitor }>;

	let preference = $state<ThemePreference>('system');
	let mediaQuery: MediaQueryList | null = null;

	onMount(() => {
		const stored = localStorage.getItem(storageKey);
		if (stored === 'light' || stored === 'dark' || stored === 'system') {
			preference = stored;
		}

		mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleSystemChange = () => {
			if (preference === 'system') applyTheme(preference);
		};

		applyTheme(preference);
		mediaQuery.addEventListener('change', handleSystemChange);

		return () => mediaQuery?.removeEventListener('change', handleSystemChange);
	});

	function setPreference(next: ThemePreference) {
		preference = next;
		localStorage.setItem(storageKey, next);
		applyTheme(next);
	}

	function applyTheme(next: ThemePreference) {
		const shouldUseDark =
			next === 'dark' || (next === 'system' && mediaQuery?.matches === true);
		document.documentElement.classList.toggle('dark', shouldUseDark);
	}
</script>

<div class="grid grid-cols-3 gap-1 rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
	{#each options as option}
		{@const Icon = option.icon}
		<button
			type="button"
			class={`inline-flex items-center justify-center gap-1 rounded-sm px-2 py-1.5 text-xs font-medium transition ${
				preference === option.value
					? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white'
					: 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
			}`}
			aria-label={`切换到${option.label}模式`}
			title={option.label}
			onclick={() => setPreference(option.value)}
		>
			<Icon class="size-3.5" />
			<span class="hidden xl:inline">{option.label}</span>
		</button>
	{/each}
</div>
