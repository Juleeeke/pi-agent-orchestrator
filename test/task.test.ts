import assert from "node:assert/strict";
import test from "node:test";
import { formatTaskPrompt, validateTaskEnvelope } from "../src/domain/task.ts";

function validTask(): unknown {
  return {
    version: "1",
    taskId: "scout-1",
    agent: "scout",
    objective: "Inspect entry points",
    workspace: { path: "/tmp/repository", access: "read-only" },
    constraints: ["Do not modify files"],
    successCriteria: ["Cite evidence"],
    allowedTools: ["read", "grep"],
    budgets: { timeoutMs: 5_000, maxOutputChars: 10_000 },
  };
}

test("accepts a bounded read-only scout task", () => {
  const task = validTask();
  assert.doesNotThrow(() => validateTaskEnvelope(task));
});

test("rejects a write-capable scout", () => {
  const task = validTask() as { allowedTools: string[] };
  task.allowedTools.push("write");
  assert.throws(() => validateTaskEnvelope(task), /not allowed/);
});

test("rejects relative workspace paths", () => {
  const task = validTask() as { workspace: { path: string } };
  task.workspace.path = "./repository";
  assert.throws(() => validateTaskEnvelope(task), /absolute path/);
});

test("task prompt includes only the explicit contract fields", () => {
  const task = validTask();
  validateTaskEnvelope(task);
  const prompt = formatTaskPrompt(task);
  assert.match(prompt, /Inspect entry points/);
  assert.match(prompt, /Cite evidence/);
  assert.doesNotMatch(prompt, /parent conversation content/);
});
