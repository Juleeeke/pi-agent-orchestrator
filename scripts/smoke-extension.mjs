import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const agentDir = await mkdtemp(path.join(tmpdir(), "pi-orchestrator-smoke-"));
const extension = path.join(repositoryRoot, "extensions", "orchestrator.ts");
const piBin = process.env.PI_BIN ?? "pi";

try {
  const child = spawn(
    piBin,
    [
      "--mode",
      "rpc",
      "--no-session",
      "--offline",
      "--no-extensions",
      "--extension",
      extension,
      "--no-skills",
      "--no-prompt-templates",
      "--no-themes",
      "--no-context-files",
      "--no-approve",
      "--tools",
      "dispatch_task",
    ],
    {
      cwd: repositoryRoot,
      env: { ...process.env, PI_CODING_AGENT_DIR: agentDir },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  let stdout = "";
  let stderr = "";
  let resolved = false;
  const outcome = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("extension smoke test timed out"));
    }, 10_000);

    child.once("error", reject);
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      while (true) {
        const newline = stdout.indexOf("\n");
        if (newline === -1) break;
        const line = stdout.slice(0, newline);
        stdout = stdout.slice(newline + 1);
        if (!line) continue;
        const record = JSON.parse(line);
        if (record.id === "smoke" && record.type === "response") {
          resolved = true;
          child.stdin.end();
          clearTimeout(timeout);
          resolve(record);
        }
      }
    });
    child.once("exit", (code) => {
      if (!resolved) {
        clearTimeout(timeout);
        reject(new Error(`Pi exited before responding (${String(code)}): ${stderr.trim()}`));
      }
    });
    child.once("spawn", () => {
      child.stdin.write(`${JSON.stringify({ id: "smoke", type: "get_state" })}\n`);
    });
  });

  if (!outcome.success) {
    throw new Error(`Pi rejected get_state: ${JSON.stringify(outcome)}`);
  }
  process.stdout.write("Pi loaded the orchestrator extension successfully.\n");
} finally {
  await rm(agentDir, { recursive: true, force: true });
}
