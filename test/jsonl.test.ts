import assert from "node:assert/strict";
import test from "node:test";
import { StrictJsonlDecoder } from "../src/runtime/jsonl.ts";

test("splits only on LF and preserves unicode separators", () => {
  const decoder = new StrictJsonlDecoder();
  const payload = `${JSON.stringify({ text: "a\u2028b\u2029c" })}\n`;
  const first = Buffer.from(payload).subarray(0, 7);
  const second = Buffer.from(payload).subarray(7);
  assert.deepEqual(decoder.push(first), []);
  assert.deepEqual(decoder.push(second), [{ text: "a\u2028b\u2029c" }]);
  assert.doesNotThrow(() => decoder.finish());
});

test("rejects a final record without LF framing", () => {
  const decoder = new StrictJsonlDecoder();
  decoder.push('{"ok":true}');
  assert.throws(() => decoder.finish(), /incomplete JSONL record/);
});
