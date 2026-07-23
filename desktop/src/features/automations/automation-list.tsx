import { useMemo, useState } from "react";
import {
  Archive,
  CalendarClock,
  History,
  MoreHorizontal,
  MousePointerClick,
  Plus,
  Search,
  Trash2,
  Workflow,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ProductMotionStage } from "@/components/product-motion-stage";
import { ProductMascotMotion } from "@/components/product-mascot-motion";
import { Skeleton } from "@/components/ui/skeleton";
import type { AutomationMeta } from "@/lib/api";
import { formatRelativeTime } from "@/lib/relative-time";
import { useAutomationStore } from "@/stores/automations";

export function AutomationList() {
  const automations = useAutomationStore((state) => state.automations);
  const loading = useAutomationStore((state) => state.loading);
  const create = useAutomationStore((state) => state.create);
  const open = useAutomationStore((state) => state.open);
  const archive = useAutomationStore((state) => state.archive);
  const remove = useAutomationStore((state) => state.remove);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AutomationMeta | null>(null);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return automations;
    return automations.filter((item) =>
      `${item.name} ${item.description}`.toLocaleLowerCase().includes(needle),
    );
  }, [automations, query]);

  return (
    <main className="h-full overflow-auto bg-muted/15">
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 sm:grid-cols-[minmax(0,1fr)_14rem_auto]">
          <div className="col-start-1 row-start-1">
            <h1 className="text-2xl font-semibold tracking-tight">工作流</h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              编排 Agent、Skills、MCP 和本地工具。
            </p>
          </div>
          <ProductMotionStage
            variant="automations"
            className="col-span-2 row-start-2 h-24 w-full sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:h-32 sm:w-56"
            mascotClassName="size-20 sm:size-24"
          >
            <ProductMascotMotion
              src="/mode-mascots/paper-plane/automations.png"
              variant="automations"
              intensity="stage"
              className="absolute inset-0 size-full"
            />
          </ProductMotionStage>
          <Button
            type="button"
            className="col-start-2 row-start-1 sm:col-start-3"
            onClick={() => void create()}
          >
            <Plus />
            新建工作流
          </Button>
        </header>

        <nav className="mt-7 flex items-center gap-1 border-b" aria-label="Automation 导航">
          <button
            type="button"
            className="border-foreground flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium"
          >
            <Workflow className="size-4" />
            工作流
            <span className="bg-muted rounded px-1.5 py-0.5 text-[10px] tabular-nums">
              {automations.length}
            </span>
          </button>
          <button
            type="button"
            disabled
            title="执行引擎将在 M2 接入"
            className="text-muted-foreground flex h-10 items-center gap-2 px-3 text-sm disabled:opacity-50"
          >
            <History className="size-4" />
            运行记录
          </button>
        </nav>

        <section className="mt-5 overflow-hidden rounded-xl border bg-background">
          <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-medium">全部工作流</h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                草稿保存在当前设备
              </p>
            </div>
            <InputGroup className="sm:w-64">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索工作流"
                aria-label="搜索工作流"
              />
            </InputGroup>
          </div>

          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="grid min-h-64 place-items-center p-8 text-center">
              <div className="max-w-sm">
                <span className="bg-muted mx-auto grid size-10 place-items-center rounded-lg border">
                  <Workflow className="text-muted-foreground size-4" />
                </span>
                <h3 className="mt-3 text-sm font-medium">
                  {query ? "没有匹配的工作流" : "还没有工作流"}
                </h3>
                <p className="text-muted-foreground mt-1.5 text-xs leading-5">
                  {query
                    ? "尝试使用其它名称或描述搜索。"
                    : "创建后，从触发器开始拖入需要的节点。"}
                </p>
                {!query && (
                  <Button size="sm" className="mt-4" onClick={() => void create()}>
                    <Plus />
                    新建工作流
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {visible.map((item) => {
                const TriggerIcon =
                  item.triggerType === "scheduleTrigger"
                    ? CalendarClock
                    : MousePointerClick;
                return (
                  <div
                    key={item.id}
                    className="hover:bg-muted/35 group flex items-center gap-3 px-4 py-3 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => void open(item.id)}
                      className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span className="bg-muted grid size-9 shrink-0 place-items-center rounded-md border">
                        <TriggerIcon className="text-muted-foreground size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{item.name}</span>
                          <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                            草稿
                          </Badge>
                        </span>
                        <span className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 text-xs">
                          <span>{triggerLabel(item.triggerType)}</span>
                          <span>{item.nodeCount} 个节点</span>
                          <span>{formatRelativeTime(item.updatedAt) ?? "刚刚"}</span>
                        </span>
                      </span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${item.name} 操作`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => void archive(item.id)}>
                          <Archive />
                          归档
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setDeleteTarget(item)}
                        >
                          <Trash2 />
                          永久删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>永久删除 Automation？</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.name}”的草稿与未来运行记录都将被删除，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteTarget) void remove(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function triggerLabel(type: string): string {
  if (type === "manualTrigger") return "手动触发";
  if (type === "scheduleTrigger") return "定时触发";
  return "未配置触发器";
}
