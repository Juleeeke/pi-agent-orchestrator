import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TaskResult } from "../domain/task.ts";

export class EventStore {
  readonly #tails = new Map<string, Promise<void>>();
  readonly runtimeRoot: string;

  constructor(runtimeRoot: string) {
    this.runtimeRoot = runtimeRoot;
  }

  taskDirectory(taskId: string): string {
    return path.join(this.runtimeRoot, "tasks", taskId);
  }

  async prepare(taskId: string): Promise<void> {
    await mkdir(path.join(this.taskDirectory(taskId), "session"), { recursive: true });
    await mkdir(path.join(this.taskDirectory(taskId), "artifacts"), { recursive: true });
  }

  append(taskId: string, event: unknown): Promise<void> {
    const previous = this.#tails.get(taskId) ?? Promise.resolve();
    const next = previous.then(async () => {
      await appendFile(
        path.join(this.taskDirectory(taskId), "events.jsonl"),
        `${JSON.stringify(event)}\n`,
        "utf8",
      );
    });
    this.#tails.set(taskId, next);
    return next;
  }

  async flush(taskId: string): Promise<void> {
    await this.#tails.get(taskId);
  }

  async writeResult(result: TaskResult): Promise<void> {
    await this.flush(result.taskId);
    await writeFile(
      path.join(this.taskDirectory(result.taskId), "result.json"),
      `${JSON.stringify(result, null, 2)}\n`,
      "utf8",
    );
  }
}
