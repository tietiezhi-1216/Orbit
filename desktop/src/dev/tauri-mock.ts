//! Dev-only stub of the Tauri IPC bridge.
//!
//! Lets the UI be driven in a plain browser — `pnpm dev:mock`, then open
//! http://localhost:1421/?mock=1 — with no Rust side running, which is how the
//! UI gets checked without disturbing the real `pnpm tauri dev` on port 1420.
//!
//! Never reaches a release build: the entry points import it behind
//! `import.meta.env.DEV`, so the dynamic import is dead code in production.

import type { ModelInfo } from "@/lib/api";

const TERLN_MODELS: ModelInfo[] = [
  { id: "agnes-1.5-flash", kind: "chat" },
  { id: "agnes-2.0-flash", kind: "chat" },
  { id: "agnes-image-2.1-flash", kind: "image" },
  { id: "agnes-video-v2.0", kind: "video" },
  { id: "claude-opus-4-6-thinking", kind: "chat" },
  { id: "claude-sonnet-4-6", kind: "chat" },
  { id: "codex-auto-review", kind: "chat" },
  { id: "deepseek-v4-flash", kind: "chat" },
  { id: "gemini-2.5-flash", kind: "chat" },
  { id: "gemini-2.5-flash-image", kind: "image" },
  { id: "gemini-2.5-pro", kind: "chat" },
  { id: "gemini-3-flash", kind: "chat" },
  { id: "gemini-3.1-pro-high", kind: "chat" },
  { id: "gpt-5.4", kind: "chat" },
  { id: "gpt-5.4-mini", kind: "chat" },
  { id: "gpt-5.5", kind: "chat" },
  { id: "gpt-5.6-luna", kind: "chat" },
  { id: "gpt-image-2", kind: "image" },
  { id: "gpt-oss-120b-medium", kind: "chat" },
  { id: "sensenova-u1-fast", kind: "chat" },
];

const MIMO_MODELS: ModelInfo[] = [
  { id: "mimo-v2.5-pro", kind: "chat" },
  { id: "mimo-v2.5-asr", kind: "asr" },
  { id: "mimo-v2.5-tts", kind: "tts" },
];

const DEFAULT_PROMPT = `# 角色
你是语音输入整理器。先理解用户意图，再贴着原句做语法整理与轻度润色。

# 规则
- 去掉口癖与重复，理顺语法与语序；不扩写、不臆造用户没说的事实。
- 中英混输、专有名词、代码 / 命令 / 路径 / URL 原样保留。

# 输出
直接输出润色后的正文。`;

interface MockChannel {
  id: number;
}

type Handler = (args: Record<string, unknown>) => unknown;

/** Install the stub on `window.__TAURI_INTERNALS__`. Idempotent. */
export function installTauriMock(): void {
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
  if (w.__TAURI_INTERNALS__) return;

  const callbacks = new Map<number, (payload: unknown) => void>();
  let nextCallbackId = 1;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const state = {
    settings: {
      providers: [
        {
          id: "p-terln",
          name: "terln gateway",
          type: "openai",
          baseUrl: "https://api.terln.com",
          models: TERLN_MODELS,
        },
        {
          id: "p-mimo",
          name: "mimo",
          type: "mimo",
          baseUrl: "https://api.xiaomimimo.com/v1",
          models: MIMO_MODELS,
        },
      ],
      chatProviderId: "p-terln",
      chatModel: "gpt-5.5",
      asrProviderId: "p-mimo",
      asrModel: "mimo-v2.5-asr",
      polishProviderId: "p-terln",
      polishModel: "gemini-2.5-flash",
      polishEnabled: true,
      outputLanguage: "auto",
      dictationHotkey: "Alt+Space",
      polishPrompt: "",
      systemPrompt: "",
      permissionMode: "auto",
      skillsDisabled: [] as string[],
      mcpServers: [
        {
          id: "mcp-fs",
          name: "filesystem",
          enabled: true,
          transport: {
            kind: "stdio",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem"],
            env: {},
          },
        },
      ],
    },
    agents: [
      {
        id: "agent-coder",
        name: "编码助手",
        systemPrompt: "你是一个专注写代码的助手。",
        model: "",
        modelProviderId: "",
        skills: [],
        mcpServers: [],
        tools: [],
        permissionMode: "auto",
      },
    ] as Record<string, unknown>[],
    skills: new Map<string, { description: string; body: string; enabled: boolean }>([
      [
        "pdf-tools",
        { description: "处理 PDF：拆分、合并、抽取文本", body: "# PDF 技能\n\n使用……", enabled: true },
      ],
    ]),
    keys: { "p-terln": "sk-REDACTED", "p-mimo": "sk-REDACTED" } as
      Record<string, string>,
    conversations: new Map<string, Record<string, unknown>>(),
    cancelled: new Set<number>(),
  };

  const push = (channel: MockChannel, index: number, payload: Record<string, unknown>) =>
    callbacks.get(channel.id)?.({ index, ...payload });

  /** Stream `reply` character by character over a tauri Channel. */
  const stream = async (requestId: number, channel: MockChannel, reply: string) => {
    let i = 0;
    for (const ch of reply) {
      if (state.cancelled.has(requestId)) break;
      push(channel, i++, { message: { type: "delta", content: ch } });
      await sleep(12);
    }
    push(channel, i++, {
      message: { type: "done", cancelled: state.cancelled.has(requestId) },
    });
    push(channel, i, { end: true });
    state.cancelled.delete(requestId);
  };

  /** Scripted agent turn: text → tool call → permission ask → result → text. */
  const streamAgentDemo = async (requestId: number, channel: MockChannel) => {
    let i = 0;
    const emit = (message: Record<string, unknown>) => push(channel, i++, { message });
    for (const ch of "我来读取一下文件。") {
      emit({ type: "delta", content: ch });
      await sleep(20);
    }
    emit({ type: "toolCallStart", id: "call_1", name: "read_file", args: { path: "README.md" } });
    await sleep(600);
    emit({ type: "toolResult", id: "call_1", output: "    1\t# 铁铁汁\n    2\t演示内容", isError: false });
    emit({
      type: "permissionRequest",
      id: "perm_1",
      tool: "bash",
      description: "执行命令：ls -la",
      args: { command: "ls -la" },
    });
    // Wait for permission_respond (or cancel).
    pendingPermission = null;
    for (let t = 0; t < 600; t++) {
      if (pendingPermission != null || state.cancelled.has(requestId)) break;
      await sleep(100);
    }
    const decision = pendingPermission ?? "deny";
    emit({ type: "toolCallStart", id: "call_2", name: "bash", args: { command: "ls -la" } });
    await sleep(400);
    emit(
      decision === "deny"
        ? { type: "toolResult", id: "call_2", output: "用户拒绝了此操作", isError: true }
        : { type: "toolResult", id: "call_2", output: "total 8\ndrwxr-xr-x  demo", isError: false },
    );
    for (const ch of "已完成：文件读取成功" + (decision === "deny" ? "，命令被拒绝。" : "，命令执行完毕。")) {
      emit({ type: "delta", content: ch });
      await sleep(20);
    }
    emit({ type: "done", cancelled: state.cancelled.has(requestId) });
    push(channel, i, { end: true });
    state.cancelled.delete(requestId);
  };
  let pendingPermission: string | null = null;

  const handlers: Record<string, Handler> = {
    // --- Agents / skills / MCP / workspace ---
    list_agents: () => structuredClone(state.agents),
    upsert_agent: (a) => {
      const agent = structuredClone(a.agent as { id: string });
      const i = state.agents.findIndex((x) => x.id === agent.id);
      if (i >= 0) state.agents[i] = agent;
      else state.agents.push(agent);
    },
    delete_agent: (a) => {
      state.agents = state.agents.filter((x) => x.id !== a.id);
    },
    list_builtin_tools: () => [
      "read_file",
      "write_file",
      "edit_file",
      "list_dir",
      "glob",
      "grep",
      "bash",
      "fetch",
      "skill",
    ],
    list_skills: () =>
      [...state.skills.entries()].map(([name, s]) => ({
        name,
        description: s.description,
        enabled: s.enabled,
      })),
    read_skill: (a) => {
      const s = state.skills.get(a.name as string);
      if (!s) throw `技能 ${String(a.name)} 不存在`;
      return `---\nname: ${String(a.name)}\ndescription: ${s.description}\n---\n\n${s.body}`;
    },
    upsert_skill: (a) => {
      const prev = state.skills.get(a.name as string);
      state.skills.set(a.name as string, {
        description: a.description as string,
        body: a.body as string,
        enabled: prev?.enabled ?? true,
      });
    },
    delete_skill: (a) => state.skills.delete(a.name as string),
    set_skill_enabled: (a) => {
      const s = state.skills.get(a.name as string);
      if (s) s.enabled = a.enabled as boolean;
    },
    import_skill: () => ({ name: "imported-skill", description: "导入的技能", enabled: true }),
    mcp_server_status: () =>
      state.settings.mcpServers.map((s) => ({
        id: s.id,
        state: s.enabled ? "running" : "stopped",
        toolCount: 0,
        error: "",
      })),
    mcp_restart_server: () => {},
    mcp_stop_server: () => {},
    pick_workspace_dir: () => "/Users/demo/Projects/example",
    permission_respond: (a) => {
      pendingPermission = a.decision as string;
    },
    default_system_prompt: () => "你是铁铁汁（Tietiezhi），一个运行在用户桌面上的智能体助手。……",

    load_settings: () => structuredClone(state.settings),
    save_settings: (a) => {
      state.settings = structuredClone(a.settings as typeof state.settings);
    },

    list_providers: () =>
      state.settings.providers.map((p) => ({
        ...structuredClone(p),
        hasKey: Boolean(state.keys[p.id]),
      })),
    provider_key: (a) => state.keys[a.id as string] ?? null,
    upsert_provider: (a) => {
      const provider = structuredClone(a.provider as { id: string });
      const i = state.settings.providers.findIndex((p) => p.id === provider.id);
      if (i >= 0) state.settings.providers[i] = provider as never;
      else state.settings.providers.push(provider as never);
      if (a.apiKey) state.keys[provider.id] = a.apiKey as string;
    },
    delete_provider: (a) => {
      state.settings.providers = state.settings.providers.filter((p) => p.id !== a.id);
      delete state.keys[a.id as string];
    },
    fetch_provider_models: (a) => (a.kind === "mimo" ? MIMO_MODELS : TERLN_MODELS),

    chat_stream: (a) => {
      const messages = a.messages as { content: string }[];
      const last = messages[messages.length - 1]?.content ?? "";
      // "工具" in the prompt exercises the agent-loop events (tool cards +
      // permission prompt) without a real model.
      if (last.includes("工具")) {
        return streamAgentDemo(a.requestId as number, a.onEvent as MockChannel);
      }
      // Markdown-shaped so the renderer (headings / lists / tables / fenced
      // code) can be exercised without a real model.
      const reply = `收到：**${last}**

## 小标题
- 列表项一，带 \`行内代码\`
- 第二项，含 [链接](https://tietiezhi.xyz)

\`\`\`java
public class Hello {
    public static void main(String[] args) {
        // 打印问候语
        System.out.println("你好，世界");
    }
}
\`\`\`

| 模型 | 类型 |
| --- | --- |
| gpt-5.5 | 对话 |
| mimo-v2.5-asr | 语音识别 |

> 引用：以上由 mock ${a.model} 生成。`;
      return stream(a.requestId as number, a.onEvent as MockChannel, reply);
    },
    chat_cancel: (a) => state.cancelled.add(a.requestId as number),
    polish_stream: (a) =>
      stream(a.requestId as number, a.onEvent as MockChannel, `（润色）${a.transcript}`),

    transcribe: () => "这是一段模拟的语音识别结果。",
    deliver_text: () => ({ inserted: false, needsAccessibility: false }),
    accessibility_trusted: () => true,
    default_polish_prompt: () => DEFAULT_PROMPT,
    dictation_hotkey: () => state.settings.dictationHotkey || "Alt+Space",
    set_dictation_hotkey: (a) => {
      state.settings.dictationHotkey = a.shortcut as string;
    },
    dictation_reset: () => {},
    dictation_toggle: () => {},

    hide_capsule: () => {},
    show_capsule: () => {},
    capsule_set_height: () => {},

    list_conversations: () =>
      [...state.conversations.values()]
        .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }))
        .sort((a, b) => (b.updatedAt as number) - (a.updatedAt as number)),
    load_conversation: (a) => structuredClone(state.conversations.get(a.id as string)),
    save_conversation: (a) => {
      const conv = structuredClone(a.conversation as { id: string });
      const updatedAt = Date.now();
      state.conversations.set(conv.id, { ...conv, updatedAt });
      return updatedAt;
    },
    delete_conversation: (a) => state.conversations.delete(a.id as string),

    "plugin:app|version": () => "0.0.0-mock",
    "plugin:event|listen": () => 0,
    "plugin:event|unlisten": () => {},
  };

  w.__TAURI_INTERNALS__ = {
    transformCallback(callback: (payload: unknown) => void) {
      const id = nextCallbackId++;
      callbacks.set(id, callback);
      return id;
    },
    unregisterCallback(id: number) {
      callbacks.delete(id);
    },
    async invoke(cmd: string, args?: Record<string, unknown>) {
      await sleep(20);
      const handler = handlers[cmd];
      if (!handler) throw `mock: 未实现的命令 ${cmd}`;
      return handler(args ?? {});
    },
    metadata: {},
  };

  console.info("[dev] Tauri IPC mock 已启用（?mock）");
}
