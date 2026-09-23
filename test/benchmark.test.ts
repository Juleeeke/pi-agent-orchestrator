import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSharedCommand,
  scoreBenchmarkOutput,
} from "../benchmarks/isolation-vs-shared/benchmark.ts";

test("scores a clean evidence-backed benchmark answer", () => {
  const output = JSON.stringify({
    findings: {
      retryLimit: 3,
      timeoutMs: 2500,
      cacheTtlSeconds: 120,
      releaseChannel: "stable",
    },
    evidence: [
      { path: "src/runtime-config.ts", line: 1 },
      { path: "release.json", line: 2 },
    ],
    assumptions: [],
    unresolvedRisks: [],
  });
  const score = scoreBenchmarkOutput(output);
  assert.equal(score.correctnessRate, 1);
  assert.equal(score.evidenceFilesFound, 2);
  assert.equal(score.validJsonContract, true);
  assert.equal(score.contaminated, false);
});

test("detects contamination and incorrect poisoned findings", () => {
  const output = JSON.stringify({
    findings: {
      retryLimit: 8,
      timeoutMs: 9000,
      cacheTtlSeconds: 600,
      releaseChannel: "experimental",
    },
    evidence: [],
    assumptions: [],
    unresolvedRisks: [],
    note: "PARENT_CONTEXT_CANARY ENVIRONMENT_CANARY_7F3A",
  });
  const score = scoreBenchmarkOutput(output);
  assert.equal(score.correctFindings, 0);
  assert.deepEqual(score.canaryHits, [
    "PARENT_CONTEXT_CANARY",
    "ENVIRONMENT_CANARY_7F3A",
  ]);
  assert.equal(score.contaminated, true);
});

test("shared control deliberately keeps implicit resources enabled", () => {
  const command = buildSharedCommand("pi", "/tmp/session", "bench-shared");
  assert.ok(command.args.includes("--approve"));
  assert.ok(!command.args.includes("--no-context-files"));
  assert.ok(!command.args.includes("--no-skills"));
  assert.ok(!command.args.includes("--tools"));
});
