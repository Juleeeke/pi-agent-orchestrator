import assert from "node:assert/strict";
import test from "node:test";
import { transitionTask } from "../src/domain/state-machine.ts";

test("allows the normal lifecycle", () => {
  assert.equal(transitionTask("queued", "starting"), "starting");
  assert.equal(transitionTask("starting", "running"), "running");
  assert.equal(transitionTask("running", "completed"), "completed");
});

test("rejects transitions out of terminal states", () => {
  assert.throws(() => transitionTask("completed", "running"), /invalid task transition/);
});
