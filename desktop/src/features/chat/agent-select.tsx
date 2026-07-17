import { useQuery } from "@tanstack/react-query";
import { Bot, Check, ChevronDown, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listAgents } from "@/lib/api";
import { useChatStore } from "@/stores/chat";
import { useUiStore } from "@/stores/ui";
import { cn } from "@/lib/utils";

/** Header dropdown binding the current conversation to an agent profile. */
export function AgentSelect() {
  const agentsQuery = useQuery({ queryKey: ["agents"], queryFn: listAgents });
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const setAgent = useChatStore((s) => s.setAgent);
  const openAgents = useUiStore((s) => s.openAgents);

  const agents = agentsQuery.data ?? [];
  const active = agents.find((a) => a.id === activeAgentId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 gap-1.5 px-2"
        >
          <Bot className="size-3.5" />
          <span className="max-w-28 truncate text-xs">
            {active?.name ?? "默认助手"}
          </span>
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => setAgent("")}>
          <Check className={cn("size-3.5", activeAgentId === "" ? "" : "invisible")} />
          默认助手
        </DropdownMenuItem>
        {agents.map((agent) => (
          <DropdownMenuItem key={agent.id} onClick={() => setAgent(agent.id)}>
            <Check
              className={cn(
                "size-3.5",
                activeAgentId === agent.id ? "" : "invisible",
              )}
            />
            <span className="truncate">{agent.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openAgents()}>
          <Settings2 className="size-3.5" />
          管理智能体…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
