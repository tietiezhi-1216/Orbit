import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { loadSettings, saveSettings } from "@/lib/api";
import type { PermissionMode } from "@/lib/api";
import { SettingsSection } from "@/features/settings/settings-section";

const OPTIONS: { value: PermissionMode; label: string; hint: string }[] = [
  {
    value: "ask",
    label: "请求批准",
    hint: "所有写文件、执行命令等操作都先在对话里询问你。最安全，也最频繁。",
  },
  {
    value: "auto",
    label: "智能审核（推荐）",
    hint: "只读操作与工作区内的文件写入直接放行；危险命令（删除、提权、越界路径等）仍会询问。",
  },
  {
    value: "full",
    label: "完全访问",
    hint: "所有工具直接执行，不再询问。仅在完全信任当前任务时使用。",
  },
];

/** 智能体 → 权限：default permission mode for agent-less chats. */
export function PermissionSection() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: loadSettings });
  const settings = settingsQuery.data;

  const save = useMutation({
    mutationFn: async (permissionMode: PermissionMode) => {
      if (!settings) return;
      await saveSettings({ ...settings, permissionMode });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  const current = settings?.permissionMode ?? "auto";

  return (
    <SettingsSection>
      <div className="flex max-w-md flex-col gap-2">
        <Label>默认权限模式</Label>
        <Select
          value={current}
          onValueChange={(v) => save.mutate(v as PermissionMode)}
          disabled={!settings}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {OPTIONS.find((o) => o.value === current)?.hint}
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          对没有绑定智能体的普通对话生效；每个智能体可以在自己的配置里单独设定权限模式。
        </p>
      </div>
    </SettingsSection>
  );
}
