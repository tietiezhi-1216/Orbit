export type TaskMode = "work" | "code";

export type StarterSuggestionCategory =
  | "explore"
  | "quality"
  | "test"
  | "docs";

export interface StarterSuggestion {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: StarterSuggestionCategory;
}

export const TASK_MODES = [
  {
    id: "work",
    name: "Work",
    description: "研究、资料与可交付成果",
    emptyDescription: "查资料、整理附件并形成文档、表格或报告。",
    capabilities: ["网页与资料", "文档整理", "成果交付"],
    toolSummary: "文件 · 搜索 · Fetch · Skills · MCP",
  },
  {
    id: "code",
    name: "Code",
    description: "仓库、终端与可验证变更",
    emptyDescription: "分析仓库、修改代码，并通过测试或构建验证结果。",
    capabilities: ["仓库分析", "终端执行", "Diff 与测试"],
    toolSummary: "文件 · 搜索 · Shell · Skills · MCP",
  },
] as const satisfies readonly {
  id: TaskMode;
  name: string;
  description: string;
  emptyDescription: string;
  capabilities: readonly string[];
  toolSummary: string;
}[];

export type TaskModeDefinition = (typeof TASK_MODES)[number];

export function getTaskMode(mode: TaskMode): TaskModeDefinition {
  return TASK_MODES.find((definition) => definition.id === mode) ?? TASK_MODES[1];
}
