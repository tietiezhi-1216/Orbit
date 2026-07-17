import { useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AgentsDialog } from "@/features/agents/agents-dialog";
import { AgentSelect } from "@/features/chat/agent-select";
import { ChatPage } from "@/features/chat/chat-page";
import { WorkspaceIndicator } from "@/features/chat/workspace-indicator";
import { SettingsDialog } from "@/features/settings/settings-dialog";
import { useChatStore } from "@/stores/chat";
import { useUiStore } from "@/stores/ui";

export default function App() {
  const activeId = useChatStore((s) => s.activeId);
  const conversations = useChatStore((s) => s.conversations);
  const sidebarWidth = useUiStore((s) => s.sidebarWidth);
  const title = conversations.find((c) => c.id === activeId)?.title ?? "新对话";

  // Load the persisted conversation list once on startup.
  useEffect(() => {
    void useChatStore.getState().init();
  }, []);

  return (
    <SidebarProvider width={`${sidebarWidth}px`}>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-1 border-b px-3">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4!" />
          <span className="truncate text-sm font-medium">{title}</span>
          <div className="ml-auto flex items-center gap-1.5">
            <AgentSelect />
            <WorkspaceIndicator />
          </div>
        </header>
        <div className="min-h-0 flex-1">
          <ChatPage />
        </div>
      </SidebarInset>
      <SettingsDialog />
      <AgentsDialog />
    </SidebarProvider>
  );
}
