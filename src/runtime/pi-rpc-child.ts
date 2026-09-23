import { spawn } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import type { AgentProfile } from "../config/profiles.ts";
import { formatTaskPrompt, type TaskEnvelope } from "../domain/task.ts";
import { sanitizeChildEnvironment } from "./environment.ts";
import { StrictJsonlDecoder } from "./jsonl.ts";

export class ChildTimeoutError extends Error {}
export class ChildAbortedError extends Error {}

export interface ChildRunOutput {
  text: string;
  durationMs: number;
  outputTruncated: boolean;
  warningMessages: string[];
}

export interface PiRpcRunnerOptions {
  piBin?: string;
  runtimeRoot: string;
  model?: string;
  thinking?: string;
  extraEnvironmentKeys?: readonly string[];
  onEvent?: (event: unknown) => void;
}

export interface PiCommandOptions {
  piBin: string;
  workspace: string;
  sessionDir: string;
  taskId: string;
  tools: readonly string[];
  systemPrompt: string;
  model?: string;
  thinking?: string;
}

export function buildPiCommand(options: PiCommandOptions): { command: string; args: string[] } {
  const args = [
    "--mode",
    "rpc",
    "--session-dir",
    options.sessionDir,
    "--name",
    options.taskId,
  ];
  if (options.model) args.push("--model", options.model);
  if (options.thinking) args.push("--thinking", options.thinking);
  args.push(
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
    "--no-context-files",
    "--no-approve",
    "--tools",
    options.tools.join(","),
    "--system-prompt",
    options.systemPrompt,
  );
  return {
    command: options.piBin,
    args,
  };
}

function readStopReason(record: unknown): { stopReason?: string; error?: string } {
  if (!record || typeof record !== "object") return {};
  const event = record as Record<string, unknown>;
  const message = event.message;
  if (!message || typeof message !== "object") return {};
  const candidate = message as Record<string, unknown>;
  return {
    stopReason: typeof candidate.stopReason === "string" ? candidate.stopReason : undefined,
    error: typeof candidate.errorMessage === "string" ? candidate.errorMessage : undefined,
  };
}

export class PiRpcChildRunner {
  readonly options: PiRpcRunnerOptions;

  constructor(options: PiRpcRunnerOptions) {
    this.options = options;
  }

  async run(
    task: TaskEnvelope,
    profile: AgentProfile,
    externalSignal?: AbortSignal,
  ): Promise<ChildRunOutput> {
    const startedAt = Date.now();
    const workspace = await realpath(task.workspace.path);
    const systemPrompt = await readFile(profile.systemPromptUrl, "utf8");
    const sessionDir = path.join(this.options.runtimeRoot, "tasks", task.taskId, "session");
    const { command, args } = buildPiCommand({
      piBin: this.options.piBin ?? "pi",
      workspace,
      sessionDir,
      taskId: task.taskId,
      tools: task.allowedTools,
      systemPrompt,
      model: this.options.model,
      thinking: this.options.thinking,
    });

    const child = spawn(command, args, {
      cwd: workspace,
      env: sanitizeChildEnvironment(process.env, this.options.extraEnvironmentKeys),
      stdio: ["pipe", "pipe", "pipe"],
    });

    const decoder = new StrictJsonlDecoder();
    let output = "";
    let outputTruncated = false;
    let stderr = "";
    let settled = false;
    let stopReason: string | undefined;
    let modelError: string | undefined;
    let timedOut = false;
    let aborted = false;

    const terminate = (reason: "timeout" | "abort") => {
      if (reason === "timeout") timedOut = true;
      if (reason === "abort") aborted = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
      }, 1_000).unref();
    };

    const timeout = setTimeout(() => terminate("timeout"), task.budgets.timeoutMs);
    const onAbort = () => terminate("abort");
    externalSignal?.addEventListener("abort", onAbort, { once: true });
    if (externalSignal?.aborted) onAbort();

    try {
      await new Promise<void>((resolve, reject) => {
        child.once("error", reject);
        child.once("spawn", () => {
          const commandRecord = {
            id: `prompt-${task.taskId}`,
            type: "prompt",
            message: formatTaskPrompt(task),
          };
          child.stdin.write(`${JSON.stringify(commandRecord)}\n`);
        });

        child.stdout.on("data", (chunk: Buffer) => {
          try {
            for (const record of decoder.push(chunk)) {
              this.options.onEvent?.(record);
              if (!record || typeof record !== "object") continue;
              const event = record as Record<string, unknown>;
              if (event.type === "message_update") {
                const update = event.assistantMessageEvent;
                if (update && typeof update === "object") {
                  const delta = update as Record<string, unknown>;
                  if (delta.type === "text_delta" && typeof delta.delta === "string") {
                    const remaining = task.budgets.maxOutputChars - output.length;
                    if (remaining > 0) output += delta.delta.slice(0, remaining);
                    if (delta.delta.length > remaining) outputTruncated = true;
                  }
                }
              }
              const observed = readStopReason(record);
              stopReason = observed.stopReason ?? stopReason;
              modelError = observed.error ?? modelError;
              if (event.type === "agent_settled") {
                settled = true;
                child.stdin.end();
              }
            }
          } catch (error) {
            reject(error);
            terminate("abort");
          }
        });

        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
          if (stderr.length > 20_000) stderr = stderr.slice(-20_000);
        });

        child.once("exit", (code, signal) => {
          try {
            decoder.finish();
          } catch (error) {
            reject(error);
            return;
          }
          if (timedOut) {
            reject(new ChildTimeoutError(`child exceeded ${task.budgets.timeoutMs} ms`));
          } else if (aborted) {
            reject(new ChildAbortedError("child was cancelled"));
          } else if (code !== 0) {
            reject(new Error(`pi child exited with code ${String(code)} signal ${String(signal)}: ${stderr.trim()}`));
          } else if (!settled) {
            reject(new Error("pi child exited before agent_settled"));
          } else if (stopReason === "error" || stopReason === "aborted") {
            reject(new Error(modelError ?? `model stopped with ${stopReason}`));
          } else {
            resolve();
          }
        });
      });
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", onAbort);
    }

    return {
      text: output,
      durationMs: Date.now() - startedAt,
      outputTruncated,
      warningMessages: stderr.trim() ? [stderr.trim()] : [],
    };
  }
}
