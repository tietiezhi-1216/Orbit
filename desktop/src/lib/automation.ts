import type { Edge, Node } from "@xyflow/react";
import type {
  AutomationDocument,
  AutomationEdge,
  AutomationNode,
  AutomationNodeType,
  JsonValue,
} from "@/lib/api";

export type AutomationNodeCategory =
  | "trigger"
  | "ai"
  | "tool"
  | "transform"
  | "logic"
  | "human"
  | "output";

export interface AutomationPortDefinition {
  id: string;
  label: string;
}

export interface AutomationConfigOption {
  label: string;
  value: string;
}

export interface AutomationConfigField {
  key: string;
  label: string;
  kind: "text" | "textarea" | "select";
  placeholder?: string;
  options?: AutomationConfigOption[];
}

export interface AutomationNodeDefinition {
  type: AutomationNodeType;
  title: string;
  description: string;
  category: AutomationNodeCategory;
  inputs: AutomationPortDefinition[];
  outputs: AutomationPortDefinition[];
  fields: AutomationConfigField[];
  defaultConfig: Record<string, JsonValue>;
}

export const AUTOMATION_CATEGORY_LABELS: Record<AutomationNodeCategory, string> = {
  trigger: "触发器",
  ai: "AI 与 Skills",
  tool: "MCP 与工具",
  transform: "数据变换",
  logic: "流程逻辑",
  human: "人工交互",
  output: "输出",
};

export const AUTOMATION_NODE_DEFINITIONS: readonly AutomationNodeDefinition[] = [
  {
    type: "manualTrigger",
    title: "手动触发",
    description: "从测试面板输入数据并启动流程。",
    category: "trigger",
    inputs: [],
    outputs: [{ id: "output", label: "输入" }],
    fields: [],
    defaultConfig: {},
  },
  {
    type: "scheduleTrigger",
    title: "定时触发",
    description: "按 Cron 表达式启动已发布流程。",
    category: "trigger",
    inputs: [],
    outputs: [{ id: "output", label: "事件" }],
    fields: [
      {
        key: "cron",
        label: "Cron 表达式",
        kind: "text",
        placeholder: "0 9 * * *",
      },
      {
        key: "timezone",
        label: "时区",
        kind: "text",
        placeholder: "Asia/Shanghai",
      },
    ],
    defaultConfig: { cron: "0 9 * * *", timezone: "Asia/Shanghai" },
  },
  {
    type: "model",
    title: "模型调用",
    description: "执行一次确定的模型请求。",
    category: "ai",
    inputs: [{ id: "input", label: "输入" }],
    outputs: [{ id: "output", label: "结果" }],
    fields: [
      {
        key: "model",
        label: "模型",
        kind: "text",
        placeholder: "留空时跟随默认模型",
      },
      {
        key: "prompt",
        label: "指令",
        kind: "textarea",
        placeholder: "描述模型应完成的任务",
      },
    ],
    defaultConfig: { model: "", prompt: "" },
  },
  {
    type: "agent",
    title: "Agent",
    description: "运行可使用工具的 Agent 步骤。",
    category: "ai",
    inputs: [{ id: "input", label: "任务" }],
    outputs: [{ id: "output", label: "结果" }],
    fields: [
      {
        key: "agentId",
        label: "Agent ID",
        kind: "text",
        placeholder: "留空时使用默认 Agent",
      },
      {
        key: "prompt",
        label: "任务指令",
        kind: "textarea",
        placeholder: "说明此步骤要完成什么",
      },
    ],
    defaultConfig: { agentId: "", prompt: "" },
  },
  {
    type: "skill",
    title: "Skill",
    description: "用指定 Skill 约束一个 Agent 步骤。",
    category: "ai",
    inputs: [{ id: "input", label: "任务" }],
    outputs: [{ id: "output", label: "结果" }],
    fields: [
      {
        key: "skillName",
        label: "Skill 名称",
        kind: "text",
        placeholder: "例如 pdf-tools",
      },
      {
        key: "instruction",
        label: "补充指令",
        kind: "textarea",
        placeholder: "传给 Skill 的具体任务",
      },
    ],
    defaultConfig: { skillName: "", instruction: "" },
  },
  {
    type: "mcpTool",
    title: "MCP 工具",
    description: "直接调用已配置 MCP Server 的工具。",
    category: "tool",
    inputs: [{ id: "input", label: "参数" }],
    outputs: [{ id: "output", label: "结果" }],
    fields: [
      { key: "serverId", label: "Server ID", kind: "text" },
      { key: "toolName", label: "工具名称", kind: "text" },
    ],
    defaultConfig: { serverId: "", toolName: "" },
  },
  {
    type: "builtinTool",
    title: "内置工具",
    description: "调用文件、Fetch 或设备等本地工具。",
    category: "tool",
    inputs: [{ id: "input", label: "参数" }],
    outputs: [{ id: "output", label: "结果" }],
    fields: [
      {
        key: "toolName",
        label: "工具",
        kind: "select",
        options: [
          { value: "read_file", label: "读取文件" },
          { value: "write_file", label: "写入文件" },
          { value: "fetch", label: "Fetch" },
          { value: "device_call", label: "设备调用" },
        ],
      },
    ],
    defaultConfig: { toolName: "read_file" },
  },
  {
    type: "code",
    title: "代码",
    description: "在隔离环境中变换 JSON 数据。",
    category: "transform",
    inputs: [{ id: "input", label: "输入" }],
    outputs: [{ id: "output", label: "结果" }],
    fields: [
      {
        key: "language",
        label: "语言",
        kind: "select",
        options: [{ value: "javascript", label: "JavaScript" }],
      },
      {
        key: "code",
        label: "代码",
        kind: "textarea",
        placeholder: "return input;",
      },
    ],
    defaultConfig: { language: "javascript", code: "return input;" },
  },
  {
    type: "condition",
    title: "条件分支",
    description: "根据输入值选择通过或否则路径。",
    category: "logic",
    inputs: [{ id: "input", label: "输入" }],
    outputs: [
      { id: "true", label: "通过" },
      { id: "false", label: "否则" },
    ],
    fields: [
      { key: "path", label: "JSON Pointer", kind: "text", placeholder: "/status" },
      {
        key: "operator",
        label: "比较方式",
        kind: "select",
        options: [
          { value: "equals", label: "等于" },
          { value: "notEquals", label: "不等于" },
          { value: "exists", label: "存在" },
          { value: "contains", label: "包含" },
        ],
      },
      { key: "value", label: "比较值", kind: "text" },
    ],
    defaultConfig: { path: "/", operator: "equals", value: "" },
  },
  {
    type: "merge",
    title: "合并",
    description: "等待全部或任一上游路径完成。",
    category: "logic",
    inputs: [{ id: "input", label: "输入" }],
    outputs: [{ id: "output", label: "结果" }],
    fields: [
      {
        key: "strategy",
        label: "合并策略",
        kind: "select",
        options: [
          { value: "all", label: "等待全部" },
          { value: "any", label: "任一完成" },
        ],
      },
    ],
    defaultConfig: { strategy: "all" },
  },
  {
    type: "approval",
    title: "人工审批",
    description: "暂停流程并等待用户选择。",
    category: "human",
    inputs: [{ id: "input", label: "待审批" }],
    outputs: [
      { id: "approved", label: "通过" },
      { id: "rejected", label: "拒绝" },
    ],
    fields: [
      {
        key: "message",
        label: "审批说明",
        kind: "textarea",
        placeholder: "说明用户需要确认的事项",
      },
      {
        key: "timeoutMinutes",
        label: "超时分钟数",
        kind: "text",
        placeholder: "1440",
      },
    ],
    defaultConfig: { message: "请确认是否继续执行", timeoutMinutes: "1440" },
  },
  {
    type: "output",
    title: "输出",
    description: "定义此次运行的最终结果。",
    category: "output",
    inputs: [{ id: "input", label: "结果" }],
    outputs: [],
    fields: [],
    defaultConfig: {},
  },
] as const;

export const AUTOMATION_CATEGORIES: readonly AutomationNodeCategory[] = [
  "trigger",
  "ai",
  "tool",
  "transform",
  "logic",
  "human",
  "output",
];

export function getAutomationNodeDefinition(
  type: AutomationNodeType,
): AutomationNodeDefinition | undefined {
  return AUTOMATION_NODE_DEFINITIONS.find((definition) => definition.type === type);
}

export function createAutomationNode(
  type: AutomationNodeType,
  position: { x: number; y: number },
): AutomationNode {
  const definition = getAutomationNodeDefinition(type);
  if (!definition) throw new Error(`未知 Automation 节点：${type}`);
  return {
    id: crypto.randomUUID(),
    type,
    typeVersion: 1,
    name: definition.title,
    position,
    disabled: false,
    config: structuredClone(definition.defaultConfig),
    inputs: {},
  };
}

export type AutomationCanvasNode = Node<
  { automationNode: AutomationNode },
  "automation"
>;

export function toCanvasNodes(
  nodes: AutomationNode[],
  selectedNodeId: string | null,
): AutomationCanvasNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: "automation",
    position: node.position,
    selected: node.id === selectedNodeId,
    data: { automationNode: node },
  }));
}

export function toCanvasEdges(edges: AutomationEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    sourceHandle: edge.sourcePort,
    target: edge.targetNodeId,
    targetHandle: edge.targetPort,
    type: "bezier",
    animated: false,
  }));
}

export function wouldCreateCycle(
  document: AutomationDocument,
  sourceNodeId: string,
  targetNodeId: string,
): boolean {
  if (sourceNodeId === targetNodeId) return true;
  const outgoing = new Map<string, string[]>();
  for (const edge of document.edges) {
    const targets = outgoing.get(edge.sourceNodeId) ?? [];
    targets.push(edge.targetNodeId);
    outgoing.set(edge.sourceNodeId, targets);
  }
  const pending = [targetNodeId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    if (current === sourceNodeId) return true;
    visited.add(current);
    pending.push(...(outgoing.get(current) ?? []));
  }
  return false;
}
