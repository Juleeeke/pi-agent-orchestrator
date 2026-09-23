import { randomUUID } from "node:crypto";
import path from "node:path";
import process from "node:process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { TASK_SCHEMA_VERSION, type TaskEnvelope } from "../src/domain/task.ts";
import { Orchestrator } from "../src/orchestrator/orchestrator.ts";

export default function registerOrchestrator(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "dispatch_task",
    label: "Dispatch isolated task",
    description:
      "Delegate one repository reconnaissance task to a context-isolated, read-only Pi scout. Use this whenever workspace evidence is needed. The child receives only the explicit objective, constraints, and success criteria supplied here; it never receives the parent conversation.",
    parameters: Type.Object({
      objective: Type.String({ minLength: 1, maxLength: 10_000 }),
      workspace: Type.Optional(
        Type.String({ description: "Absolute workspace path. Defaults to the mother agent cwd." }),
      ),
      constraints: Type.Optional(Type.Array(Type.String(), { maxItems: 30 })),
      successCriteria: Type.Optional(Type.Array(Type.String(), { maxItems: 30 })),
      timeoutMs: Type.Optional(Type.Integer({ minimum: 1_000, maximum: 3_600_000 })),
      maxOutputChars: Type.Optional(Type.Integer({ minimum: 1_000, maximum: 200_000 })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const runtimeRoot =
        process.env.PI_ORCHESTRATOR_RUNTIME_ROOT ?? path.join(ctx.cwd, ".pi-orchestrator");
      const task: TaskEnvelope = {
        version: TASK_SCHEMA_VERSION,
        taskId: `scout-${randomUUID()}`,
        agent: "scout",
        objective: params.objective,
        workspace: {
          path: path.resolve(params.workspace ?? ctx.cwd),
          access: "read-only",
        },
        constraints: params.constraints ?? [],
        successCriteria: params.successCriteria ?? [],
        allowedTools: ["read", "grep", "find", "ls"],
        budgets: {
          timeoutMs: params.timeoutMs ?? 300_000,
          maxOutputChars: params.maxOutputChars ?? 50_000,
        },
      };

      const orchestrator = new Orchestrator({
        runtimeRoot,
        piBin: process.env.PI_BIN,
      });
      const result = await orchestrator.dispatch(task, signal);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  });
}
