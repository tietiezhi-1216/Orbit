import { create } from "zustand";
import {
  chatCancel,
  chatStream,
  deleteConversation,
  errorMessage,
  listConversations,
  loadConversation,
  permissionRespond,
  saveConversation,
} from "@/lib/api";
import type {
  ChatRole,
  ConversationMeta,
  PermissionDecision,
  StoredMessage,
} from "@/lib/api";

interface ItemBase {
  id: number;
  createdAt: number;
}

/** One transcript entry: a text message, a tool call, or a permission ask. */
export type ChatItem =
  | (ItemBase & {
      kind: "message";
      role: ChatRole;
      content: string;
      error?: boolean;
    })
  | (ItemBase & {
      kind: "toolCall";
      callId: string;
      name: string;
      args: unknown;
      status: "running" | "success" | "error";
      output?: string;
    })
  | (ItemBase & {
      kind: "permission";
      requestId: string;
      tool: string;
      description: string;
      args: unknown;
      decision?: PermissionDecision;
    });

interface ChatState {
  /** Sidebar list, newest first. */
  conversations: ConversationMeta[];
  /** Current conversation id; null = a fresh, not-yet-persisted chat. */
  activeId: string | null;
  /** Agent profile bound to the current conversation ("" = default). */
  activeAgentId: string;
  /** Workspace folder of the current conversation ("" = virtual). */
  workspace: string;
  /** Messages of the current conversation. */
  items: ChatItem[];
  streaming: boolean;
  requestId: number | null;
  init: () => Promise<void>;
  newConversation: () => void;
  openConversation: (id: string) => Promise<void>;
  removeConversation: (id: string) => Promise<void>;
  send: (providerId: string, model: string, text: string) => Promise<void>;
  setAgent: (agentId: string) => void;
  setWorkspace: (workspace: string) => void;
  respondPermission: (requestId: string, decision: PermissionDecision) => void;
  /** Fork into a new conversation holding everything before `itemId`. */
  branchFrom: (itemId: number) => void;
  /** Fork before `itemId`, then resend it with edited text. */
  editAndResend: (
    itemId: number,
    text: string,
    providerId: string,
    model: string,
  ) => Promise<void>;
  stop: () => void;
}

let nextId = 1;

const toItems = (messages: StoredMessage[]): ChatItem[] =>
  messages.map((m): ChatItem => {
    const base = { id: nextId++, createdAt: m.createdAt };
    if (m.kind === "toolCall") {
      return {
        ...base,
        kind: "toolCall",
        callId: m.toolCallId ?? "",
        name: m.toolName ?? "",
        args: m.toolArgs,
        status: m.error ? "error" : "success",
        output: m.toolOutput,
      };
    }
    if (m.kind === "permission") {
      return {
        ...base,
        kind: "permission",
        requestId: "",
        tool: m.toolName ?? "",
        description: m.content ?? "",
        args: m.toolArgs,
        decision: m.decision,
      };
    }
    return {
      ...base,
      kind: "message",
      role: m.role ?? "assistant",
      content: m.content ?? "",
      ...(m.error ? { error: true } : {}),
    };
  });

/** Drop the UI-only `id`, keeping just what belongs on disk. */
const toStored = (items: ChatItem[]): StoredMessage[] =>
  items.map((it): StoredMessage => {
    if (it.kind === "toolCall") {
      return {
        kind: "toolCall",
        createdAt: it.createdAt,
        toolName: it.name,
        toolCallId: it.callId,
        toolArgs: it.args,
        toolOutput: it.output,
        ...(it.status === "error" ? { error: true } : {}),
      };
    }
    if (it.kind === "permission") {
      return {
        kind: "permission",
        createdAt: it.createdAt,
        toolName: it.tool,
        content: it.description,
        toolArgs: it.args,
        decision: it.decision,
      };
    }
    return {
      kind: "message",
      role: it.role,
      content: it.content,
      createdAt: it.createdAt,
      ...(it.error ? { error: true } : {}),
    };
  });

/** Model-facing history: only clean text turns with actual content. */
const toHistory = (items: ChatItem[]) =>
  items.flatMap((it) =>
    it.kind === "message" && !it.error && it.content
      ? [{ role: it.role, content: it.content }]
      : [],
  );

const makeTitle = (text: string): string =>
  text.replace(/\s+/g, " ").trim().slice(0, 30) || "新对话";

/**
 * All conversation file writes/deletes are chained onto one queue so they
 * reach disk in call order (e.g. the mid-stream save never lands after the
 * final save, and a delete is never overtaken by a pending save).
 */
let fileQueue: Promise<void> = Promise.resolve();
const enqueueFileOp = (op: () => Promise<void>) => {
  fileQueue = fileQueue.then(op).catch((err: unknown) => {
    // Persistence must never break the chat flow; log and move on.
    console.error("会话存储操作失败：", errorMessage(err));
  });
};

/** Conversations the user deleted; pending saves for them are dropped. */
const deletedIds = new Set<string>();

export const useChatStore = create<ChatState>()((set, get) => {
  /** Persist a conversation and move it to the top of the sidebar list. */
  const persist = (id: string, title: string, messages: StoredMessage[]) => {
    const { activeAgentId, workspace } = get();
    enqueueFileOp(async () => {
      if (deletedIds.has(id)) return;
      const updatedAt = await saveConversation({
        id,
        title,
        messages,
        agentId: activeAgentId || undefined,
        workspace: workspace || undefined,
      });
      if (deletedIds.has(id)) return;
      set((state) => ({
        conversations: [
          { id, title, updatedAt },
          ...state.conversations.filter((c) => c.id !== id),
        ],
      }));
    });
  };

  const interruptStream = () => {
    const { streaming, requestId } = get();
    if (streaming && requestId != null) {
      void chatCancel(requestId);
      set({ streaming: false, requestId: null });
    }
  };

  /** Re-save the current transcript (used after agent/workspace changes). */
  const persistCurrent = () => {
    const { activeId, items, conversations } = get();
    if (activeId == null) return;
    const title = conversations.find((c) => c.id === activeId)?.title ?? "新对话";
    persist(activeId, title, toStored(items));
  };

  return {
    conversations: [],
    activeId: null,
    activeAgentId: "",
    workspace: "",
    items: [],
    streaming: false,
    requestId: null,

    async init() {
      try {
        set({ conversations: await listConversations() });
      } catch (err) {
        console.error("加载会话列表失败：", errorMessage(err));
      }
    },

    newConversation() {
      interruptStream();
      // Keep the picked agent so「换个话题」stays in the same persona;
      // the workspace binding is per-conversation and resets.
      set({ activeId: null, items: [], workspace: "" });
    },

    async openConversation(id) {
      if (get().activeId === id) return;
      interruptStream();
      try {
        const conv = await loadConversation(id);
        set({
          activeId: id,
          items: toItems(conv.messages),
          activeAgentId: conv.agentId ?? "",
          workspace: conv.workspace ?? "",
        });
      } catch (err) {
        console.error("加载会话失败：", errorMessage(err));
      }
    },

    async removeConversation(id) {
      deletedIds.add(id);
      if (get().activeId === id) {
        interruptStream();
        set({ activeId: null, items: [], workspace: "" });
      }
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
      }));
      enqueueFileOp(() => deleteConversation(id));
    },

    setAgent(agentId) {
      set({ activeAgentId: agentId });
      persistCurrent();
    },

    setWorkspace(workspace) {
      set({ workspace });
      persistCurrent();
    },

    respondPermission(requestId, decision) {
      void permissionRespond(requestId, decision).catch((err: unknown) => {
        console.error("回复授权失败：", errorMessage(err));
      });
      set((state) => ({
        items: state.items.map((it) =>
          it.kind === "permission" && it.requestId === requestId
            ? { ...it, decision }
            : it,
        ),
      }));
    },

    async send(providerId, model, text) {
      if (get().streaming) return;
      const requestId = nextId++;

      // Resolve the target conversation, creating one on first message.
      let convId = get().activeId;
      let title: string;
      if (convId == null) {
        convId = crypto.randomUUID();
        title = makeTitle(text);
        set({ activeId: convId });
      } else {
        title =
          get().conversations.find((c) => c.id === convId)?.title ?? makeTitle(text);
      }

      const now = Date.now();
      const history = toHistory(get().items);

      const userItem: ChatItem = {
        id: nextId++,
        kind: "message",
        role: "user",
        content: text,
        createdAt: now,
      };
      set({
        items: [...get().items, userItem],
        streaming: true,
        requestId,
      });

      // Persist the user turn right away so it survives crashes mid-stream.
      persist(convId, title, toStored(get().items));

      // The item currently receiving text deltas. A tool call closes it so
      // the next delta opens a fresh message (text/tool interleaving).
      let textItemId: number | null = null;
      let reply = "";
      let failed = false;
      let cancelled = false;
      let sawText = false;

      const patchItem = (id: number, patch: (item: ChatItem) => ChatItem) => {
        set((state) => ({
          items: state.items.map((it) => (it.id === id ? patch(it) : it)),
        }));
      };

      const appendItem = (item: ChatItem) => {
        // Guard against patching a different conversation after mid-stream
        // switches: append only while this request is still the active one.
        if (get().requestId !== requestId) return;
        set((state) => ({ items: [...state.items, item] }));
      };

      const ensureTextItem = (): number => {
        if (textItemId == null) {
          reply = "";
          const item: ChatItem = {
            id: nextId++,
            kind: "message",
            role: "assistant",
            content: "",
            createdAt: Date.now(),
          };
          textItemId = item.id;
          appendItem(item);
        }
        return textItemId;
      };

      // Deltas arrive per-token; painting each one re-renders the (markdown)
      // message and janks the stream. Batch them: at most one UI flush per
      // interval, with a final flush when the stream settles.
      let flushTimer: number | null = null;
      const flushReply = () => {
        flushTimer = null;
        if (textItemId != null) {
          const content = reply;
          patchItem(textItemId, (it) =>
            it.kind === "message" ? { ...it, content } : it,
          );
        }
      };
      const scheduleFlush = () => {
        flushTimer ??= window.setTimeout(flushReply, 50);
      };
      const cancelFlush = () => {
        if (flushTimer != null) window.clearTimeout(flushTimer);
        flushTimer = null;
      };

      const fail = (message: string) => {
        failed = true;
        const id = ensureTextItem();
        reply = reply ? `${reply}\n\n⚠️ ${message}` : message;
        const content = reply;
        patchItem(id, (it) =>
          it.kind === "message" ? { ...it, error: true, content } : it,
        );
      };

      try {
        await chatStream({
          requestId,
          providerId,
          model,
          messages: [...history, { role: "user", content: text }],
          conversationId: convId,
          agentId: get().activeAgentId || undefined,
          workspace: get().workspace || undefined,
          onEvent: (event) => {
            switch (event.type) {
              case "delta": {
                sawText = true;
                ensureTextItem();
                reply += event.content;
                scheduleFlush();
                break;
              }
              case "toolCallStart": {
                cancelFlush();
                flushReply();
                textItemId = null;
                appendItem({
                  id: nextId++,
                  kind: "toolCall",
                  callId: event.id,
                  name: event.name,
                  args: event.args,
                  status: "running",
                  createdAt: Date.now(),
                });
                break;
              }
              case "toolResult": {
                set((state) => ({
                  items: state.items.map((it) =>
                    it.kind === "toolCall" &&
                    it.callId === event.id &&
                    it.status === "running"
                      ? {
                          ...it,
                          status: event.isError ? "error" : "success",
                          output: event.output,
                        }
                      : it,
                  ),
                }));
                break;
              }
              case "permissionRequest": {
                cancelFlush();
                flushReply();
                textItemId = null;
                appendItem({
                  id: nextId++,
                  kind: "permission",
                  requestId: event.id,
                  tool: event.tool,
                  description: event.description,
                  args: event.args,
                  createdAt: Date.now(),
                });
                break;
              }
              case "done": {
                cancelled = event.cancelled;
                break;
              }
              case "error": {
                cancelFlush();
                fail(event.message);
                break;
              }
            }
          },
        });
      } catch (err) {
        cancelFlush();
        fail(errorMessage(err));
      } finally {
        cancelFlush();
        flushReply();
        if (!sawText && !failed) {
          const id = ensureTextItem();
          reply = cancelled ? "（已停止）" : "（空回复）";
          const content = reply;
          patchItem(id, (it) =>
            it.kind === "message" && !it.content ? { ...it, content } : it,
          );
        }
        // Only clear the flags if no newer stream took over meanwhile.
        if (get().requestId === requestId) {
          set({ streaming: false, requestId: null });
          persist(convId, title, toStored(get().items));
        }
      }
    },

    branchFrom(itemId) {
      const { items, activeId, conversations } = get();
      const index = items.findIndex((it) => it.id === itemId);
      if (index < 0) return;
      interruptStream();

      // Everything before the picked message carries over; the original
      // conversation is left untouched.
      const kept = items.slice(0, index);
      const base = conversations.find((c) => c.id === activeId)?.title ?? "对话";
      const convId = crypto.randomUUID();
      set({ activeId: convId, items: kept });
      persist(convId, `${base} · 分支`, toStored(kept));
    },

    async editAndResend(itemId, text, providerId, model) {
      const { items } = get();
      const index = items.findIndex((it) => it.id === itemId);
      if (index < 0) return;
      interruptStream();

      // Fork before the edited turn, then send it as the new branch's opener —
      // `send` sees an activeId that isn't in `conversations` yet and titles the
      // branch from this text.
      const kept = items.slice(0, index);
      set({ activeId: crypto.randomUUID(), items: kept });
      await get().send(providerId, model, text);
    },

    stop() {
      const id = get().requestId;
      if (id != null) void chatCancel(id);
    },
  };
});
