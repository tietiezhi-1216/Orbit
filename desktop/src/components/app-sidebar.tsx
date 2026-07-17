import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal, Settings, SquarePen, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarResizeHandle,
} from "@/components/ui/sidebar";
import { AppIcon } from "@/components/app-icon";
import { Separator } from "@/components/ui/separator";
import { dictationHotkey, loadSettings } from "@/lib/api";
import { formatShortcut } from "@/lib/shortcut";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat";
import {
  SIDEBAR_DEFAULT_PX,
  SIDEBAR_MAX_PX,
  SIDEBAR_MIN_PX,
  useUiStore,
} from "@/stores/ui";

export function AppSidebar() {
  const openSettings = useUiStore((s) => s.openSettings);
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const newConversation = useChatStore((s) => s.newConversation);
  const openConversation = useChatStore((s) => s.openConversation);
  const removeConversation = useChatStore((s) => s.removeConversation);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const pendingTitle = conversations.find((c) => c.id === pendingDelete)?.title;

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <AppIcon size="md" />
          <div className="flex flex-col">
            <span className="text-sm leading-tight font-semibold">铁铁汁</span>
            <span className="text-muted-foreground text-xs leading-tight">
              智能体终端 · 模型枢纽
            </span>
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={newConversation}>
              <SquarePen />
              <span>新对话</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>对话记录</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {conversations.length === 0 && (
                <div className="text-muted-foreground px-2 py-1.5 text-xs">
                  暂无对话，发送第一条消息试试。
                </div>
              )}
              {conversations.map((conv) => (
                <SidebarMenuItem key={conv.id}>
                  <SidebarMenuButton
                    isActive={activeId === conv.id}
                    onClick={() => void openConversation(conv.id)}
                  >
                    <span className="truncate">{conv.title}</span>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction showOnHover aria-label="会话操作">
                        <MoreHorizontal />
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setPendingDelete(conv.id)}
                      >
                        <Trash2 />
                        删除对话
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-1">
        <DictationStatus onClick={() => openSettings("dictationModel")} />
        <Separator className="my-0.5" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => openSettings()}>
              <Settings />
              <span>设置</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <AlertDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这段对话？</AlertDialogTitle>
            <AlertDialogDescription>
              「{pendingTitle ?? "对话"}」的消息记录将被永久删除，无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete != null) void removeConversation(pendingDelete);
                setPendingDelete(null);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SidebarResizeHandle
        minWidth={SIDEBAR_MIN_PX}
        maxWidth={SIDEBAR_MAX_PX}
        onResizeEnd={setSidebarWidth}
        onReset={() => setSidebarWidth(SIDEBAR_DEFAULT_PX)}
      />
    </Sidebar>
  );
}

/**
 * The sidebar's info panel: at-a-glance dictation readiness + its trigger.
 * Clicking jumps straight to the dictation settings.
 */
function DictationStatus({ onClick }: { onClick: () => void }) {
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: loadSettings });
  const hotkeyQuery = useQuery({ queryKey: ["dictationHotkey"], queryFn: dictationHotkey });

  const settings = settingsQuery.data;
  const ready = Boolean(settings?.asrProviderId && settings?.asrModel);
  const model = settings?.asrModel ?? "";

  return (
    <button
      onClick={onClick}
      className="hover:bg-sidebar-accent group flex flex-col gap-1.5 rounded-md px-2 py-2 text-left transition-colors"
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            ready ? "bg-emerald-500" : "bg-muted-foreground/40",
          )}
        />
        <span className="text-xs font-medium">语音听写</span>
        <kbd className="text-muted-foreground bg-muted ml-auto rounded px-1.5 py-0.5 font-sans text-[10px] leading-none">
          {formatShortcut(hotkeyQuery.data ?? "Alt+Space")}
        </kbd>
      </div>
      <span className="text-muted-foreground truncate pl-3.5 text-[11px] leading-none">
        {ready ? `就绪 · ${model}` : "未配置识别模型"}
      </span>
    </button>
  );
}
