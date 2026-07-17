import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsSection } from "@/features/settings/settings-section";
import { loadSettings, saveSettings } from "@/lib/api";

const FOLLOW_CONVERSATION = "__follow_conversation__";
const encode = (providerId: string, model: string) => `${providerId}::${model}`;

export function TitleModelSection() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: loadSettings });
  const settings = settingsQuery.data;

  if (!settings) return null;

  const options = settings.providers.flatMap((provider) =>
    provider.models
      .filter((model) => model.kind === "chat")
      .map((model) => ({
        providerId: provider.id,
        providerName: provider.name,
        model: model.id,
      })),
  );
  const configured = Boolean(settings.titleProviderId && settings.titleModel);
  const value = configured
    ? encode(settings.titleProviderId, settings.titleModel)
    : FOLLOW_CONVERSATION;
  const chatProvider = settings.providers.find(
    (provider) => provider.id === settings.chatProviderId,
  );
  const fallbackLabel = settings.chatModel
    ? `${chatProvider?.name ? `${chatProvider.name} · ` : ""}${settings.chatModel}`
    : "当前对话选择的模型";

  const update = async (nextValue: string) => {
    if (nextValue === FOLLOW_CONVERSATION) {
      await saveSettings({ ...settings, titleProviderId: "", titleModel: "" });
    } else {
      const separator = nextValue.indexOf("::");
      if (separator < 0) return;
      await saveSettings({
        ...settings,
        titleProviderId: nextValue.slice(0, separator),
        titleModel: nextValue.slice(separator + 2),
      });
    }
    void queryClient.invalidateQueries({ queryKey: ["settings"] });
  };

  return (
    <SettingsSection
      title="会话标题模型"
      description="新会话完成首轮回复后，使用 AI 自动生成简短标题。标题生成不会阻塞对话。"
    >
      <div className="flex max-w-xl flex-col gap-2">
        <Label htmlFor="title-model">生成模型</Label>
        <Select value={value} onValueChange={(nextValue) => void update(nextValue)}>
          <SelectTrigger id="title-model" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FOLLOW_CONVERSATION}>
              跟随对话模型 · {fallbackLabel}
            </SelectItem>
            {options.map((option) => (
              <SelectItem
                key={encode(option.providerId, option.model)}
                value={encode(option.providerId, option.model)}
              >
                {option.providerName} · {option.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          不单独设置时，每个会话会使用它自己的对话模型生成标题。
        </p>
      </div>
    </SettingsSection>
  );
}
