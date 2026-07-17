import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { deleteAgent, listAgents, upsertAgent } from "@/lib/api";
import type { Agent } from "@/lib/api";
import { AgentEditor } from "@/features/agents/agent-editor";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui";

const emptyAgent = (): Agent => ({
  id: crypto.randomUUID(),
  name: "",
  systemPrompt: "",
  model: "",
  modelProviderId: "",
  skills: [],
  mcpServers: [],
  tools: [],
  permissionMode: "auto",
});

/** Trae-style agents manager: profile list on the left, editor on the right. */
export function AgentsDialog() {
  const open = useUiStore((s) => s.agentsOpen);
  const editingAgentId = useUiStore((s) => s.editingAgentId);
  const closeAgents = useUiStore((s) => s.closeAgents);

  const queryClient = useQueryClient();
  const agentsQuery = useQuery({ queryKey: ["agents"], queryFn: listAgents });
  const agents = agentsQuery.data ?? [];

  /** The profile being edited; null = nothing selected yet. */
  const [draft, setDraft] = useState<Agent | null>(null);

  // Preselect: the requested agent, else the first one.
  useEffect(() => {
    if (!open) {
      setDraft(null);
      return;
    }
    if (draft == null && agents.length > 0) {
      const target = agents.find((a) => a.id === editingAgentId) ?? agents[0];
      setDraft(structuredClone(target));
    }
  }, [open, agents, editingAgentId, draft]);

  const save = useMutation({
    mutationFn: upsertAgent,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["agents"] }),
  });
  const remove = useMutation({
    mutationFn: deleteAgent,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["agents"] }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeAgents()}>
      <DialogContent
        showCloseButton
        className="flex h-[680px] max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <nav className="bg-muted/30 flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r p-3">
          <DialogTitle className="px-2 pt-1 pb-2 text-sm font-semibold">
            智能体
          </DialogTitle>
          <Button
            variant="outline"
            size="sm"
            className="mb-2 justify-start"
            onClick={() => setDraft(emptyAgent())}
          >
            <Plus /> 新建智能体
          </Button>
          {agents.length === 0 && (
            <p className="text-muted-foreground px-2 py-1 text-xs">
              还没有智能体，点上面新建一个。
            </p>
          )}
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setDraft(structuredClone(agent))}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                draft?.id === agent.id
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Bot className="size-4 shrink-0" />
              <span className="truncate">{agent.name || "未命名"}</span>
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          {draft ? (
            <AgentEditor
              key={draft.id}
              agent={draft}
              onChange={setDraft}
              saving={save.isPending}
              onSave={() => save.mutate(draft)}
              onDelete={
                agents.some((a) => a.id === draft.id)
                  ? () => {
                      remove.mutate(draft.id);
                      setDraft(null);
                    }
                  : undefined
              }
              deleteIcon={Trash2}
            />
          ) : (
            <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
              选择或新建一个智能体
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
