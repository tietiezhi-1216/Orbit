import { useState } from "react";
import { Folder, FolderPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { errorMessage, pickWorkspaceDir } from "@/lib/api";
import { useChatStore } from "@/stores/chat";
import { useProjectStore } from "@/stores/projects";

export function ProjectSelect() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const projects = useProjectStore((state) => state.projects);
  const addProject = useProjectStore((state) => state.add);
  const markUsed = useProjectStore((state) => state.markUsed);
  const projectId = useChatStore((state) => state.projectId);
  const items = useChatStore((state) => state.items);
  const streaming = useChatStore((state) => state.streaming);
  const setProject = useChatStore((state) => state.setProject);

  const selected = projects.find((project) => project.id === projectId);
  const locked = items.length > 0 || streaming;

  const select = (id: string) => {
    setProject(id);
    setError("");
    setOpen(false);
    if (id) void markUsed(id);
  };

  const add = async () => {
    setError("");
    try {
      const path = await pickWorkspaceDir();
      if (!path) return;
      const project = await addProject(path);
      select(project.id);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={locked}
          title={locked ? "任务开始后不能更换项目" : "选择项目"}
          className="text-muted-foreground hover:text-foreground h-7 max-w-56 justify-start gap-1.5 rounded-lg px-2 text-xs font-normal"
        >
          <Folder className="size-3.5" />
          <span className="truncate">{selected?.name ?? "选择项目"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="搜索最近项目" />
          <CommandList>
            <CommandEmpty>没有匹配的项目</CommandEmpty>
            <CommandGroup heading="最近项目">
              <CommandItem
                value="不使用项目"
                data-checked={!projectId}
                onSelect={() => select("")}
              >
                <X />
                <span>不使用项目</span>
              </CommandItem>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={`${project.name} ${project.rootPath}`}
                  data-checked={project.id === projectId}
                  onSelect={() => select(project.id)}
                >
                  <Folder />
                  <span className="truncate">{project.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem value="添加项目" onSelect={() => void add()}>
                <FolderPlus />
                <span>添加项目</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
          {error && (
            <p className="text-destructive border-t px-3 py-2 text-xs">{error}</p>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
