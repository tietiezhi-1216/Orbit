import { create } from "zustand";
import { chatCancel, chatStream, errorMessage } from "@/lib/api";
import type { ChatMessage } from "@/lib/api";

export interface ChatItem extends ChatMessage {
  id: number;
  error?: boolean;
}

interface ChatState {
  items: ChatItem[];
  streaming: boolean;
  requestId: number | null;
  send: (baseUrl: string, model: string, text: string) => Promise<void>;
  stop: () => void;
  clear: () => void;
}

let nextId = 1;

export const useChatStore = create<ChatState>()((set, get) => ({
  items: [],
  streaming: false,
  requestId: null,

  async send(baseUrl, model, text) {
    if (get().streaming) return;
    const requestId = nextId++;
    const userItem: ChatItem = { id: nextId++, role: "user", content: text };
    const assistantItem: ChatItem = { id: nextId++, role: "assistant", content: "" };
    // History sent to the model excludes the empty assistant placeholder.
    const history = [...get().items.filter((it) => !it.error), userItem];
    set({ items: [...get().items, userItem, assistantItem], streaming: true, requestId });

    const patchAssistant = (patch: (item: ChatItem) => ChatItem) => {
      set((state) => ({
        items: state.items.map((it) => (it.id === assistantItem.id ? patch(it) : it)),
      }));
    };

    let cancelled = false;
    try {
      await chatStream({
        requestId,
        baseUrl,
        model,
        messages: history.map(({ role, content }) => ({ role, content })),
        onEvent: (event) => {
          if (event.type === "delta") {
            patchAssistant((it) => ({ ...it, content: it.content + event.content }));
          } else if (event.type === "done") {
            cancelled = event.cancelled;
          } else {
            patchAssistant((it) => ({
              ...it,
              error: true,
              content: it.content ? `${it.content}\n\n⚠️ ${event.message}` : event.message,
            }));
          }
        },
      });
    } catch (err) {
      const message = errorMessage(err);
      patchAssistant((it) => ({
        ...it,
        error: true,
        content: it.content ? `${it.content}\n\n⚠️ ${message}` : message,
      }));
    } finally {
      patchAssistant((it) =>
        it.content ? it : { ...it, content: cancelled ? "（已停止）" : "（空回复）" },
      );
      set({ streaming: false, requestId: null });
    }
  },

  stop() {
    const id = get().requestId;
    if (id != null) void chatCancel(id);
  },

  clear() {
    if (get().streaming) get().stop();
    set({ items: [] });
  },
}));
