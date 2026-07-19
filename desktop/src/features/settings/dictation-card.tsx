import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { loadSettings, saveSettings } from "@/lib/api";
import type { AppSettings, ModelKind } from "@/lib/api";
import { effectiveModelKind } from "@/lib/model-capabilities";
import { SettingsSection } from "@/features/settings/settings-section";

const OUTPUT_LANGUAGES: { value: string; label: string }[] = [
  { value: "auto", label: "跟随输入" },
  { value: "zhCn", label: "简体中文" },
  { value: "zhTw", label: "繁體中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
];

const encode = (providerId: string, model: string) => `${providerId}::${model}`;

/** Dictation → 模型：which model transcribes, which polishes, output language. */
export function DictationModelSection() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: loadSettings });
  const settings = settingsQuery.data;

  const patch = async (next: Partial<AppSettings>) => {
    if (!settings) return;
    await saveSettings({ ...settings, ...next });
    void queryClient.invalidateQueries({ queryKey: ["settings"] });
  };

  if (!settings) return null;
  const providers = settings.providers;

  return (
    <SettingsSection>
      <div className="flex flex-col gap-5">
        <ProviderModelPicker
          label="语音识别（ASR）"
          kind="asr"
          hint="只列出语音识别模型，例如小米 MiMo 的 mimo-v2.5-asr。"
          providers={providers}
          providerId={settings.asrProviderId}
          model={settings.asrModel}
          onChange={(asrProviderId, asrModel) => void patch({ asrProviderId, asrModel })}
        />

        <div className="flex flex-col gap-2">
          <Label>识别后润色</Label>
          <div className="flex gap-2">
            <Button
              variant={settings.polishEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => void patch({ polishEnabled: true })}
            >
              {settings.polishEnabled && <Check />} 开启
            </Button>
            <Button
              variant={!settings.polishEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => void patch({ polishEnabled: false })}
            >
              {!settings.polishEnabled && <Check />} 关闭
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            长按快捷键（按住说话）时始终不润色，直接输出原始转写。
          </p>
        </div>

        {settings.polishEnabled && (
          <>
            <ProviderModelPicker
              label="润色模型"
              kind="chat"
              providers={providers}
              providerId={settings.polishProviderId}
              model={settings.polishModel}
              onChange={(polishProviderId, polishModel) =>
                void patch({ polishProviderId, polishModel })
              }
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="d-lang">输出语言</Label>
              <Select
                value={settings.outputLanguage || "auto"}
                onValueChange={(outputLanguage) => void patch({ outputLanguage })}
              >
                <SelectTrigger id="d-lang" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTPUT_LANGUAGES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
    </SettingsSection>
  );
}

/** A provider+model picker restricted to models of one capability. */
function ProviderModelPicker({
  label,
  kind,
  hint,
  providers,
  providerId,
  model,
  onChange,
}: {
  label: string;
  kind: ModelKind;
  hint?: string;
  providers: AppSettings["providers"];
  providerId: string;
  model: string;
  onChange: (providerId: string, model: string) => void;
}) {
  const current = providerId && model ? encode(providerId, model) : "";
  const options = providers.flatMap((p) =>
    p.models
      .filter((model) => effectiveModelKind(model) === kind)
      .map((m) => ({ providerId: p.id, providerName: p.name, model: m.id })),
  );

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {options.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {kind === "asr"
            ? "现有供应商里没有语音识别模型。请到「模型供应商」添加支持 ASR 的厂商（如小米 MiMo）并获取模型。"
            : "先到「模型供应商」添加供应商并获取模型，这里才能选择。"}
        </p>
      ) : (
        <Select
          value={current || undefined}
          onValueChange={(v) => {
            const [pid, m] = v.split("::");
            onChange(pid, m);
          }}
        >
          <SelectTrigger className="w-full max-w-md">
            <SelectValue placeholder="选择供应商与模型" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={encode(o.providerId, o.model)} value={encode(o.providerId, o.model)}>
                {o.providerName} · {o.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
