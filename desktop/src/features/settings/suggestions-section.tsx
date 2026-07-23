import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { SettingsSection } from "@/features/settings/settings-section";
import { loadSettings, saveSettings } from "@/lib/api";

export function SuggestionsSection() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: loadSettings });
  const settings = settingsQuery.data;
  const update = useMutation({
    mutationFn: async (patch: {
      smartSuggestionsEnabled?: boolean;
      smartSuggestionsAllowPaidModels?: boolean;
    }) => {
      if (!settings) return;
      await saveSettings({ ...settings, ...patch });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
  const enabled = settings?.smartSuggestionsEnabled ?? true;

  return (
    <SettingsSection>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="smart-suggestions-enabled">智能任务建议</Label>
          <p className="text-muted-foreground text-xs leading-relaxed">
            在工作区展示四个结合工作模式、仓库和近期任务生成的灵感。窗口启动只读取缓存，不会因此调用模型。
          </p>
        </div>
        <Switch
          id="smart-suggestions-enabled"
          className="mt-0.5 shrink-0"
          checked={enabled}
          disabled={!settings || update.isPending}
          onCheckedChange={(checked) =>
            update.mutate({ smartSuggestionsEnabled: checked })
          }
        />
      </div>
      <Separator />
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="smart-suggestions-paid">允许使用自有渠道后台更新</Label>
          <p className="text-muted-foreground text-xs leading-relaxed">
            默认仅使用内置免费 Gateway。开启后，在没有可用免费模型时可以使用当前自有渠道，可能产生少量 Token 费用。
          </p>
        </div>
        <Switch
          id="smart-suggestions-paid"
          className="mt-0.5 shrink-0"
          checked={settings?.smartSuggestionsAllowPaidModels ?? false}
          disabled={!settings || !enabled || update.isPending}
          onCheckedChange={(checked) =>
            update.mutate({ smartSuggestionsAllowPaidModels: checked })
          }
        />
      </div>
      <Separator />
      <p className="text-muted-foreground text-xs leading-relaxed">
        建议在任务完成后的空闲阶段更新。同一项目和模式会复用缓存，并限制刷新频率；点击建议只会把完整提示词放入输入框。
      </p>
    </SettingsSection>
  );
}
