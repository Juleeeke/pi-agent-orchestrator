import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getAgentProfile } from "../src/config/profiles.ts";
import { TASK_SCHEMA_VERSION, type TaskEnvelope } from "../src/domain/task.ts";
import { Orchestrator } from "../src/orchestrator/orchestrator.ts";

test("runs a child through RPC and persists an isolated result", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "pi-orchestrator-test-"));
  const workspace = path.join(tempRoot, "workspace");
  await mkdir(workspace);
  const fakePi = fileURLToPath(new URL("./fixtures/fake-pi.mjs", import.meta.url));
  await chmod(fakePi, 0o755);

  const task: TaskEnvelope = {
    version: TASK_SCHEMA_VERSION,
    taskId: "integration-scout",
    agent: "scout",
    objective: "Inspect the fake workspace",
    workspace: { path: workspace, access: "read-only" },
    constraints: ["Do not modify files"],
    successCriteria: ["Return a verified result"],
    allowedTools: [...getAgentProfile("scout").allowedTools],
    budgets: { timeoutMs: 5_000, maxOutputChars: 10_000 },
  };

  const orchestrator = new Orchestrator({ runtimeRoot: tempRoot, piBin: fakePi });
  const result = await orchestrator.dispatch(task);

  assert.equal(result.status, "completed");
  assert.equal(result.summary, "verified fake child result");
  const persisted = JSON.parse(
    await readFile(path.join(tempRoot, "tasks", task.taskId, "result.json"), "utf8"),
  ) as { status: string; summary: string };
  assert.deepEqual(persisted, {
    ...result,
  });
});
