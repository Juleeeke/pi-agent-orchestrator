import assert from "node:assert/strict";
import test from "node:test";
import registerOrchestrator from "../extensions/orchestrator.ts";

test("registers only the dispatch_task mother capability", () => {
  const tools: Array<{ name: string }> = [];
  registerOrchestrator({
    registerTool(tool: { name: string }) {
      tools.push(tool);
    },
  } as never);
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ["dispatch_task"],
  );
});
