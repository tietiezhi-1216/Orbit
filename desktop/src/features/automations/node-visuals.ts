import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Braces,
  BrainCircuit,
  CalendarClock,
  Combine,
  GitFork,
  LogOut,
  MousePointerClick,
  Network,
  Puzzle,
  UserCheck,
  WandSparkles,
  Wrench,
} from "lucide-react";
import type { AutomationNodeType } from "@/lib/api";
import type { AutomationNodeCategory } from "@/lib/automation";

export const AUTOMATION_NODE_ICONS: Partial<
  Record<AutomationNodeType, LucideIcon>
> = {
  manualTrigger: MousePointerClick,
  scheduleTrigger: CalendarClock,
  model: BrainCircuit,
  agent: Bot,
  skill: WandSparkles,
  mcpTool: Network,
  builtinTool: Wrench,
  code: Braces,
  condition: GitFork,
  merge: Combine,
  approval: UserCheck,
  output: LogOut,
};

export const FALLBACK_AUTOMATION_NODE_ICON = Puzzle;

export const AUTOMATION_CATEGORY_ICON: Record<AutomationNodeCategory, string> = {
  trigger: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  ai: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  tool: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  transform: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  logic: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  human: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  output: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

export const AUTOMATION_CATEGORY_HANDLE: Record<AutomationNodeCategory, string> = {
  trigger: "!bg-amber-500",
  ai: "!bg-sky-500",
  tool: "!bg-cyan-500",
  transform: "!bg-indigo-500",
  logic: "!bg-orange-500",
  human: "!bg-rose-500",
  output: "!bg-emerald-500",
};
