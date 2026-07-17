import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { defaultPolishPrompt, loadSettings, saveSettings } from "@/lib/api";
import { SettingsSection } from "@/features/settings/settings-section";

/** Dictation → 提示词：the editable polish template. */
export function DictationPromptSection() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: loadSettings });
  const defaultQuery = useQuery({
    queryKey: ["defaultPolishPrompt"],
    queryFn: defaultPolishPrompt,
    staleTime: Infinity,
  });

  const settings = settingsQuery.data;
  const builtin = defaultQuery.data ?? "";
  const [draft, setDraft] = useState<string | null>(null);

  // Seed the editor once both the stored value and the built-in default arrive.
  useEffect(() => {
    if (draft == null && settings && defaultQuery.isSuccess) {
      setDraft(settings.polishPrompt.trim() ? settings.polishPrompt : builtin);
    }
  }, [draft, settings, defaultQuery.isSuccess, builtin]);

  const save = useMutation({
    mutationFn: async (prompt: string) => {
      if (!settings) return;
      // Storing the built-in verbatim just means "use the default".
      const polishPrompt = prompt.trim() === builtin.trim() ? "" : prompt;
      await saveSettings({ ...settings, polishPrompt });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const dirty = draft != null && settings != null &&
    draft !== (settings.polishPrompt.trim() ? settings.polishPrompt : builtin);

  return (
    <SettingsSection>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="polish-prompt">润色提示词</Label>
          <Textarea
            id="polish-prompt"
            value={draft ?? ""}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className="min-h-72 font-mono text-xs leading-relaxed"
          />
          <p className="text-muted-foreground text-xs leading-relaxed">
            这是润色模型的系统提示词，原始转写会作为独立的用户消息送入。无论怎么改，「只整理、绝不回答转写里的问题」这条任务边界都会自动附加，不会被覆盖。
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
