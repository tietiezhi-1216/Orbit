import { useMemo, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  Clapperboard,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ModelInfo, Provider } from "@/lib/api";
import {
  effectiveModelKind,
  modelOutputModalities,
} from "@/lib/model-capabilities";
import type { CreateMode } from "@/stores/create";
import { useUiStore } from "@/stores/ui";

interface ModelOption {
  providerId: string;
  providerName: string;
  model: ModelInfo;
}

function supportsMode(model: ModelInfo, mode: CreateMode): boolean {
  const kind = effectiveModelKind(model);
  const outputs = modelOutputModalities(model);
  return kind === mode || outputs.includes(mode);
}

export function CreateModelSelect({
  mode,
  providers,
  providerId,
  model,
  onChange,
}: {
  mode: CreateMode;
  providers: Provider[];
  providerId: string;
  model: string;
  onChange: (providerId: string, model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const openSettings = useUiStore((state) => state.openSettings);
  const label = mode === "image" ? "图片模型" : "视频模型";
  const Icon = mode === "image" ? ImageIcon : Clapperboard;
  const options = useMemo<ModelOption[]>(
    () =>
      providers.flatMap((provider) =>
        provider.models
          .filter((candidate) => supportsMode(candidate, mode))
          .map((candidate) => ({
            providerId: provider.id,
            providerName: provider.builtIn ? "tietiezhi" : provider.name,
            model: candidate,
          })),
      ),
    [mode, providers],
  );
  const selected = options.find(
    (option) => option.providerId === providerId && option.model.id === model,
  );
  const grouped = useMemo(
    () =>
      providers.flatMap((provider) => {
        const providerOptions = options.filter(
          (option) => option.providerId === provider.id,
        );
        return providerOptions.length > 0
          ? [{
              id: provider.id,
              name: provider.builtIn ? "tietiezhi" : provider.name,
              options: providerOptions,
            }]
          : [];
      }),
    [options, providers],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="max-w-54 gap-2 rounded-xl bg-white/6 px-3 text-white hover:bg-white/10 hover:text-white data-[state=open]:bg-white/10"
        >
          <Icon className="size-3.5 text-cyan-300" />
          <span className="truncate text-xs">
            {selected?.model.id || model || "自动匹配模型"}
          </span>
          <ChevronDown className="size-3 text-white/45" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-82 gap-0 overflow-hidden p-0">
        <Command>
          <CommandInput placeholder={`搜索${label}…`} />
          <CommandList className="max-h-80">
            <CommandGroup heading="默认">
              <CommandItem
                value={`自动匹配 ${label}`}
                data-checked={!model}
                onSelect={() => {
                  onChange("", "");
                  setOpen(false);
                }}
              >
                <Bot className="text-muted-foreground size-4" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">自动匹配模型</span>
                  <span className="text-muted-foreground block text-[10px]">
                    运行时选择第一个可用的{label}
                  </span>
                </span>
                {!model && <Check className="size-3.5" />}
              </CommandItem>
            </CommandGroup>
            <CommandEmpty>没有可用的{label}</CommandEmpty>
            {grouped.map((group) => (
              <CommandGroup key={group.id} heading={group.name}>
                {group.options.map((option) => {
                  const active =
                    option.providerId === providerId && option.model.id === model;
                  return (
                    <CommandItem
                      key={`${option.providerId}:${option.model.id}`}
                      value={`${group.name} ${option.model.id}`}
                      onSelect={() => {
                        onChange(option.providerId, option.model.id);
                        setOpen(false);
                      }}
                      className="py-2"
                    >
                      <Icon className="text-muted-foreground size-3.5" />
                      <span className="min-w-0 flex-1 break-all font-mono text-xs">
                        {option.model.id}
                      </span>
                      {active && <Check className="size-3.5" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        {options.length === 0 && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setOpen(false);
                openSettings("providers");
              }}
            >
              前往供应商设置
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
