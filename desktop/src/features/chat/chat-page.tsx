import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Eraser, MessageSquareDashed, Settings2, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { loadSettings } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat";
import { useUiStore } from "@/stores/ui";

export function ChatPage() {
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: loadSettings });
  const items = useChatStore((s) => s.items);
  const streaming = useChatStore((s) => s.streaming);
  const send = useChatStore((s) => s.send);
  const stop = useChatStore((s) => s.stop);
  const clear = useChatStore((s) => s.clear);
  const setPage = useUiStore((s) => s.setPage);

  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const settings = settingsQuery.data;
  const configured = Boolean(settings?.baseUrl && settings?.model);

  // Keep the newest message in view while streaming.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || streaming || !settings || !configured) return;
    setInput("");
    void send(settings.baseUrl, settings.model, text);
  };

  if (settingsQuery.isSuccess && !configured) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>尚未接入中转站</CardTitle>
            <CardDescription>先配置 baseURL、API Key 和默认模型，就能开始聊天。</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => setPage("providers")}>
              <Settings2 /> 去接入配置
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-6">
          {items.length === 0 && (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-16 text-sm">
              <MessageSquareDashed className="size-8 opacity-60" />
              <span>开始和 {settings?.model ?? "模型"} 对话吧</span>
            </div>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className={cn("flex", item.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap",
                  item.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                  item.error && "bg-destructive/10 text-destructive",
                )}
              >
                {item.content || "…"}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="border-t">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Don't send while the IME is composing Chinese input.
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入消息，Enter 发送，Shift+Enter 换行"
              className="max-h-40 min-h-11 flex-1 resize-none"
              rows={1}
            />
            {streaming ? (
              <Button variant="outline" size="icon" onClick={stop} aria-label="停止生成">
                <Square />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || !configured}
                aria-label="发送"
              >
                <ArrowUp />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{settings?.model ?? "…"}</Badge>
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground ml-auto h-7"
                onClick={clear}
              >
                <Eraser /> 清空对话
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
