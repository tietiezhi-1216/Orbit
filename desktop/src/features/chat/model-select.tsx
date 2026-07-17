import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { loadSettings, saveSettings } from "@/lib/api";
import type { ModelInfo } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui";

interface ChatProvider {
  id: string;
  name: string;
  models: ModelInfo[];
}

/** Chat model picker in the composer: provider → model. */
export function ModelSelect() {
  const queryClient = useQueryClient();
  const openSettings = useUiStore((s) => s.openSettings);
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: loadSettings });

  const settings = settingsQuery.data;
  const currentProviderId = settings?.chatProviderId ?? "";
  const currentModel = settings?.chatModel ?? "";

  const save = useMutation({
    mutationFn: async ({ providerId, model }: { providerId: string; model: string }) => {
      if (!settings) return;
      await saveSettings({ ...settings, chatProviderId: providerId, chatModel: model });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  // Only chat-capable models belong here: a relay's catalog also carries image /
  // video / ASR models, which would fail the moment they were picked.
  const chatProviders: ChatProvider[] = (settings?.providers ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      models: p.models.filter((m) => m.kind === "chat").sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .filter((p) => p.models.length > 0);

  if (!settings || chatProviders.length === 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
        onClick={() => openSettings("providers")}
      >
        {(settings?.providers.length ?? 0) === 0 ? "去添加供应商" : "去获取模型"}
      </Button>
    );
  }

  const pick = (providerId: string, model: string) => save.mutate({ providerId, model });

  const renderModel = (providerId: string, m: ModelInfo) => {
    const active = providerId === currentProviderId && m.id === currentModel;
    return (
      <DropdownMenuItem key={`${providerId}-${m.id}`} onSelect={() => pick(providerId, m.id)}>
        <Check className={cn("size-3.5", !active && "opacity-0")} />
        <span className="truncate">{m.id}</span>
      </DropdownMenuItem>
    );
  };

  const currentProviderName = chatProviders.find((p) => p.id === currentProviderId)?.name;
  const label = currentModel
    ? currentProviderName
      ? `${currentProviderName} · ${currentModel}`
      : currentModel
    : "选择模型";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 max-w-56 gap-1 px-2 text-xs"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {chatProviders.length === 1
          ? chatProviders[0].models.map((m) => renderModel(chatProviders[0].id, m))
          : chatProviders.map((p) => (
              <DropdownMenuSub key={p.id}>
                <DropdownMenuSubTrigger>{p.name}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                  {p.models.map((m) => renderModel(p.id, m))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
