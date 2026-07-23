import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  Code2,
  FileOutput,
  Files,
  GitBranch,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  errorMessage,
  taskWorkspaceOverview,
  transferTaskWorkspaceFile,
} from "@/lib/api";
import type { WorkspaceFileEntry } from "@/lib/api";
import { getTaskMode } from "@/lib/task-mode";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat";

const formatBytes = (bytes: number): string => {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_024 / 1_024).toFixed(1)} MB`;
};

export function WorkspaceModePanel() {
  const queryClient = useQueryClient();
  const activeId = useChatStore((state) => state.activeId);
  const taskMode = useChatStore((state) => state.taskMode);
  const streaming = useChatStore((state) => state.streaming);
  const [importingPath, setImportingPath] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const definition = getTaskMode(taskMode);
  const otherMode = taskMode === "work" ? "code" : "work";
  const otherDefinition = getTaskMode(otherMode);
  const Icon = taskMode === "work" ? BriefcaseBusiness : Code2;

  const overviewQuery = useQuery({
    queryKey: ["task-workspace-overview", activeId],
    queryFn: () => taskWorkspaceOverview(activeId!),
    enabled: activeId != null,
    refetchInterval: streaming ? 1_500 : false,
  });
  const overview = overviewQuery.data;
  const activeStatus = overview?.[taskMode];
  const otherStatus = overview?.[otherMode];
  const resultFiles: WorkspaceFileEntry[] =
    taskMode === "work"
      ? (activeStatus?.deliverables ?? [])
      : (activeStatus?.changedFiles ?? []).map((path) => ({
          path,
          size: 0,
          modifiedAt: 0,
        }));

  const statusText = activeStatus?.initialized
    ? taskMode === "work"
      ? `${activeStatus.deliverables.length} 个成果 · ${activeStatus.fileCount}${activeStatus.fileCountCapped ? "+" : ""} 个文件`
      : activeStatus.isGit
        ? `${activeStatus.changedFiles.length} 项变更 · ${activeStatus.fileCount}${activeStatus.fileCountCapped ? "+" : ""} 个文件`
        : `普通目录 · ${activeStatus.fileCount}${activeStatus.fileCountCapped ? "+" : ""} 个文件`
    : activeId
      ? `${definition.name} 空间将在首次执行时创建`
      : "发送第一条消息后创建独立空间";

  useEffect(() => {
    setFeedback(null);
  }, [activeId, taskMode]);

  useEffect(() => {
    if (activeId && !streaming) void overviewQuery.refetch();
  }, [activeId, streaming]);

  const importFile = async (file: WorkspaceFileEntry) => {
    if (!activeId || importingPath) return;
    setImportingPath(file.path);
    setFeedback(null);
    try {
      const destination = await transferTaskWorkspaceFile({
        taskId: activeId,
        fromMode: otherMode,
        toMode: taskMode,
        path: file.path,
      });
      setFeedback({ kind: "success", text: `已导入到 ${destination}` });
      await queryClient.invalidateQueries({
        queryKey: ["task-workspace-overview", activeId],
      });
    } catch (error) {
      setFeedback({ kind: "error", text: errorMessage(error) });
    } finally {
      setImportingPath(null);
    }
  };

  return (
    <section
      className={cn(
        "relative z-10 mx-1 mb-2 overflow-hidden rounded-xl border px-3 py-2.5 shadow-sm",
        taskMode === "work"
          ? "border-cyan-500/20 bg-cyan-500/[0.045]"
          : "border-violet-500/20 bg-violet-500/[0.045]",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg border",
            taskMode === "work"
              ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
              : "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">{definition.name}</span>
            <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-normal">
              {taskMode === "work" ? "无通用终端" : "终端可用"}
            </Badge>
          </div>
          <p className="text-muted-foreground truncate text-[11px]">
            {definition.description} · {statusText}
          </p>
        </div>
        {activeId && overviewQuery.isFetching && (
          <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
        )}

        {resultFiles.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-[11px]">
                {taskMode === "work" ? <FileOutput /> : <GitBranch />}
                {taskMode === "work" ? "成果" : "变更"}
                <span className="text-muted-foreground">{resultFiles.length}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="w-80 p-2">
              <ModeFileList
                title={taskMode === "work" ? "Work 成果" : "Code 变更"}
                files={resultFiles}
                showSize={taskMode === "work"}
              />
            </PopoverContent>
          </Popover>
        )}

        {activeId && otherStatus?.initialized && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-[11px]">
                <ArrowLeftRight /> 从 {otherDefinition.name} 导入
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="w-96 p-2">
              <p className="px-2 pt-1 pb-2 text-xs font-medium">
                从独立 {otherDefinition.name} 空间导入
              </p>
              {otherStatus.transferableFiles.length === 0 ? (
                <p className="text-muted-foreground px-2 py-4 text-center text-xs">
                  {otherMode === "work" ? "暂时没有可交接成果" : "暂时没有代码变更"}
                </p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {otherStatus.transferableFiles.map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      disabled={importingPath != null || streaming}
                      onClick={() => void importFile(file)}
                      className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-2 text-left disabled:opacity-50"
                    >
                      {importingPath === file.path ? (
                        <Loader2 className="size-3.5 shrink-0 animate-spin" />
                      ) : (
                        <Files className="text-muted-foreground size-3.5 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-xs">{file.path}</span>
                      <span className="text-muted-foreground shrink-0 text-[10px]">
                        {formatBytes(file.size)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-muted-foreground border-t px-2 pt-2 text-[10px] leading-4">
                文件会复制到当前空间的 `.tietiezhi/imports/{otherMode}`，不会覆盖现有项目文件。
              </p>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5 overflow-hidden">
        {definition.capabilities.map((capability) => (
          <span
            key={capability}
            className="bg-background/70 text-muted-foreground rounded-md border px-1.5 py-0.5 text-[10px]"
          >
            {capability}
          </span>
        ))}
        <span className="text-muted-foreground ml-auto truncate text-[10px]">
          {definition.toolSummary}
        </span>
      </div>
      {feedback && (
        <p
          className={cn(
            "text-muted-foreground mt-1.5 flex items-center gap-1 text-[10px]",
            feedback.kind === "error" && "text-destructive",
          )}
        >
          {feedback.kind === "success" ? (
            <CheckCircle2 className="size-3" />
          ) : (
            <CircleAlert className="size-3" />
          )}
          <span className="truncate">{feedback.text}</span>
        </p>
      )}
    </section>
  );
}

function ModeFileList({
  title,
  files,
  showSize,
}: {
  title: string;
  files: WorkspaceFileEntry[];
  showSize: boolean;
}) {
  return (
    <div>
      <p className="px-2 pt-1 pb-2 text-xs font-medium">{title}</p>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {files.map((file) => (
          <div key={file.path} className="flex items-center gap-2 rounded-md px-2 py-1.5">
            <Files className="text-muted-foreground size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-xs">{file.path}</span>
            {showSize && (
              <span className="text-muted-foreground shrink-0 text-[10px]">
                {formatBytes(file.size)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
