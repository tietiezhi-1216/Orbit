import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BrainCircuit } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveSettings } from "@/lib/api";
import type { AppSettings, ModelInfo, ReasoningEffort } from "@/lib/api";
import { modelReasoning } from "@/lib/model-capabilities";

const EFFORT_LABELS: Record<ReasoningEffort, string> = {
  auto: "Auto",
  off: "Off",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "XHigh",
  max: "Max",
};

export function ReasoningEffortSelect({
  settings,
  model,
  effortOverride,
}: {
  settings: AppSettings;
  model: ModelInfo;
  effortOverride?: ReasoningEffort;
}) {
  const queryClient = useQueryClient();
  const reasoning = modelReasoning(model);
  const save = useMutation({
    mutationFn: (effort: ReasoningEffort) =>
      saveSettings({ ...settings, chatReasoningEffort: effort }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  if (!reasoning) return null;

  if (reasoning.mode === "fixed") {
    return (
      <span
        title="Reasoning effort is fixed by this model"
        className="text-muted-foreground flex h-7 shrink-0 items-center gap-1 px-1.5 text-xs"
      >
        <BrainCircuit className="size-3.5" />
        Fixed
      </span>
    );
  }

  if (effortOverride) {
    return (
      <span
        title="Reasoning effort is fixed by the active agent"
        className="text-muted-foreground flex h-7 shrink-0 items-center gap-1 px-1.5 text-xs"
      >
        <BrainCircuit className="size-3.5" />
        {EFFORT_LABELS[effortOverride]}
      </span>
    );
  }

  const supported = [
    "auto" as const,
    ...reasoning.supportedEfforts.filter((effort) => effort !== "auto"),
  ];
  const configured = settings.chatReasoningEffort ?? "auto";
  const value = supported.includes(configured) ? configured : "auto";

  return (
    <Select
      value={value}
      disabled={save.isPending}
      onValueChange={(effort) => save.mutate(effort as ReasoningEffort)}
    >
      <SelectTrigger
        size="sm"
        aria-label="Reasoning Effort"
        title="Reasoning Effort"
        className="h-7 w-auto min-w-20 gap-1 border-0 bg-transparent px-2 text-xs shadow-none"
      >
        <BrainCircuit className="size-3.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {supported.map((effort) => (
          <SelectItem key={effort} value={effort}>
            {EFFORT_LABELS[effort]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
