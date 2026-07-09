export type View =
	| 'overview'
	| 'config'
	| 'cron'
	| 'workspace'
	| 'sessions'
	| 'skills'
	| 'mcp'
	| 'hooks'
	| 'agents';

export type ConfigPanel = 'llm' | 'agent' | 'runtime' | 'tools' | 'channels' | 'sandbox';

export type StatusResponse = {
	timestamp: number;
	model: string;
	features: Record<string, boolean>;
	counts: Record<string, number>;
};

export type ConfigSnapshot = {
	runtime: {
		config_path: string;
		app_dir: string;
		workspace: string;
		skills_path: string;
		scheduler_path: string;
		sessions_path: string;
		subagents_path: string;
		audit_log_path: string;
		allowed_dirs: string[];
	};
	server: {
		host: string;
		port: number;
	};
	llm: {
		provider: string;
		base_url: string;
		api_key: string;
		model: string;
		cheap_model: string;
		cheap_base_url: string;
		cheap_api_key: string;
		model_capabilities: Array<{ model: string; capabilities: string[] }>;
	};
	agent: {
		max_tool_calls: number;
		system_prompt: string;
		loop_detection: boolean;
		compression: {
			enabled: boolean;
			max_chars: number;
			keep_recent: number;
			summary_prompt: string;
		};
		loop_detector: {
			generic_repeat_threshold: number;
			generic_repeat_similarity: number;
			no_progress_threshold: number;
			ping_pong_window: number;
			global_circuit_breaker_limit: number;
		};
	};
	channels: {
		feishu: {
			enabled: boolean;
			app_id: string;
			app_secret: string;
			verification_token: string;
			encrypt_key: string;
			streaming: boolean;
			bot_open_id: string;
		};
		telegram: {
			enabled: boolean;
			bot_token: string;
			admin_ids: number[];
		};
	};
	memory: {
		type: string;
		path: string;
	};
	scheduler: {
		enabled: boolean;
		exec_timeout: number;
	};
	heartbeat: {
		enabled: boolean;
		interval: number;
		chat_id: string;
	};
	log: {
		level: string;
		format: string;
	};
	session: {
		max_history_turns: number;
		auto_save_seconds: number;
	};
	hooks: {
		enabled: boolean;
		rules: unknown[];
	};
	subagent: {
		enabled: boolean;
		timeout: number;
	};
	tools: {
		terminal: {
			blocked_cmds: string[];
		};
		web_search: {
			provider: string;
			api_key: string;
			base_url: string;
		};
	};
	approval: {
		enabled: boolean;
		require_approval: string[];
		auto_approve: string[];
	};
	observability: {
		enabled: boolean;
		token_track: boolean;
		audit_log: {
			enabled: boolean;
			path: string;
		};
	};
	sandbox: {
		enabled: boolean;
		image: string;
		network_mode: string;
		memory_limit: string;
		cpu_limit: number;
		work_dir: string;
		volumes: Array<{ host_path: string; container_path: string; read_only: boolean }>;
	};
};

export type ConfigForm = {
	server: ConfigSnapshot['server'];
	llm: ConfigSnapshot['llm'];
	agent: ConfigSnapshot['agent'];
	channels: {
		feishu: ConfigSnapshot['channels']['feishu'];
		telegram: ConfigSnapshot['channels']['telegram'] & { admin_ids_text: string };
	};
	scheduler: ConfigSnapshot['scheduler'];
	heartbeat: ConfigSnapshot['heartbeat'];
	log: ConfigSnapshot['log'];
	session: ConfigSnapshot['session'];
	hooks: { enabled: boolean };
	subagent: ConfigSnapshot['subagent'];
	tools: {
		terminal: { blocked_cmds_text: string };
		web_search: ConfigSnapshot['tools']['web_search'];
	};
	approval: {
		enabled: boolean;
		require_approval_text: string;
		auto_approve_text: string;
	};
	observability: {
		enabled: boolean;
		token_track: boolean;
		audit_log: { enabled: boolean };
	};
	sandbox: Omit<ConfigSnapshot['sandbox'], 'volumes'>;
};

export type SkillItem = {
	name: string;
	description: string;
	dir_path: string;
	mcp_servers: string[];
	has_mcp: boolean;
	allowed_tools: string[];
};

export type MCPServer = {
	name: string;
	tools: Array<{ name: string; description: string }>;
};

export type AgentItem = {
	spawn_id: string;
	session_key: string;
	status: string;
	label: string;
	started_at: string;
	ended_at?: string | null;
	error: string;
};

export type HookRule = {
	index: number;
	event: string;
	matcher: string;
	type: string;
	command: string;
	script: string;
	timeout: number;
};

export type CronJob = {
	id: string;
	name: string;
	message: string;
	schedule: {
		kind: string;
		at?: string;
		every_ms?: number;
		expr?: string;
		tz?: string;
	};
	enabled: boolean;
	delete_after_run: boolean;
	created_at: string;
	last_run_at?: string | null;
	next_run_at?: string | null;
	run_count: number;
	mode: string;
};

export type WorkspaceFile = {
	path: string;
	is_dir: boolean;
	size: number;
	modified: string;
};

export type SessionItem = {
	key: string;
	messages: number;
};

export type ConfigUpdateResponse = {
	success: boolean;
	message: string;
	config: ConfigSnapshot;
};
