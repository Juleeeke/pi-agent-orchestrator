import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeChildEnvironment } from "../src/runtime/environment.ts";
import { buildPiCommand } from "../src/runtime/pi-rpc-child.ts";

test("child command disables implicit context and resources", () => {
  const command = buildPiCommand({
    piBin: "pi",
    workspace: "/tmp/workspace",
    sessionDir: "/tmp/runtime/task/session",
    taskId: "task-1",
    tools: ["read", "grep"],
    systemPrompt: "isolated",
  });
  assert.equal(command.command, "pi");
  for (const flag of [
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-context-files",
    "--no-approve",
  ]) {
    assert.ok(command.args.includes(flag), `missing ${flag}`);
  }
  assert.equal(command.args[command.args.indexOf("--tools") + 1], "read,grep");
});

test("child environment drops unrelated parent variables", () => {
  const env = sanitizeChildEnvironment({
    HOME: "/tmp/home",
    PATH: "/usr/bin",
    OPENAI_API_KEY: "allowed-provider-secret",
    UNRELATED_SECRET: "must-not-leak",
  });
  assert.equal(env.HOME, "/tmp/home");
  assert.equal(env.OPENAI_API_KEY, "allowed-provider-secret");
  assert.equal(env.UNRELATED_SECRET, undefined);
  assert.equal(env.PI_TELEMETRY, "0");
});
