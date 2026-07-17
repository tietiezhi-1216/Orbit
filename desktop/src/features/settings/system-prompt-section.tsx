import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { defaultSystemPrompt, loadSettings, saveSettings } from "@/lib/api";
import { SettingsSection } from "@/features/settings/settings-section";

/** 智能体 → 系统提示词：the editable default chat system prompt. */
export function SystemPromptSection() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: loadSettings });
  const defaultQuery = useQuery({
    queryKey: ["defaultSystemPrompt"],
    queryFn: defaultSystemPrompt,
    staleTime: Infinity,
  });

  const settings = settingsQuery.data;
  const builtin = defaultQuery.data ?? "";
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    if (draft == null && settings && defaultQuery.isSuccess) {
      setDraft(settings.systemPrompt.trim() ? settings.systemPrompt : builtin);
    }
  }, [draft, settings, defaultQuery.isSuccess, builtin]);

  const save = useMutation({
    mutationFn: async (prompt: string) => {
      if (!settings) return;
      // Storing the built-in verbatim just means "use the default".
      const systemPrompt = prompt.trim() === builtin.trim() ? "" : prompt;
      await saveSettings({ ...settings, systemPrompt });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  const dirty =
    draft != null &&
    settings != null &&
    draft !== (settings.systemPrompt.trim() ? settings.systemPrompt : builtin);

  return (
    <SettingsSection>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="system-prompt">默认系统提示词</Label>
          <Textarea
            id="system-prompt"
            value={draft ?? ""}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className="min-h-72 font-mono text-xs leading-relaxed"
          />
          <p className="text-muted-foreground text-xs leading-relaxed">
            对所有普通对话生效；智能体如果设置了自己的提示词则以智能体为准。工作区路径与已启用技能清单会自动附加在末尾。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => draft != null && save.mutate(draft)}
            disabled={!dirty || save.isPending}
          >
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            保存
          </Button>
          <Button
            variant="outline"
            onClick={() => setDraft(builtin)}
            disabled={draft === builtin}
          >
            <RotateCcw /> 恢复默认
          </Button>
          {save.isSuccess && !dirty && (
            <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 /> 已保存
            </Badge>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}
