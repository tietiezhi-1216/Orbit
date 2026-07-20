import { memo, useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  Check,
  ChevronRight,
  Copy,
  GitBranch,
  Info,
  Pencil,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ChatAssetCard } from "@/features/chat/chat-asset-card";
import { Markdown, fadeTokens, isFadeSpace } from "@/features/chat/markdown";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { ChatItem } from "@/stores/chat";

/**
 * Plain streaming text where each newly appended word fades up from transparent.
 * Append-only streaming keeps leading spans stable, so only new words animate.
 */
function FadeStreamText({ text }: { text: string }) {
  return (
    <>
      {fadeTokens(text).map((part, index) =>
        isFadeSpace(part) ? (
          part
        ) : (
          <span key={index} className="token-in">
            {part}
          </span>
        ),
      )}
    </>
  );
}

/** Collapsible chain-of-thought shown above a reasoning model's answer. */
function ReasoningBlock({
  text,
  hasAnswer,
  streaming,
}: {
  text: string;
  hasAnswer: boolean;
  streaming: boolean;
}) {
  // Expanded while the model is still thinking (no answer yet); collapsed once
  // an answer exists — e.g. a reply reloaded from disk.
  const [open, setOpen] = useState(!hasAnswer);
  return (
    <div className="border-border/60 bg-muted/30 rounded-lg border text-xs">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-2.5 py-1.5 font-medium"
      >
        <BrainCircuit className="size-3.5 shrink-0" />
        <span>思考过程</span>
        <ChevronRight
          className={cn("ml-auto size-3.5 shrink-0 transition-transform", open && "rotate-90")}
        />
      </button>
      {open && (
        <div className="text-muted-foreground border-border/60 border-t px-2.5 py-2 leading-relaxed whitespace-pre-wrap select-text">
          {streaming ? <FadeStreamText text={text} /> : text}
        </div>
      )}
    </div>
  );
}

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
  visible,
  children,
}: {
  createdAt: number;
  align: "start" | "end";
  visible: boolean;
  children?: React.ReactNode;
}) {
  const now = useNow();
  const [visibilityHeld, setVisibilityHeld] = useState(visible);
  const age = formatRelativeTime(createdAt, now);
  const exactTime = createdAt > 0 ? new Date(createdAt).toLocaleString("zh-CN") : "";

  useEffect(() => {
    if (visible) {
      setVisibilityHeld(true);
      return;
    }
    const timer = window.setTimeout(() => setVisibilityHeld(false), 200);
    return () => window.clearTimeout(timer);
  }, [visible]);

  return (
    <div
      aria-hidden={!visible}
      data-state={visible ? "visible" : "hidden"}
      className={cn(
        "flex h-6 items-center gap-0.5 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
        align === "end" ? "justify-end" : "justify-start",
        visibilityHeld ? "visible" : "invisible",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-0.5 opacity-0",
      )}
    >
      {age && (
        <span className="text-muted-foreground px-1 text-[11px]" title={exactTime}>
          {age}
        </span>
      )}
      {children}
    </div>
  );
}

const formatDuration = (milliseconds: number): string => {
  if (milliseconds < 1_000) return `${milliseconds}ms`;
  const seconds = milliseconds / 1_000;
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
};

const tokenFormatter = new Intl.NumberFormat("en-US");

const formatTps = (tokensPerSecond: number): string =>
  tokensPerSecond >= 100
    ? Math.round(tokensPerSecond).toString()
    : tokensPerSecond.toFixed(1);

function MetaValue({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <span className="text-muted-foreground px-1 text-[11px]" title={title}>
      {children}
    </span>
  );
}

/** True when the reply carries any stat worth surfacing (model / tokens / timing). */
function hasMessageStats(item: MessageChatItem): boolean {
  return (
    item.model != null ||
    item.totalTokens != null ||
    item.durationMs != null ||
    item.firstTokenMs != null
  );
}

/** Inline stat chips shown under the reply when the setting is on. */
function MessageStats({
  item,
  providerName,
  tokensPerSecond,
  generationMs,
}: {
  item: MessageChatItem;
  providerName?: string;
  tokensPerSecond: number | null;
  generationMs: number | null;
}) {
  const provider = providerName ?? item.providerId;
  return (
    <>
      {item.model && (
        <MetaValue
          title={
            provider
              ? `模型：${item.model} · 供应商：${provider}`
              : `模型：${item.model}`
          }
        >
          {item.model}
        </MetaValue>
      )}
      {item.totalTokens != null && !item.usageEstimated && (
        <MetaValue
          title={`实际 Token：输入 ${item.promptTokens ?? 0} · 输出 ${item.completionTokens ?? 0} · 总计 ${item.totalTokens}`}
        >
          {tokenFormatter.format(item.totalTokens)} tokens
        </MetaValue>
      )}
      {tokensPerSecond != null && generationMs != null && (
        <MetaValue
          title={`实际生成速度：输出 ${tokenFormatter.format(item.completionTokens ?? 0)} Token ÷ ${formatDuration(generationMs)} = ${formatTps(tokensPerSecond)} Token/s`}
        >
          {formatTps(tokensPerSecond)} tokens/s
        </MetaValue>
      )}
      {item.firstTokenMs != null && (
        <MetaValue title={`从发送到收到第一个 Token：${item.firstTokenMs}ms`}>
          首字 {formatDuration(item.firstTokenMs)}
        </MetaValue>
      )}
      {item.durationMs != null && (
        <MetaValue title={`本次回复总耗时：${item.durationMs}ms`}>
          耗时 {formatDuration(item.durationMs)}
        </MetaValue>
      )}
    </>
  );
}

function DetailRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      {/* Never wrap: ellipsis by default, scroll horizontally on hover for long values. */}
      <span
        title={value}
        className={cn(
          "text-foreground min-w-0 truncate tabular-nums hover:overflow-x-auto",
          strong && "font-semibold",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** The always-available "详情" button: full per-reply stats in a popover. */
function MessageDetails({
  item,
  providerName,
  open,
  onOpenChange,
  tokensPerSecond,
  generationMs,
}: {
  item: MessageChatItem;
  providerName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokensPerSecond: number | null;
  generationMs: number | null;
}) {
  const hasUsage = item.totalTokens != null;
  const cached = item.cachedTokens ?? 0;
  const completedAt = item.completedAt ?? item.createdAt;
  const provider = providerName ?? item.providerId;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-6"
          aria-label="消息详情"
          title="消息详情"
        >
          <Info className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="border-b px-3 py-2 text-xs font-semibold">消息详情</div>
        <div className="flex flex-col gap-1.5 px-3 py-2.5">
          {item.model && <DetailRow label="模型" value={item.model} />}
          {provider && <DetailRow label="供应商" value={provider} />}
          {hasUsage && (
            <>
              <DetailRow
                label="输入"
                value={`${tokenFormatter.format(item.promptTokens ?? 0)} tokens`}
              />
              {cached > 0 && (
                <DetailRow
                  label="其中缓存命中"
                  value={`${tokenFormatter.format(cached)} tokens`}
                />
              )}
              <DetailRow
                label="输出"
                value={`${tokenFormatter.format(item.completionTokens ?? 0)} tokens`}
              />
              <DetailRow
                label="总计"
                value={`${tokenFormatter.format(item.totalTokens ?? 0)} tokens`}
                strong
              />
              {item.usageEstimated && (
                <p className="text-muted-foreground text-[11px]">Token 为估算值</p>
              )}
            </>
          )}
          {tokensPerSecond != null && (
            <DetailRow label="生成速度" value={`${formatTps(tokensPerSecond)} tokens/s`} />
          )}
          {item.firstTokenMs != null && (
            <DetailRow label="首字延迟" value={formatDuration(item.firstTokenMs)} />
          )}
          {item.durationMs != null && (
            <DetailRow label="总耗时" value={formatDuration(item.durationMs)} />
          )}
          {generationMs != null && (
            <DetailRow label="纯生成耗时" value={formatDuration(generationMs)} />
          )}
          {completedAt > 0 && (
            <DetailRow
              label="完成时间"
              value={new Date(completedAt).toLocaleString("zh-CN")}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
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
  hoverKey: string;
  hovered: boolean;
  showActions: boolean;
  /** Show the inline stat chips under assistant replies; details stay behind the button. */
  showStats: boolean;
  /** Whether the "思考过程" block is shown at all (user setting). */
  showReasoning: boolean;
  /** This is the reply currently streaming — enables the fade-in edge mask. */
  streaming: boolean;
  /** Human-readable provider name resolved from the reply's providerId. */
  providerName?: string;
  onBranch: (itemId: number) => void;
  onEdit: (itemId: number, text: string) => void;
  onHoverChange: (hoverKey: string | null) => void;
}

/**
 * Memoized: while a reply streams, the items array is rebuilt on every flush
 * but only the streaming message's object identity changes — every other
 * message must skip re-rendering (markdown + highlight are expensive).
 */
export const MessageItem = memo(function MessageItem({
  item,
  hoverKey,
  hovered,
  showActions,
  showStats,
  showReasoning,
  streaming,
  providerName,
  onBranch,
  onEdit,
  onHoverChange,
}: MessageItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.content);
  const [copied, setCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
        if (!text && !item.attachments?.length) return;
        setEditing(false);
        onEdit(item.id, text);
      }} />;
    }

    return (
      <div
        className="animate-in fade-in slide-in-from-bottom-1 flex flex-col items-end gap-1 duration-300"
        onPointerEnter={() => onHoverChange(hoverKey)}
        onPointerLeave={() => onHoverChange(null)}
      >
        <div className="bg-muted flex max-w-[70%] flex-col gap-2 rounded-xl px-3 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap select-text">
          {item.attachments && item.attachments.length > 0 && (
            <div className="flex max-w-full flex-wrap gap-1.5">
              {item.attachments.map((attachment) => (
                <ChatAssetCard
                  key={attachment.id}
                  asset={attachment}
                />
              ))}
            </div>
          )}
          {item.content && <span className="px-1">{item.content}</span>}
        </div>
        <ActionRow createdAt={item.createdAt} align="end" visible={hovered}>
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

  const generationMs =
    item.durationMs != null && item.firstTokenMs != null
      ? item.durationMs - item.firstTokenMs
      : null;
  const tokensPerSecond =
    !item.usageEstimated &&
    item.completionTokens != null &&
    item.completionTokens > 0 &&
    generationMs != null &&
    generationMs > 0
      ? item.completionTokens / (generationMs / 1_000)
      : null;

  // Assistant: plain prose, no bubble.
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-1 flex min-w-0 flex-col gap-1 duration-300"
      onPointerEnter={showActions ? () => onHoverChange(hoverKey) : undefined}
      onPointerLeave={showActions ? () => onHoverChange(null) : undefined}
    >
      {showReasoning && item.reasoning && (
        <ReasoningBlock
          text={item.reasoning}
          hasAnswer={Boolean(item.content)}
          streaming={streaming}
        />
      )}
      {item.content && (
        item.error ? (
          <p className="text-destructive text-sm leading-relaxed whitespace-pre-wrap select-text">
            {item.content}
          </p>
        ) : (
          <Markdown content={item.content} streaming={streaming} />
        )
      )}
      {item.content && showActions && (
        <ActionRow
          createdAt={item.completedAt ?? item.createdAt}
          align="start"
          visible={hovered || detailsOpen}
        >
          {showStats && (
            <MessageStats
              item={item}
              providerName={providerName}
              tokensPerSecond={tokensPerSecond}
              generationMs={generationMs}
            />
          )}
          {hasMessageStats(item) && (
            <MessageDetails
              item={item}
              providerName={providerName}
              open={detailsOpen}
              onOpenChange={setDetailsOpen}
              tokensPerSecond={tokensPerSecond}
              generationMs={generationMs}
            />
          )}
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
