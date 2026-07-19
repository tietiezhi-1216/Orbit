import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Save } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  listBuiltinTools,
  listSkills,
  loadSettings,
} from "@/lib/api";
import type { Agent, PermissionMode, ReasoningEffort } from "@/lib/api";
import { effectiveModelKind, modelReasoning } from "@/lib/model-capabilities";
import { cn } from "@/lib/utils";

const PERMISSION_OPTIONS: { value: PermissionMode; label: string; hint: string }[] = [
  { value: "ask", label: "请求批准", hint: "所有写操作和命令都先询问" },
  { value: "auto", label: "智能审核", hint: "只读放行，危险操作询问" },
  { value: "full", label: "完全访问", hint: "所有工具直接执行（谨慎）" },
];

/** Multi-select over a name list, rendered as a Popover + Command combo. */
function MultiSelect({
  placeholder,
  options,
  selected,
  onToggle,
  emptyHint,
}: {
  placeholder: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  emptyHint: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between font-normal">
          <span className="text-muted-foreground truncate text-xs">
            {selected.length > 0 ? `已选 ${selected.length} 项` : placeholder}
          </span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandList>
            <CommandEmpty>{emptyHint}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem key={opt.value} onSelect={() => onToggle(opt.value)}>
                  <Check
                    className={cn(
                      "size-3.5",
                      selected.includes(opt.value) ? "" : "invisible",
                    )}
                  />
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface AgentEditorProps {
  agent: Agent;
  onChange: (agent: Agent) => void;
  onSave: () => void;
  saving: boolean;
  onDelete?: () => void;
  deleteIcon: LucideIcon;
}

export function AgentEditor({
  agent,
  onChange,
  onSave,
  saving,
  onDelete,
  deleteIcon: DeleteIcon,
}: AgentEditorProps) {
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: loadSettings });
  const skillsQuery = useQuery({ queryKey: ["skills"], queryFn: listSkills });
  const toolsQuery = useQuery({ queryKey: ["builtinTools"], queryFn: listBuiltinTools });

  const settings = settingsQuery.data;
  const provider = settings?.providers.find((p) => p.id === agent.modelProviderId);
  const chatModels = (provider?.models ?? []).filter(
    (model) => effectiveModelKind(model) === "chat",
  );
  const overrideModel = chatModels.find((model) => model.id === agent.model);
  const reasoning = overrideModel ? modelReasoning(overrideModel) : undefined;
  const allTools = toolsQuery.data ?? [];

  const patch = (p: Partial<Agent>) => onChange({ ...agent, ...p });
  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-6">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">
          {agent.name || "新智能体"}
        </h2>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive size-8"
            onClick={onDelete}
            aria-label="删除智能体"
          >
            <DeleteIcon className="size-4" />
          </Button>
        )}
        <Button size="sm" onClick={onSave} disabled={saving || !agent.name.trim()}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          保存
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="agent-name">名称</Label>
          <Input
            id="agent-name"
            value={agent.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="例如：编码助手"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="agent-prompt">系统提示词</Label>
          <Textarea
            id="agent-prompt"
            value={agent.systemPrompt}
            onChange={(e) => patch({ systemPrompt: e.target.value })}
            spellCheck={false}
            placeholder="留空则使用全局系统提示词"
            className="min-h-36 font-mono text-xs leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>模型覆盖</Label>
            <Select
              value={agent.modelProviderId || "__none__"}
              onValueChange={(v) =>
                patch(
                  v === "__none__"
                    ? { modelProviderId: "", model: "", reasoningEffort: "" }
                    : { modelProviderId: v, model: "", reasoningEffort: "" },
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="跟随全局选择" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">跟随全局选择</SelectItem>
                {(settings?.providers ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {agent.modelProviderId && (
              <Select
                value={agent.model || undefined}
                onValueChange={(v) => patch({ model: v, reasoningEffort: "" })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {chatModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {reasoning?.mode === "effort" && (
              <Select
                value={agent.reasoningEffort || "__follow__"}
                onValueChange={(value) =>
                  patch({
                    reasoningEffort:
                      value === "__follow__" ? "" : (value as ReasoningEffort),
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Reasoning Effort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__follow__">跟随聊天设置</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                  {reasoning.supportedEfforts
                    .filter((effort) => effort !== "auto")
                    .map((effort) => (
                      <SelectItem key={effort} value={effort}>
                        {effort === "xhigh"
                          ? "XHigh"
                          : effort.charAt(0).toUpperCase() + effort.slice(1)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            {reasoning?.mode === "fixed" && (
              <span className="text-muted-foreground px-1 text-xs">
                Reasoning Effort: Fixed
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>权限模式</Label>
            <Select
              value={agent.permissionMode}
              onValueChange={(v) => patch({ permissionMode: v as PermissionMode })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {PERMISSION_OPTIONS.find((o) => o.value === agent.permissionMode)?.hint}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>技能（Skills）</Label>
            <MultiSelect
              placeholder="全部已启用技能"
              emptyHint="还没有技能"
              options={(skillsQuery.data ?? []).map((s) => ({
                value: s.name,
                label: s.name,
              }))}
              selected={agent.skills}
              onToggle={(v) => patch({ skills: toggleIn(agent.skills, v) })}
            />
            {agent.skills.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {agent.skills.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[10px]">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>MCP 服务器</Label>
            <MultiSelect
              placeholder="全部已启用服务器"
              emptyHint="还没有 MCP 服务器"
              options={(settings?.mcpServers ?? []).map((s) => ({
                value: s.id,
                label: s.name,
              }))}
              selected={agent.mcpServers}
              onToggle={(v) => patch({ mcpServers: toggleIn(agent.mcpServers, v) })}
            />
            {agent.mcpServers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {agent.mcpServers.map((id) => (
                  <Badge key={id} variant="secondary" className="text-[10px]">
                    {settings?.mcpServers.find((s) => s.id === id)?.name ?? id}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>内置工具</Label>
          <p className="text-muted-foreground text-xs">
            全关 = 允许全部；开启任意一个后，未开启的将被禁用。
          </p>
          <div className="grid grid-cols-3 gap-x-4 gap-y-2">
            {allTools.map((tool) => (
              <label key={tool} className="flex items-center gap-2 text-sm">
                <Switch
                  checked={agent.tools.length === 0 || agent.tools.includes(tool)}
                  onCheckedChange={(checked) => {
                    // Empty list means "all"; materialize it before narrowing.
                    const current = agent.tools.length === 0 ? [...allTools] : agent.tools;
                    const next = checked
                      ? [...current, tool].filter((t, i, arr) => arr.indexOf(t) === i)
                      : current.filter((t) => t !== tool);
                    patch({ tools: next.length === allTools.length ? [] : next });
                  }}
                />
                <span className="font-mono text-xs">{tool}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
