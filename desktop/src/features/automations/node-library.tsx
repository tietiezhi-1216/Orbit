import { useMemo, useState } from "react";
import { GripVertical, Search, X } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AutomationNodeType } from "@/lib/api";
import {
  AUTOMATION_CATEGORIES,
  AUTOMATION_CATEGORY_LABELS,
  AUTOMATION_NODE_DEFINITIONS,
  type AutomationCanvasNode,
} from "@/lib/automation";
import { cn } from "@/lib/utils";
import { useAutomationStore } from "@/stores/automations";
import {
  AUTOMATION_CATEGORY_ICON,
  AUTOMATION_NODE_ICONS,
  FALLBACK_AUTOMATION_NODE_ICON,
} from "@/features/automations/node-visuals";

export const AUTOMATION_NODE_DRAG_TYPE = "application/x-tietiezhi-automation-node";

export function NodeLibrary({ onClose }: { onClose?: () => void }) {
  const [query, setQuery] = useState("");
  const addNode = useAutomationStore((state) => state.addNode);
  const nodeCount = useAutomationStore((state) => state.document?.nodes.length ?? 0);
  const { screenToFlowPosition } = useReactFlow<AutomationCanvasNode>();
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return AUTOMATION_NODE_DEFINITIONS;
    return AUTOMATION_NODE_DEFINITIONS.filter((definition) =>
      `${definition.title} ${definition.description} ${definition.type}`
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [query]);

  const addAtCanvasCenter = (type: AutomationNodeType) => {
    const bounds = globalThis.document
      .querySelector<HTMLElement>("[data-automation-canvas]")
      ?.getBoundingClientRect();
    const screenPosition = bounds
      ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
      : { x: globalThis.innerWidth / 2, y: globalThis.innerHeight / 2 };
    const position = screenToFlowPosition(screenPosition);
    const offset = (nodeCount % 4) * 18;
    addNode(type, { x: position.x + offset, y: position.y + offset });
  };

  return (
    <aside className="bg-popover flex h-full min-h-0 w-full flex-col text-popover-foreground">
      <div className="border-b px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">节点</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              拖到画布中的目标位置
            </p>
          </div>
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="关闭节点面板"
              onClick={onClose}
            >
              <X />
            </Button>
          )}
        </div>
        <InputGroup className="mt-3">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="按名称或能力搜索"
            aria-label="搜索 Automation 节点"
          />
        </InputGroup>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-3">
          {AUTOMATION_CATEGORIES.map((category) => {
            const definitions = visible.filter(
              (definition) => definition.category === category,
            );
            if (definitions.length === 0) return null;
            return (
              <section key={category}>
                <h2 className="text-muted-foreground mb-1.5 px-2 text-[10px] font-medium tracking-[0.12em] uppercase">
                  {AUTOMATION_CATEGORY_LABELS[category]}
                </h2>
                <div className="space-y-1">
                  {definitions.map((definition) => {
                    const Icon =
                      AUTOMATION_NODE_ICONS[definition.type] ??
                      FALLBACK_AUTOMATION_NODE_ICON;
                    return (
                      <button
                        key={definition.type}
                        type="button"
                        draggable
                        aria-label={`拖拽或添加 ${definition.title}`}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            AUTOMATION_NODE_DRAG_TYPE,
                            definition.type,
                          );
                          event.dataTransfer.setData("text/plain", definition.type);
                          event.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => addAtCanvasCenter(definition.type)}
                        className="hover:bg-accent focus-visible:ring-ring group flex w-full cursor-grab items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"
                      >
                        <span
                          className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-md",
                            AUTOMATION_CATEGORY_ICON[definition.category],
                          )}
                        >
                          <Icon className="size-4" strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium">
                            {definition.title}
                          </span>
                          <span className="text-muted-foreground mt-0.5 block truncate text-[10px]">
                            {definition.description}
                          </span>
                        </span>
                        <GripVertical className="text-muted-foreground/50 size-4 shrink-0 opacity-40 transition-opacity group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
