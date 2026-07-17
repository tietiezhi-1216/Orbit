import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/features/settings/settings-section";
import {
  errorMessage,
  listArchivedConversations,
} from "@/lib/api";
import { useChatStore } from "@/stores/chat";
import { useProjectStore } from "@/stores/projects";

const archiveDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function ArchivedTasksSection() {
  const projects = useProjectStore((state) => state.projects);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const archivedQuery = useQuery({
    queryKey: ["archivedConversations"],
    queryFn: listArchivedConversations,
  });
  const tasks = archivedQuery.data ?? [];
  const pendingTask = tasks.find((task) => task.id === pendingDeleteId);
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  const handleRestore = async (id: string) => {
    setWorkingId(id);
    setActionError("");
    try {
      await useChatStore.getState().restoreArchived(id);
      await archivedQuery.refetch();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setWorkingId(null);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    setWorkingId(id);
    setActionError("");
    try {
      await useChatStore.getState().deleteArchived(id);
      await archivedQuery.refetch();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setWorkingId(null);
      setPendingDeleteId(null);
    }
  };

  return (
    <SettingsSection
      title="已归档任务"
      description="归档会从侧边栏隐藏任务，但完整消息和工作目录仍会保留。恢复后任务会重新出现在原项目中。"
    >
      {archivedQuery.isPending ? (
        <p className="text-muted-foreground py-8 text-center text-sm">正在加载…</p>
      ) : archivedQuery.isError ? (
        <p className="text-destructive py-8 text-center text-sm">
          {errorMessage(archivedQuery.error)}
        </p>
      ) : tasks.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
          <Archive className="size-8 opacity-40" />
          <span>暂无已归档任务</span>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 px-3 py-3">
              <Archive className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{task.title}</p>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {task.projectId
                    ? (projectNames.get(task.projectId) ?? "已移除项目")
                    : "无项目"}
                  {task.archivedAt > 0 &&
                    ` · ${archiveDateFormatter.format(new Date(task.archivedAt))}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="恢复任务"
                  aria-label={`恢复 ${task.title}`}
                  disabled={workingId != null}
                  onClick={() => void handleRestore(task.id)}
                >
                  <RotateCcw />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="永久删除"
                  aria-label={`永久删除 ${task.title}`}
                  disabled={workingId != null}
                  onClick={() => setPendingDeleteId(task.id)}
                  className="hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {actionError && <p className="text-destructive text-sm">{actionError}</p>}

      <AlertDialog
        open={pendingDeleteId != null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>永久删除这个任务？</AlertDialogTitle>
            <AlertDialogDescription>
              「{pendingTask?.title ?? "任务"}」的消息和工作目录将被永久删除，无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDeleteId != null) {
                  void handlePermanentDelete(pendingDeleteId);
                }
              }}
            >
              永久删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}
