import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Mic, Settings2, Square } from "lucide-react";
import { AppIcon } from "@/components/app-icon";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { MessageItem } from "@/features/chat/message-item";
import { ModelSelect } from "@/features/chat/model-select";
import { PermissionPrompt } from "@/features/chat/permission-prompt";
import { ToolCallCard } from "@/features/chat/tool-call-card";
import { dictationToggle, loadSettings } from "@/lib/api";
import { useChatStore } from "@/stores/chat";
import { useUiStore } from "@/stores/ui";

export function ChatPage() {
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: loadSettings });
  const openSettings = useUiStore((s) => s.openSettings);
  const activeId = useChatStore((s) => s.activeId);
  const items = useChatStore((s) => s.items);
  const streaming = useChatStore((s) => s.streaming);
  const send = useChatStore((s) => s.send);
  const stop = useChatStore((s) => s.stop);
  const branchFrom = useChatStore((s) => s.branchFrom);
  const editAndResend = useChatStore((s) => s.editAndResend);

  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /** IME state — see `isImeEnter` for why both of these are needed. */
  const composingRef = useRef(false);
  const compositionEndAt = useRef(0);

  const providerId = settingsQuery.data?.chatProviderId ?? "";
  const model = settingsQuery.data?.chatModel ?? "";
  const ready = Boolean(providerId && model);

  // Keep the newest message in view. Instant while streaming: a smooth scroll
  // per flush never finishes before the next one starts, which reads as jank.
  const streamingRef = useRef(streaming);
  streamingRef.current = streaming;
  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: streamingRef.current ? "instant" : "smooth",
      block: "end",
    });
  }, [items]);

  // Stable handler so the memoized MessageItem list doesn't re-render per flush.
  const handleEdit = useCallback(
    (itemId: number, text: string) => {
      void editAndResend(itemId, text, providerId, model);
    },
    [editAndResend, providerId, model],
  );

  // Focus the composer when switching / starting conversations.
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeId]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || streaming || !ready) return;
    setInput("");
    void send(providerId, model, text);
  };

  /**
   * Whether an Enter keydown is the IME committing a candidate rather than a
   * send. Two signals are needed:
   *  • `isComposing` — catches the Chromium case, where the committing Enter
   *    still reports itself as part of the composition;
   *  • the time since `compositionend` — WebKit (so every macOS WKWebView, i.e.
   *    the app itself) fires `compositionend` FIRST and then delivers Enter with
   *    `isComposing: false`, which no flag alone can tell apart from a real one.
   */
  const isImeEnter = (e: React.KeyboardEvent) =>
    composingRef.current ||
    e.nativeEvent.isComposing ||
    Date.now() - compositionEndAt.current < 100;

  return (
    <div className="flex h-full flex-col">
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <AppIcon size="lg" alt="铁铁汁" className="size-40 drop-shadow-sm" />
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold">开始新对话</p>
            <p className="text-muted-foreground text-sm">
              {ready ? `当前模型：${model}` : "先在设置里添加供应商并选择模型"}
            </p>
          </div>
          {!ready && (
            <Button variant="outline" size="sm" onClick={() => openSettings("providers")}>
              <Settings2 /> 去设置
            </Button>
          )}
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
            {items.map((item) =>
              item.kind === "toolCall" ? (
                <ToolCallCard key={item.id} item={item} />
              ) : item.kind === "permission" ? (
                <PermissionPrompt key={item.id} item={item} />
              ) : (
                <MessageItem
                  key={item.id}
                  item={item}
                  onBranch={branchFrom}
                  onEdit={handleEdit}
                />
              ),
            )}
            <div ref={endRef} />
          </div>
        </ScrollArea>
      )}

      {/* Composer, laid out like Claude Code / Codex: the input owns its whole
          box, and the controls (model, dictation, send) sit on its bottom row. */}
      <div className="mx-auto w-full max-w-3xl px-4 pt-2 pb-4">
        <div className="border-input bg-background focus-within:border-ring focus-within:ring-ring/30 flex flex-col rounded-2xl border px-2 pt-1.5 pb-1.5 shadow-sm transition-colors focus-within:ring-[3px]">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
              compositionEndAt.current = Date.now();
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey) return;
              if (isImeEnter(e)) return; // picking an IME candidate, not sending
              e.preventDefault();
              handleSend();
            }}
            placeholder={ready ? "输入消息…" : "先在设置里选择模型"}
            disabled={!ready}
            className="max-h-40 min-h-9 resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
            rows={1}
          />

          <div className="flex items-center gap-1 pt-0.5 pl-1">
            <span className="text-muted-foreground flex-1 truncate text-[11px]">
              Enter 发送 · Shift+Enter 换行
            </span>
            <ModelSelect />
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-7 shrink-0 rounded-full"
              onClick={() => void dictationToggle()}
              aria-label="语音听写"
              title="语音听写"
            >
              <Mic className="size-4" />
            </Button>
            {streaming ? (
              <Button
                variant="outline"
                size="icon"
                className="size-8 shrink-0 rounded-full"
                onClick={stop}
                aria-label="停止生成"
              >
                <Square />
              </Button>
            ) : (
              <Button
                size="icon"
                className="size-8 shrink-0 rounded-full"
                onClick={handleSend}
                disabled={!input.trim() || !ready}
                aria-label="发送"
              >
                <ArrowUp />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
