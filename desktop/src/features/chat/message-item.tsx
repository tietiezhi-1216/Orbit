import { memo, useEffect, useRef, useState } from "react";
import { Check, Copy, GitBranch, Pencil, X } from "lucide-react";
import { AppIconLoader } from "@/components/app-icon-loader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/features/chat/markdown";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { ChatItem } from "@/stores/chat";

/** Re-render on an interval so "X 秒前" keeps counting up on its own. */
function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Timestamp + action buttons; hidden until the message is hovered. */
function ActionRow({
  createdAt,
  align,
  children,
}: {
  createdAt: number;
  align: "start" | "end";
  children?: React.ReactNode;
}) {
  const now = useNow();
  const age = formatRelativeTime(createdAt, now);

  return (
    <div
      className={cn(
        // Hover-only. Deliberately NOT focus-within: a clicked button keeps
        // focus, which would pin the row visible after the pointer leaves.
        "flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
        align === "end" ? "justify-end" : "justify-start",
      )}
    >
      {age && <span className="text-muted-foreground px-1 text-[11px]">{age}</span>}
      {children}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-foreground size-6"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon className="size-3.5" />
    </Button>
  );
}

/** The plain-text variant; tool calls & permission asks render elsewhere. */
export type MessageChatItem = Extract<ChatItem, { kind: "message" }>;

interface MessageItemProps {
  item: MessageChatItem;
  onBranch: (itemId: number) => void;
  onEdit: (itemId: number, text: string) => void;
}

/**
 * Memoized: while a reply streams, the items array is rebuilt on every flush
 * but only the streaming message's object identity changes — every other
 * message must skip re-rendering (markdown + highlight are expensive).
 */
export const MessageItem = memo(function MessageItem({
  item,
  onBranch,
  onEdit,
}: MessageItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.content);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(item.content).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  if (item.role === "user") {
    if (editing) {
      return <EditBox draft={draft} setDraft={setDraft} onCancel={() => {
        setEditing(false);
        setDraft(item.content);
      }} onSubmit={() => {
        const text = draft.trim();
        if (!text) return;
        setEditing(false);
        onEdit(item.id, text);
      }} />;
    }

    return (
      <div className="group flex flex-col items-end gap-1">
        <div className="bg-muted max-w-[70%] rounded-xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap">
          {item.content}
        </div>
        <ActionRow createdAt={item.createdAt} align="end">
          <ActionButton
            icon={GitBranch}
            label="从这里开分支"
            onClick={() => onBranch(item.id)}
          />
          <ActionButton
            icon={Pencil}
            label="编辑并重发（另存为分支）"
            onClick={() => {
              setDraft(item.content);
              setEditing(true);
            }}
          />
        </ActionRow>
      </div>
    );
  }

  // Assistant: plain prose, no bubble.
  return (
    <div className="group flex min-w-0 flex-col gap-1">
      {item.content ? (
        item.error ? (
          <p className="text-destructive text-sm leading-relaxed whitespace-pre-wrap">
            {item.content}
          </p>
        ) : (
          <Markdown content={item.content} />
        )
      ) : (
        <AppIconLoader />
      )}
      {item.content && (
        <ActionRow createdAt={item.createdAt} align="start">
          <ActionButton
            icon={copied ? Check : Copy}
            label={copied ? "已复制" : "复制"}
            onClick={copy}
          />
        </ActionRow>
      )}
    </div>
  );
});

function EditBox({
  draft,
  setDraft,
  onCancel,
  onSubmit,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="border-input bg-background w-[70%] rounded-2xl border p-2">
        <Textarea
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="max-h-52 min-h-9 resize-none border-0 bg-transparent p-1 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          rows={2}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground mr-1 text-[11px]">改完会另存为一条分支对话</span>
        <Button variant="ghost" size="sm" className="h-7" onClick={onCancel}>
          <X /> 取消
        </Button>
        <Button size="sm" className="h-7" onClick={onSubmit} disabled={!draft.trim()}>
          <Check /> 重新发送
        </Button>
      </div>
    </div>
  );
}
