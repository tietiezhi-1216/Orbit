import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import {
  getAutomationNodeDefinition,
  type AutomationCanvasNode,
} from "@/lib/automation";
import type { AutomationNodeType } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  AUTOMATION_CATEGORY_HANDLE,
  AUTOMATION_CATEGORY_ICON,
  AUTOMATION_NODE_ICONS,
  FALLBACK_AUTOMATION_NODE_ICON,
} from "@/features/automations/node-visuals";

export const AutomationNodeCard = memo(function AutomationNodeCard({
  data,
  selected,
  dragging,
}: NodeProps<AutomationCanvasNode>) {
  const node = data.automationNode;
  const definition = getAutomationNodeDefinition(node.type);
  const category = definition?.category ?? "tool";
  const Icon =
    AUTOMATION_NODE_ICONS[node.type] ?? FALLBACK_AUTOMATION_NODE_ICON;
  const summary = getNodeSummary(node.type, node.config);

  return (
    <article
      className={cn(
        "relative w-60 overflow-visible text-card-foreground transition-opacity",
        node.disabled && "opacity-55",
      )}
    >
      {definition?.inputs.map((port) => (
        <Handle
          key={port.id}
          id={port.id}
          type="target"
          position={Position.Left}
          aria-label={port.label}
          className={cn(
            "!-left-1.5 !z-10 !size-3.5 !border-[3px] !border-background shadow-sm",
            AUTOMATION_CATEGORY_HANDLE[category],
          )}
        />
      ))}

      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-card shadow-[0_8px_24px_-18px_rgba(0,0,0,0.65)] transition-[border-color,box-shadow]",
          selected && "border-foreground/50 shadow-md ring-2 ring-foreground/10",
          dragging &&
            "border-foreground/45 shadow-lg ring-2 ring-foreground/10 transition-none",
        )}
      >
        <div className="flex items-start gap-3 px-3 py-3">
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg",
              AUTOMATION_CATEGORY_ICON[category],
            )}
          >
            <Icon className="size-4" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {node.name}
              </span>
              {node.disabled && (
                <Badge
                  variant="outline"
                  className="shrink-0 px-1.5 py-0 text-[10px]"
                >
                  停用
                </Badge>
              )}
            </span>
            <span className="text-muted-foreground mt-0.5 block truncate text-[10px]">
              {definition?.title ?? node.type}
            </span>
          </span>
        </div>

        <div className="border-t bg-muted/15 px-3 py-2.5">
          <p className="text-muted-foreground line-clamp-2 min-h-8 text-[11px] leading-4">
            {summary || definition?.description || "尚未配置"}
          </p>
          {definition &&
            (definition.inputs.length > 0 || definition.outputs.length > 0) && (
              <div className="text-muted-foreground/70 mt-2 flex items-center justify-between text-[9px]">
                <span>{definition.inputs[0]?.label ?? ""}</span>
                <span>
                  {definition.outputs.map((port) => port.label).join(" / ")}
                </span>
              </div>
            )}
        </div>
      </div>

      {definition?.outputs.map((port, index) => (
        <Handle
          key={port.id}
          id={port.id}
          type="source"
          position={Position.Right}
          aria-label={port.label}
          className={cn(
            "!-right-1.5 !left-auto !z-10 !size-3.5 !border-[3px] !border-background shadow-sm",
            AUTOMATION_CATEGORY_HANDLE[category],
            definition.outputs.length === 2 && index === 0 && "!top-[42%]",
            definition.outputs.length === 2 && index === 1 && "!top-[72%]",
          )}
        />
      ))}
    </article>
  );
});

function getNodeSummary(
  type: AutomationNodeType,
  config: Record<string, unknown>,
): string {
  const text = (key: string) =>
    typeof config[key] === "string" ? config[key].trim() : "";
  switch (type) {
    case "scheduleTrigger":
      return `${text("cron") || "未设置计划"} · ${text("timezone") || "本地时区"}`;
    case "model":
      return text("prompt") || "配置模型和指令";
    case "agent":
      return text("prompt") || "配置 Agent 任务";
    case "skill":
      return text("skillName") || "选择一个 Skill";
    case "mcpTool":
      return [text("serverId"), text("toolName")].filter(Boolean).join(" / ");
    case "builtinTool":
      return text("toolName") || "选择内置工具";
    case "code":
      return text("code") || "return input;";
    case "condition":
      return `${text("path") || "/"} · ${text("operator") || "equals"}`;
    case "merge":
      return text("strategy") === "any" ? "任一路径完成" : "等待全部路径";
    case "approval":
      return text("message") || "等待人工确认";
    case "manualTrigger":
      return "从测试输入启动";
    case "output":
      return "生成结构化运行结果";
    default:
      return "";
  }
}
