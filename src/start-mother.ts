import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const extensionPath = path.join(repositoryRoot, "extensions", "orchestrator.ts");
const motherPrompt = await readFile(path.join(repositoryRoot, "prompts", "mother.system.md"), "utf8");

const args = [
  "--no-extensions",
  "--extension",
  extensionPath,
  "--no-skills",
  "--no-prompt-templates",
  "--no-themes",
  "--no-context-files",
  "--no-approve",
  "--tools",
  "dispatch_task",
  "--system-prompt",
  motherPrompt,
  ...process.argv.slice(2),
];

const child = spawn(process.env.PI_BIN ?? "pi", args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PI_ORCHESTRATOR_RUNTIME_ROOT:
      process.env.PI_ORCHESTRATOR_RUNTIME_ROOT ?? path.join(repositoryRoot, "runtime"),
  },
  stdio: "inherit",
});

child.once("error", (error) => {
  process.stderr.write(`failed to start mother agent: ${error.message}\n`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.stderr.write(`mother agent exited from signal ${signal}\n`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
