import path from "node:path";

export const TASK_SCHEMA_VERSION = "1" as const;

export type AgentName = "scout";
export type WorkspaceAccess = "read-only";

export interface TaskBudgets {
  timeoutMs: number;
  maxOutputChars: number;
}

export interface TaskEnvelope {
  version: typeof TASK_SCHEMA_VERSION;
  taskId: string;
  agent: AgentName;
  objective: string;
  workspace: {
    path: string;
    access: WorkspaceAccess;
  };
  constraints: string[];
  successCriteria: string[];
  allowedTools: string[];
  budgets: TaskBudgets;
}

export type TaskStatus =
  | "queued"
  | "starting"
  | "running"
  | "completed"
  | "failed"
  | "timed_out"
  | "cancelled";

export interface TaskResult {
  version: typeof TASK_SCHEMA_VERSION;
  taskId: string;
  agent: AgentName;
  status: Exclude<TaskStatus, "queued" | "starting" | "running">;
  summary: string;
  artifacts: string[];
  warnings: string[];
  usage: {
    durationMs: number;
    outputChars: number;
    outputTruncated: boolean;
  };
  error?: string;
}

const TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SCOUT_TOOLS = new Set(["read", "grep", "find", "ls"]);

function assertStringArray(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${field} must be an array of strings`);
  }
}

export function validateTaskEnvelope(value: unknown): asserts value is TaskEnvelope {
  if (!value || typeof value !== "object") {
    throw new Error("task must be an object");
  }

  const task = value as Partial<TaskEnvelope>;
  if (task.version !== TASK_SCHEMA_VERSION) {
    throw new Error(`version must be ${TASK_SCHEMA_VERSION}`);
  }
  if (typeof task.taskId !== "string" || !TASK_ID_PATTERN.test(task.taskId)) {
    throw new Error("taskId must be 1-128 safe filename characters");
  }
  if (task.agent !== "scout") {
    throw new Error("the MVP supports only the scout agent");
  }
  if (
    typeof task.objective !== "string" ||
    task.objective.trim().length === 0 ||
    task.objective.length > 10_000
  ) {
    throw new Error("objective must contain 1-10000 characters");
  }
  if (
    !task.workspace ||
    typeof task.workspace.path !== "string" ||
    !path.isAbsolute(task.workspace.path)
  ) {
    throw new Error("workspace.path must be an absolute path");
  }
  if (task.workspace.access !== "read-only") {
    throw new Error("the scout workspace must be read-only");
  }

  assertStringArray(task.constraints, "constraints");
  assertStringArray(task.successCriteria, "successCriteria");
  assertStringArray(task.allowedTools, "allowedTools");
  if (task.allowedTools.length === 0) {
    throw new Error("allowedTools must not be empty");
  }
  for (const tool of task.allowedTools) {
    if (!SCOUT_TOOLS.has(tool)) {
      throw new Error(`tool ${tool} is not allowed for scout`);
    }
  }
  if (
    !task.budgets ||
    !Number.isInteger(task.budgets.timeoutMs) ||
    task.budgets.timeoutMs < 1_000 ||
    task.budgets.timeoutMs > 3_600_000
  ) {
    throw new Error("budgets.timeoutMs must be an integer from 1000 to 3600000");
  }
  if (
    !Number.isInteger(task.budgets.maxOutputChars) ||
    task.budgets.maxOutputChars < 1_000 ||
    task.budgets.maxOutputChars > 200_000
  ) {
    throw new Error("budgets.maxOutputChars must be an integer from 1000 to 200000");
  }
}

export function formatTaskPrompt(task: TaskEnvelope): string {
  return [
    "You have received an isolated task contract. You have no access to the parent conversation.",
    "Make your own execution decisions within this contract and your tool allowlist.",
    "",
    `Objective:\n${task.objective}`,
    "",
    `Constraints:\n${task.constraints.map((item) => `- ${item}`).join("\n") || "- None"}`,
    "",
    `Success criteria:\n${task.successCriteria.map((item) => `- ${item}`).join("\n") || "- Provide a concise evidence-based report"}`,
    "",
    "Return a concise report with evidence, assumptions, unresolved risks, and no claims beyond what you verified.",
  ].join("\n");
}
