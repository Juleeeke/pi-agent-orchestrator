import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Orchestrator } from "./orchestrator/orchestrator.ts";

const repositoryRoot = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

async function main(): Promise<void> {
  const taskFile = process.argv[2];
  if (!taskFile) {
    throw new Error("usage: npm run dev -- /absolute/path/to/task.json");
  }

  const task = JSON.parse(await readFile(path.resolve(taskFile), "utf8")) as unknown;
  const orchestrator = new Orchestrator({
    runtimeRoot: process.env.PI_ORCHESTRATOR_RUNTIME_ROOT ?? path.join(repositoryRoot, "runtime"),
    piBin: process.env.PI_BIN,
  });
  const result = await orchestrator.dispatch(task);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== "completed") process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
