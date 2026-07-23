import {
  Binoculars,
  BookOpenText,
  FlaskConical,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  StarterSuggestion,
  StarterSuggestionCategory,
} from "@/lib/task-mode";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS = {
  explore: Binoculars,
  quality: ShieldCheck,
  test: FlaskConical,
  docs: BookOpenText,
} satisfies Record<StarterSuggestionCategory, typeof Binoculars>;

interface StarterSuggestionsProps {
  suggestions: readonly StarterSuggestion[];
  projectName?: string;
  technologies?: readonly string[];
  loading?: boolean;
  onSelect: (suggestion: StarterSuggestion) => void;
}

const CARD_DELAYS = [
  "[animation-delay:0ms]",
  "[animation-delay:90ms]",
  "[animation-delay:180ms]",
  "[animation-delay:270ms]",
] as const;

export function StarterSuggestions({
  suggestions,
  projectName,
  technologies = [],
  loading = false,
  onSelect,
}: StarterSuggestionsProps) {
  const context = technologies.slice(0, 4).join(" · ");

  return (
    <section className="mt-4 w-full" aria-label="任务建议">
      <div className="text-muted-foreground mb-2 flex h-5 items-center justify-center gap-1.5 text-[11px]">
        <Sparkles className="size-3" />
        <span className="max-w-full truncate">
          {loading
            ? projectName
              ? `AI 正在为 ${projectName} 准备任务灵感…`
              : "AI 正在结合最近任务准备灵感…"
            : projectName
              ? context
                ? `AI 已结合 ${context} 和最近任务生成`
                : `AI 为 ${projectName} 准备的任务灵感`
              : "AI 根据工作模式和最近任务生成"}
        </span>
      </div>
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
        {loading && suggestions.length === 0
          ? Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="bg-background/35 flex h-[4.5rem] items-center gap-2 rounded-xl border px-2.5 py-2"
              >
                <Skeleton className="size-8 shrink-0 rounded-lg" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-full" />
                  <Skeleton className="h-2.5 w-2/3" />
                </span>
              </div>
            ))
          : suggestions.slice(0, 4).map((suggestion, index) => {
              const Icon = CATEGORY_ICONS[suggestion.category];
              return (
                <Button
                  key={suggestion.id}
                  type="button"
                  variant="outline"
                  title={suggestion.prompt}
                  className={cn(
                    "bg-background/55 group h-[4.5rem] min-w-0 justify-start gap-2 rounded-xl px-2.5 py-2 text-left font-normal whitespace-normal shadow-xs transition-[color,background-color,border-color,box-shadow] animate-in fade-in slide-in-from-bottom-2 duration-500",
                    CARD_DELAYS[index],
                  )}
                  onClick={() => onSelect(suggestion)}
                >
                  <span className="bg-muted text-muted-foreground group-hover:text-foreground grid size-8 shrink-0 place-items-center rounded-lg transition-colors">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {suggestion.title}
                    </span>
                    <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-[10px] leading-4">
                      {suggestion.description}
                    </span>
                  </span>
                </Button>
              );
            })}
      </div>
    </section>
  );
}
