import { useMemo, useState } from "react";
import {
  Ban,
  Clapperboard,
  Clock3,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCcw,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { CreateMode, CreateTask, CreateTaskStatus } from "@/stores/create";
import { useCreateStore } from "@/stores/create";
import { CreateAssetPreview } from "./create-asset-preview";
import { CreateComposer } from "./create-composer";

type TaskFilter = "all" | CreateMode;

const STATUS_META: Record<
  CreateTaskStatus,
  { label: string; className: string }
> = {
  queued: { label: "排队中", className: "border-sky-400/15 bg-sky-400/8 text-sky-300" },
  running: { label: "生成中", className: "border-cyan-400/15 bg-cyan-400/8 text-cyan-300" },
  done: { label: "已完成", className: "border-emerald-400/15 bg-emerald-400/8 text-emerald-300" },
  error: { label: "生成失败", className: "border-rose-400/15 bg-rose-400/8 text-rose-300" },
  cancelled: { label: "已取消", className: "border-white/8 bg-white/5 text-white/45" },
};

export function CreateGenerations() {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const tasks = useCreateStore((state) => state.tasks);
  const assets = useCreateStore((state) => state.assets);
  const retryTask = useCreateStore((state) => state.retryTask);
  const cancelTask = useCreateStore((state) => state.cancelTask);
  const reuseTask = useCreateStore((state) => state.reuseTask);
  const visibleTasks = useMemo(
    () => tasks.filter((task) => filter === "all" || task.mode === filter),
    [filter, tasks],
  );

  return (
    <div className="h-full overflow-y-auto bg-[#0d0e11] text-white">
      <div className="mx-auto w-full max-w-[92rem] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-[0.18em] text-cyan-300/70 uppercase">
              Generation
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">生成记录</h1>
            <p className="mt-2 text-sm text-white/36">查看进度、重试任务，或基于历史描述继续创作。</p>
          </div>
          <div className="w-full xl:max-w-2xl">
            <CreateComposer compact />
          </div>
        </div>

        <div className="mt-8 flex gap-1 border-b border-white/7 pb-3">
          {([
            ["all", "全部"],
            ["image", "图片"],
            ["video", "视频"],
          ] as const).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilter(id)}
              className={cn(
                "rounded-xl px-4 text-white/42 hover:bg-white/6 hover:text-white",
                filter === id && "bg-white/9 text-white hover:bg-white/9",
              )}
            >
              {label}
            </Button>
          ))}
        </div>

        {visibleTasks.length === 0 ? (
          <div className="grid min-h-96 place-items-center">
            <div className="max-w-sm text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-white/7 bg-white/4">
                <Sparkles className="size-5 text-white/35" />
              </span>
              <h2 className="mt-4 text-sm font-semibold">还没有生成记录</h2>
              <p className="mt-1 text-xs leading-5 text-white/35">在上方描述想法，第一条任务会出现在这里。</p>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {visibleTasks.map((task) => {
              const asset = assets.find((candidate) => task.assetIds.includes(candidate.id));
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  asset={asset}
                  onRetry={() => void retryTask(task.id)}
                  onCancel={() => void cancelTask(task.id)}
                  onReuse={() => reuseTask(task.id)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  asset,
  onRetry,
  onCancel,
  onReuse,
}: {
  task: CreateTask;
  asset?: ReturnType<typeof useCreateStore.getState>["assets"][number];
  onRetry: () => void;
  onCancel: () => void;
  onReuse: () => void;
}) {
  const Icon = task.mode === "image" ? ImageIcon : Clapperboard;
  const active = task.status === "queued" || task.status === "running";
  const status = STATUS_META[task.status];

  return (
    <article className="overflow-hidden rounded-2xl border border-white/7 bg-[#15171b]">
      <div className="grid min-h-44 grid-cols-[8.5rem_minmax(0,1fr)] sm:grid-cols-[11rem_minmax(0,1fr)]">
        {asset ? (
          <CreateAssetPreview
            mode={asset.mode}
            filePath={asset.filePath}
            previewDataUrl={asset.previewDataUrl}
            alt={asset.title}
            className="h-full min-h-44"
          />
        ) : (
          <div className="relative grid min-h-44 place-items-center overflow-hidden bg-[#101216]">
            <span className="absolute -top-8 -left-8 size-28 rounded-full bg-cyan-400/10 blur-3xl" />
            <span className="absolute -right-8 -bottom-8 size-32 rounded-full bg-blue-500/12 blur-3xl" />
            {active ? (
              <LoaderCircle className="relative size-5 animate-spin text-cyan-300/65" />
            ) : (
              <Icon className="relative size-6 text-white/28" />
            )}
          </div>
        )}

        <div className="flex min-w-0 flex-col p-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("rounded-lg", status.className)}>
              {active && <LoaderCircle className="size-3 animate-spin" />}
              {status.label}
            </Badge>
            <span className="ml-auto flex items-center gap-1 text-[10px] text-white/28">
              <Clock3 className="size-3" />
              {formatRelativeTime(task.createdAt)}
            </span>
          </div>
          <p className="mt-3 line-clamp-3 text-xs leading-5 text-white/72">{task.prompt}</p>
          <p className="mt-2 truncate text-[10px] text-white/28">
            {task.model || "自动匹配模型"} · {task.aspectRatio}
            {task.mode === "video" ? ` · ${task.durationSeconds}s` : ` · ${task.resultCount} 张`}
          </p>

          {active && (
            <div className="mt-auto pt-4">
              <div className="mb-1.5 flex items-center justify-between text-[10px] text-white/35">
                <span>{task.status === "queued" ? "等待模型响应" : "正在生成作品"}</span>
                <span>{task.progress}%</span>
              </div>
              <progress
                max={100}
                value={task.progress}
                className="h-1.5 w-full appearance-none overflow-hidden rounded-full bg-white/7 [&::-webkit-progress-bar]:bg-white/7 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-cyan-300"
              />
            </div>
          )}

          {task.error && (
            <p className="mt-3 line-clamp-2 text-[10px] leading-4 text-rose-300/75">{task.error}</p>
          )}

          <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
            {active && task.mode === "video" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 rounded-lg text-[10px] text-white/50 hover:bg-white/7 hover:text-white"
                onClick={onCancel}
              >
                <Ban className="size-3" />
                取消
              </Button>
            ) : !active ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-lg text-[10px] text-white/50 hover:bg-white/7 hover:text-white"
                  onClick={onReuse}
                >
                  <RotateCcw className="size-3" />
                  再次创作
                </Button>
                {(task.status === "error" || task.status === "cancelled") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-lg text-[10px] text-white/50 hover:bg-white/7 hover:text-white"
                    onClick={onRetry}
                  >
                    <RefreshCcw className="size-3" />
                    重试
                  </Button>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
