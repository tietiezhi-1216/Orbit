import { Box, ChevronDown, Folder, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { errorMessage, pickWorkspaceDir } from "@/lib/api";
import { useChatStore } from "@/stores/chat";

/** Chat-header badge showing the conversation's working directory. */
export function WorkspaceIndicator() {
  const workspace = useChatStore((s) => s.workspace);
  const setWorkspace = useChatStore((s) => s.setWorkspace);

  const tail = workspace.split(/[\\/]/).filter(Boolean).pop() ?? "";

  const pick = async () => {
    try {
      const dir = await pickWorkspaceDir();
      if (dir) setWorkspace(dir);
    } catch (err) {
      console.error("选择工作目录失败：", errorMessage(err));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 gap-1.5 px-2"
          title={workspace || "虚拟工作区（应用数据目录内的临时文件夹）"}
        >
          {workspace ? <Folder className="size-3.5" /> : <Box className="size-3.5" />}
          <span className="max-w-32 truncate text-xs">{tail || "虚拟工作区"}</span>
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => void pick()}>
          <FolderOpen className="size-3.5" />
          选择文件夹…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setWorkspace("")}>
          <Box className="size-3.5" />
          使用虚拟工作区
        </DropdownMenuItem>
        {workspace && (
          <div className="text-muted-foreground truncate px-2 py-1.5 text-[11px]">
            {workspace}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
