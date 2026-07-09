<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		Bot,
		CheckCircle2,
		KeyRound,
		LoaderCircle,
		PlugZap,
		Save,
		Server,
		ShieldCheck,
		TerminalSquare
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { apiGet, apiSend, cleanupError } from '$lib/utils/http';
	import {
		listToText,
		pruneUndefined,
		secretForPatch,
		textToIntList,
		textToList
	} from '$lib/utils';
	import type { ConfigForm, ConfigPanel, ConfigSnapshot, ConfigUpdateResponse } from '$lib/types';

	const configPanels = [
		{ id: 'llm', label: '模型' },
		{ id: 'agent', label: 'Agent' },
		{ id: 'runtime', label: '服务' },
		{ id: 'tools', label: '工具' },
		{ id: 'channels', label: '渠道' },
		{ id: 'sandbox', label: '沙箱' }
	] satisfies Array<{ id: ConfigPanel; label: string }>;

	let config = $state<ConfigSnapshot | null>(null);
	let configForm = $state<ConfigForm>(emptyConfigForm());
	let loading = $state(false);
	let saving = $state(false);
	let notice = $state('');
	let error = $state('');
	let configPanel = $state<ConfigPanel>('llm');

	onMount(() => {
		syncPanelFromURL();
		window.addEventListener('popstate', syncPanelFromURL);
		void loadConfig();

		return () => window.removeEventListener('popstate', syncPanelFromURL);
	});

	async function loadConfig() {
		loading = true;
		error = '';
		try {
			hydrateConfig(await apiGet<ConfigSnapshot>('/v1/config'));
		} catch (err) {
			error = cleanupError(err);
		} finally {
			loading = false;
		}
	}

	async function saveConfig() {
		saving = true;
		error = '';
		notice = '';
		try {
			const response = await apiSend<ConfigUpdateResponse>('/v1/config', 'PUT', buildConfigPatch());
			hydrateConfig(response.config);
			notice = response.message;
		} catch (err) {
			error = cleanupError(err);
		} finally {
			saving = false;
		}
	}

	function selectPanel(panel: ConfigPanel) {
		configPanel = panel;
		void goto(`/config?panel=${panel}`, { noScroll: true });
	}

	function syncPanelFromURL() {
		configPanel = resolvePanel(new URLSearchParams(window.location.search).get('panel'));
	}

	function resolvePanel(value: string | null): ConfigPanel {
		return configPanels.some((panel) => panel.id === value) ? (value as ConfigPanel) : 'llm';
	}

	function emptyConfigForm(): ConfigForm {
		return {
			server: { host: '', port: 18178 },
			llm: {
				provider: 'openai',
				base_url: '',
				api_key: '',
				model: '',
				cheap_model: '',
				cheap_base_url: '',
				cheap_api_key: '',
				model_capabilities: []
			},
			agent: {
				max_tool_calls: 20,
				system_prompt: '',
				loop_detection: true,
				compression: {
					enabled: false,
					max_chars: 80000,
					keep_recent: 10,
					summary_prompt: ''
				},
				loop_detector: {
					generic_repeat_threshold: 3,
					generic_repeat_similarity: 0.8,
					no_progress_threshold: 5,
					ping_pong_window: 8,
					global_circuit_breaker_limit: 20
				}
			},
			channels: {
				feishu: {
					enabled: false,
					app_id: '',
					app_secret: '',
					verification_token: '',
					encrypt_key: '',
					streaming: false,
					bot_open_id: ''
				},
				telegram: {
					enabled: false,
					bot_token: '',
					admin_ids: [],
					admin_ids_text: ''
				}
			},
			scheduler: { enabled: true, exec_timeout: 300 },
			heartbeat: { enabled: true, interval: 30, chat_id: '' },
			log: { level: 'info', format: 'text' },
			session: { max_history_turns: 20, auto_save_seconds: 60 },
			hooks: { enabled: false },
			subagent: { enabled: true, timeout: 300 },
			tools: {
				terminal: { blocked_cmds_text: '' },
				web_search: { provider: '', api_key: '', base_url: '' }
			},
			approval: {
				enabled: false,
				require_approval_text: '',
				auto_approve_text: ''
			},
			observability: {
				enabled: false,
				token_track: false,
				audit_log: { enabled: false }
			},
			sandbox: {
				enabled: false,
				image: 'alpine:latest',
				network_mode: 'none',
				memory_limit: '128m',
				cpu_limit: 0.5,
				work_dir: '/workspace'
			}
		};
	}

	function hydrateConfig(snapshot: ConfigSnapshot) {
		config = snapshot;
		configForm = {
			server: { ...snapshot.server },
			llm: { ...snapshot.llm, model_capabilities: snapshot.llm.model_capabilities ?? [] },
			agent: {
				...snapshot.agent,
				compression: { ...snapshot.agent.compression },
				loop_detector: { ...snapshot.agent.loop_detector }
			},
			channels: {
				feishu: { ...snapshot.channels.feishu },
				telegram: {
					...snapshot.channels.telegram,
					admin_ids: snapshot.channels.telegram.admin_ids ?? [],
					admin_ids_text: (snapshot.channels.telegram.admin_ids ?? []).join(', ')
				}
			},
			scheduler: { ...snapshot.scheduler },
			heartbeat: { ...snapshot.heartbeat },
			log: { ...snapshot.log },
			session: { ...snapshot.session },
			hooks: { enabled: snapshot.hooks.enabled },
			subagent: { ...snapshot.subagent },
			tools: {
				terminal: { blocked_cmds_text: listToText(snapshot.tools.terminal.blocked_cmds) },
				web_search: { ...snapshot.tools.web_search }
			},
			approval: {
				enabled: snapshot.approval.enabled,
				require_approval_text: listToText(snapshot.approval.require_approval),
				auto_approve_text: listToText(snapshot.approval.auto_approve)
			},
			observability: {
				enabled: snapshot.observability.enabled,
				token_track: snapshot.observability.token_track,
				audit_log: { enabled: snapshot.observability.audit_log.enabled }
			},
			sandbox: {
				enabled: snapshot.sandbox.enabled,
				image: snapshot.sandbox.image,
				network_mode: snapshot.sandbox.network_mode,
				memory_limit: snapshot.sandbox.memory_limit,
				cpu_limit: snapshot.sandbox.cpu_limit,
				work_dir: snapshot.sandbox.work_dir
			}
		};
	}

	function buildConfigPatch(): Record<string, unknown> {
		return pruneUndefined({
			server: { ...configForm.server },
			llm: {
				provider: configForm.llm.provider,
				base_url: configForm.llm.base_url,
				api_key: secretForPatch(configForm.llm.api_key),
				model: configForm.llm.model,
				cheap_model: configForm.llm.cheap_model,
				cheap_base_url: configForm.llm.cheap_base_url,
				cheap_api_key: secretForPatch(configForm.llm.cheap_api_key)
			},
			agent: {
				max_tool_calls: configForm.agent.max_tool_calls,
				system_prompt: configForm.agent.system_prompt,
				loop_detection: configForm.agent.loop_detection,
				compression: { ...configForm.agent.compression },
				loop_detector: { ...configForm.agent.loop_detector }
			},
			scheduler: { ...configForm.scheduler },
			heartbeat: { ...configForm.heartbeat },
			log: { ...configForm.log },
			session: { ...configForm.session },
			hooks: { ...configForm.hooks },
			subagent: { ...configForm.subagent },
			tools: {
				terminal: { blocked_cmds: textToList(configForm.tools.terminal.blocked_cmds_text) },
				web_search: {
					provider: configForm.tools.web_search.provider,
					api_key: secretForPatch(configForm.tools.web_search.api_key),
					base_url: configForm.tools.web_search.base_url
				}
			},
			approval: {
				enabled: configForm.approval.enabled,
				require_approval: textToList(configForm.approval.require_approval_text),
				auto_approve: textToList(configForm.approval.auto_approve_text)
			},
			channels: {
				feishu: {
					enabled: configForm.channels.feishu.enabled,
					app_id: configForm.channels.feishu.app_id,
					app_secret: secretForPatch(configForm.channels.feishu.app_secret),
					verification_token: secretForPatch(configForm.channels.feishu.verification_token),
					encrypt_key: secretForPatch(configForm.channels.feishu.encrypt_key),
					streaming: configForm.channels.feishu.streaming,
					bot_open_id: configForm.channels.feishu.bot_open_id
				},
				telegram: {
					enabled: configForm.channels.telegram.enabled,
					bot_token: secretForPatch(configForm.channels.telegram.bot_token),
					admin_ids: textToIntList(configForm.channels.telegram.admin_ids_text)
				}
			},
			observability: {
				enabled: configForm.observability.enabled,
				token_track: configForm.observability.token_track,
				audit_log: { enabled: configForm.observability.audit_log.enabled }
			},
			sandbox: { ...configForm.sandbox }
		}) as Record<string, unknown>;
	}
</script>

<svelte:head>
	<title>配置 - tietiezhi 控制台</title>
</svelte:head>

<section class="app-page">
	<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<div>
			<p class="text-sm text-slate-500 dark:text-slate-400">
				{config?.runtime.config_path || '~/.tietiezhi/config.yaml'}
			</p>
			<h2 class="mt-1 text-xl font-semibold">YAML 配置</h2>
		</div>
		<div class="flex flex-wrap gap-2">
			<button type="button" class="secondary-button" onclick={() => void loadConfig()} disabled={loading}>
				刷新
			</button>
			<button type="button" class="primary-button" onclick={() => void saveConfig()} disabled={saving}>
				{#if saving}
					<LoaderCircle class="size-4 animate-spin" />
				{:else}
					<Save class="size-4" />
				{/if}
				保存配置
			</button>
		</div>
	</div>

	<div class="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-200">
		所有运行时 path 固定派生自 ~/.tietiezhi，密钥字段保留掩码时不会覆盖原值。部分配置保存后需要重启服务生效。
	</div>

	{#if error}
		<div class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
			{error}
		</div>
	{/if}
	{#if notice}
		<div class="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
			<CheckCircle2 class="size-4" />
			<span>{notice}</span>
		</div>
	{/if}

	<div class="flex flex-wrap gap-2">
		{#each configPanels as panel}
			<button
				type="button"
				class={`rounded-md px-3 py-2 text-sm font-medium transition ${
					configPanel === panel.id
						? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
						: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
				}`}
				onclick={() => selectPanel(panel.id)}
			>
				{panel.label}
			</button>
		{/each}
	</div>

	<div class="panel p-5">
		{#if configPanel === 'llm'}
			<div class="mb-5 flex items-center gap-2">
				<KeyRound class="size-5 text-cyan-600 dark:text-cyan-400" />
				<h2 class="text-lg font-semibold">模型与密钥</h2>
			</div>
			<div class="grid gap-4 lg:grid-cols-2">
				<label class="space-y-1">
					<span class="field-label">Provider</span>
					<input class="input-control" bind:value={configForm.llm.provider} />
				</label>
				<label class="space-y-1">
					<span class="field-label">Base URL</span>
					<input class="input-control" bind:value={configForm.llm.base_url} />
				</label>
				<label class="space-y-1">
					<span class="field-label">API Key</span>
					<input class="input-control" type="password" bind:value={configForm.llm.api_key} />
				</label>
				<label class="space-y-1">
					<span class="field-label">Model</span>
					<input class="input-control" bind:value={configForm.llm.model} />
				</label>
				<label class="space-y-1">
					<span class="field-label">Cheap Model</span>
					<input class="input-control" bind:value={configForm.llm.cheap_model} />
				</label>
				<label class="space-y-1">
					<span class="field-label">Cheap Base URL</span>
					<input class="input-control" bind:value={configForm.llm.cheap_base_url} />
				</label>
				<label class="space-y-1">
					<span class="field-label">Cheap API Key</span>
					<input class="input-control" type="password" bind:value={configForm.llm.cheap_api_key} />
				</label>
			</div>
			<div class="panel-soft mt-5">
				<p class="mb-2 text-sm font-medium">模型能力</p>
				<div class="flex flex-wrap gap-2">
					{#each configForm.llm.model_capabilities as item}
						<span class="badge bg-white dark:bg-slate-900">
							{item.model}: {item.capabilities.join(', ') || '-'}
						</span>
					{/each}
				</div>
			</div>
		{:else if configPanel === 'agent'}
			<div class="mb-5 flex items-center gap-2">
				<Bot class="size-5 text-violet-600 dark:text-violet-400" />
				<h2 class="text-lg font-semibold">Agent 行为</h2>
			</div>
			<div class="grid gap-4 lg:grid-cols-2">
				<label class="space-y-1">
					<span class="field-label">最大工具调用</span>
					<input class="input-control" type="number" min="1" bind:value={configForm.agent.max_tool_calls} />
				</label>
				<label class="flex items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
					<input type="checkbox" class="size-4 rounded border-slate-300" bind:checked={configForm.agent.loop_detection} />
					<span class="text-sm font-medium">循环检测</span>
				</label>
				<label class="space-y-1 lg:col-span-2">
					<span class="field-label">System Prompt</span>
					<textarea class="textarea-control" rows="5" bind:value={configForm.agent.system_prompt}></textarea>
				</label>
			</div>
			<div class="mt-6 grid gap-4 lg:grid-cols-2">
				<label class="flex items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
					<input type="checkbox" class="size-4 rounded border-slate-300" bind:checked={configForm.agent.compression.enabled} />
					<span class="text-sm font-medium">上下文压缩</span>
				</label>
				<label class="space-y-1">
					<span class="field-label">压缩阈值字符数</span>
					<input class="input-control" type="number" min="1" bind:value={configForm.agent.compression.max_chars} />
				</label>
				<label class="space-y-1">
					<span class="field-label">保留最近消息数</span>
					<input class="input-control" type="number" min="1" bind:value={configForm.agent.compression.keep_recent} />
				</label>
				<label class="space-y-1 lg:col-span-2">
					<span class="field-label">总结提示词</span>
					<textarea class="textarea-control" rows="3" bind:value={configForm.agent.compression.summary_prompt}></textarea>
				</label>
			</div>
			<div class="mt-6 grid gap-4 lg:grid-cols-5">
				<label class="space-y-1">
					<span class="field-label">重复阈值</span>
					<input class="input-control" type="number" bind:value={configForm.agent.loop_detector.generic_repeat_threshold} />
				</label>
				<label class="space-y-1">
					<span class="field-label">相似度</span>
					<input class="input-control" type="number" step="0.01" bind:value={configForm.agent.loop_detector.generic_repeat_similarity} />
				</label>
				<label class="space-y-1">
					<span class="field-label">无进展阈值</span>
					<input class="input-control" type="number" bind:value={configForm.agent.loop_detector.no_progress_threshold} />
				</label>
				<label class="space-y-1">
					<span class="field-label">弹跳窗口</span>
					<input class="input-control" type="number" bind:value={configForm.agent.loop_detector.ping_pong_window} />
				</label>
				<label class="space-y-1">
					<span class="field-label">熔断上限</span>
					<input class="input-control" type="number" bind:value={configForm.agent.loop_detector.global_circuit_breaker_limit} />
				</label>
			</div>
		{:else if configPanel === 'runtime'}
			<div class="mb-5 flex items-center gap-2">
				<Server class="size-5 text-indigo-600 dark:text-indigo-400" />
				<h2 class="text-lg font-semibold">服务与运行</h2>
			</div>
			<div class="grid gap-4 lg:grid-cols-3">
				<label class="space-y-1">
					<span class="field-label">Host</span>
					<input class="input-control" bind:value={configForm.server.host} />
				</label>
				<label class="space-y-1">
					<span class="field-label">Port</span>
					<input class="input-control" type="number" bind:value={configForm.server.port} />
				</label>
				<label class="space-y-1">
					<span class="field-label">日志级别</span>
					<select class="input-control" bind:value={configForm.log.level}>
						<option value="debug">debug</option>
						<option value="info">info</option>
						<option value="warn">warn</option>
						<option value="error">error</option>
					</select>
				</label>
				<label class="space-y-1">
					<span class="field-label">日志格式</span>
					<select class="input-control" bind:value={configForm.log.format}>
						<option value="text">text</option>
						<option value="json">json</option>
					</select>
				</label>
				<label class="flex items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
					<input type="checkbox" class="size-4 rounded border-slate-300" bind:checked={configForm.scheduler.enabled} />
					<span class="text-sm font-medium">定时任务</span>
				</label>
				<label class="space-y-1">
					<span class="field-label">任务超时秒数</span>
					<input class="input-control" type="number" bind:value={configForm.scheduler.exec_timeout} />
				</label>
				<label class="flex items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
					<input type="checkbox" class="size-4 rounded border-slate-300" bind:checked={configForm.heartbeat.enabled} />
					<span class="text-sm font-medium">心跳</span>
				</label>
				<label class="space-y-1">
					<span class="field-label">心跳间隔分钟</span>
					<input class="input-control" type="number" bind:value={configForm.heartbeat.interval} />
				</label>
				<label class="space-y-1">
					<span class="field-label">默认 Chat ID</span>
					<input class="input-control" bind:value={configForm.heartbeat.chat_id} />
				</label>
				<label class="space-y-1">
					<span class="field-label">会话历史轮数</span>
					<input class="input-control" type="number" bind:value={configForm.session.max_history_turns} />
				</label>
				<label class="space-y-1">
					<span class="field-label">自动保存秒数</span>
					<input class="input-control" type="number" bind:value={configForm.session.auto_save_seconds} />
				</label>
				<label class="flex items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
					<input type="checkbox" class="size-4 rounded border-slate-300" bind:checked={configForm.subagent.enabled} />
					<span class="text-sm font-medium">子代理</span>
				</label>
				<label class="space-y-1">
					<span class="field-label">子代理超时秒数</span>
					<input class="input-control" type="number" bind:value={configForm.subagent.timeout} />
				</label>
				<label class="flex items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
					<input type="checkbox" class="size-4 rounded border-slate-300" bind:checked={configForm.hooks.enabled} />
					<span class="text-sm font-medium">Hooks</span>
				</label>
			</div>
		{:else if configPanel === 'tools'}
			<div class="mb-5 flex items-center gap-2">
				<TerminalSquare class="size-5 text-slate-700 dark:text-slate-300" />
				<h2 class="text-lg font-semibold">工具与审批</h2>
			</div>
			<div class="grid gap-4 lg:grid-cols-2">
				<label class="space-y-1">
					<span class="field-label">阻止命令</span>
					<textarea class="textarea-control" rows="5" bind:value={configForm.tools.terminal.blocked_cmds_text}></textarea>
				</label>
				<div class="grid gap-4">
					<label class="space-y-1">
						<span class="field-label">Web Search Provider</span>
						<input class="input-control" bind:value={configForm.tools.web_search.provider} />
					</label>
					<label class="space-y-1">
						<span class="field-label">Web Search API Key</span>
						<input class="input-control" type="password" bind:value={configForm.tools.web_search.api_key} />
					</label>
					<label class="space-y-1">
						<span class="field-label">Web Search Base URL</span>
						<input class="input-control" bind:value={configForm.tools.web_search.base_url} />
					</label>
				</div>
				<label class="flex items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
					<input type="checkbox" class="size-4 rounded border-slate-300" bind:checked={configForm.approval.enabled} />
					<span class="text-sm font-medium">审批流</span>
				</label>
				<label class="space-y-1">
					<span class="field-label">需要审批</span>
					<textarea class="textarea-control" rows="4" bind:value={configForm.approval.require_approval_text}></textarea>
				</label>
				<label class="space-y-1 lg:col-span-2">
					<span class="field-label">自动放行</span>
					<textarea class="textarea-control" rows="3" bind:value={configForm.approval.auto_approve_text}></textarea>
				</label>
			</div>
		{:else if configPanel === 'channels'}
			<div class="mb-5 flex items-center gap-2">
				<PlugZap class="size-5 text-teal-600 dark:text-teal-400" />
				<h2 class="text-lg font-semibold">渠道接入</h2>
			</div>
			<div class="grid gap-5 xl:grid-cols-2">
				<div class="rounded-md border border-slate-200 p-4 dark:border-slate-800">
					<label class="mb-4 flex items-center gap-3">
						<input type="checkbox" class="size-4 rounded border-slate-300" bind:checked={configForm.channels.feishu.enabled} />
						<span class="text-sm font-semibold">飞书</span>
					</label>
					<div class="grid gap-3">
						<label class="space-y-1">
							<span class="field-label">App ID</span>
							<input class="input-control" bind:value={configForm.channels.feishu.app_id} />
						</label>
						<label class="space-y-1">
							<span class="field-label">App Secret</span>
							<input class="input-control" type="password" bind:value={configForm.channels.feishu.app_secret} />
						</label>
						<label class="space-y-1">
							<span class="field-label">Verification Token</span>
							<input class="input-control" type="password" bind:value={configForm.channels.feishu.verification_token} />
						</label>
						<label class="space-y-1">
							<span class="field-label">Encrypt Key</span>
							<input class="input-control" type="password" bind:value={configForm.channels.feishu.encrypt_key} />
						</label>
						<label class="space-y-1">
							<span class="field-label">Bot Open ID</span>
							<input class="input-control" bind:value={configForm.channels.feishu.bot_open_id} />
						</label>
						<label class="flex items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
							<input type="checkbox" class="size-4 rounded border-slate-300" bind:checked={configForm.channels.feishu.streaming} />
							<span class="text-sm font-medium">流式回复</span>
						</label>
					</div>
				</div>
				<div class="rounded-md border border-slate-200 p-4 dark:border-slate-800">
					<label class="mb-4 flex items-center gap-3">
						<input type="checkbox" class="size-4 rounded border-slate-300" bind:checked={configForm.channels.telegram.enabled} />
						<span class="text-sm font-semibold">Telegram</span>
					</label>
					<div class="grid gap-3">
						<label class="space-y-1">
							<span class="field-label">Bot Token</span>
							<input class="input-control" type="password" bind:value={configForm.channels.telegram.bot_token} />
						</label>
						<label class="space-y-1">
							<span class="field-label">Admin IDs</span>
							<textarea class="textarea-control" rows="4" bind:value={configForm.channels.telegram.admin_ids_text}></textarea>
						</label>
					</div>
				</div>
			</div>
		{:else if configPanel === 'sandbox'}
			<div class="mb-5 flex items-center gap-2">
				<ShieldCheck class="size-5 text-emerald-600 dark:text-emerald-400" />
				<h2 class="text-lg font-semibold">沙箱与可观测性</h2>
			</div>
			<div class="grid gap-4 lg:grid-cols-3">
				<label class="flex items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
					<input type="checkbox" class="size-4 rounded border-slate-300" bind:checked={configForm.sandbox.enabled} />
					<span class="text-sm font-medium">Docker 沙箱</span>
				</label>
				<label class="space-y-1">
					<span class="field-label">镜像</span>
					<input class="input-control" bind:value={configForm.sandbox.image} />
				</label>
				<label class="space-y-1">
					<span class="field-label">网络模式</span>
					<select class="input-control" bind:value={configForm.sandbox.network_mode}>
						<option value="none">none</option>
						<option value="bridge">bridge</option>
					</select>
				</label>
				<label class="space-y-1">
					<span class="field-label">内存限制</span>
					<input class="input-control" bind:value={configForm.sandbox.memory_limit} />
				</label>
				<label class="space-y-1">
					<span class="field-label">CPU 限制</span>
					<input class="input-control" type="number" step="0.1" bind:value={configForm.sandbox.cpu_limit} />
				</label>
				<label class="space-y-1">
					<span class="field-label">容器工作目录</span>
					<input class="input-control" bind:value={configForm.sandbox.work_dir} />
				</label>
				<label class="flex items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
					<input type="checkbox" class="size-4 rounded border-slate-300" bind:checked={configForm.observability.enabled} />
					<span class="text-sm font-medium">可观测性</span>
				</label>
				<label class="flex items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
					<input type="checkbox" class="size-4 rounded border-slate-300" bind:checked={configForm.observability.audit_log.enabled} />
					<span class="text-sm font-medium">审计日志</span>
				</label>
				<label class="flex items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
					<input type="checkbox" class="size-4 rounded border-slate-300" bind:checked={configForm.observability.token_track} />
					<span class="text-sm font-medium">Token 追踪</span>
				</label>
			</div>
			<div class="panel-soft mt-5">
				<p class="mb-2 text-sm font-medium">挂载卷</p>
				<div class="space-y-2">
					{#each config?.sandbox.volumes ?? [] as volume}
						<div class="rounded-md bg-white px-3 py-2 text-xs text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-300">
							<span class="font-mono">{volume.host_path}</span>
							<span class="px-2">→</span>
							<span class="font-mono">{volume.container_path}</span>
							<span class="ml-2 text-slate-400">{volume.read_only ? '只读' : '读写'}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</section>
