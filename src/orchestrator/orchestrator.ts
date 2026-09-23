import { getAgentProfile } from "../config/profiles.ts";
import {
  TASK_SCHEMA_VERSION,
  type TaskEnvelope,
  type TaskResult,
  type TaskStatus,
  validateTaskEnvelope,
} from "../domain/task.ts";
import { transitionTask } from "../domain/state-machine.ts";
import { EventStore } from "../runtime/event-store.ts";
import {
  ChildAbortedError,
  ChildTimeoutError,
  PiRpcChildRunner,
} from "../runtime/pi-rpc-child.ts";

export interface OrchestratorOptions {
  runtimeRoot: string;
  piBin?: string;
  model?: string;
  thinking?: string;
}

export class Orchestrator {
  readonly #statuses = new Map<string, TaskStatus>();
  readonly #controllers = new Map<string, AbortController>();
  readonly #store: EventStore;
  readonly options: OrchestratorOptions;

  constructor(options: OrchestratorOptions) {
    this.options = options;
    this.#store = new EventStore(options.runtimeRoot);
  }

  getStatus(taskId: string): TaskStatus | undefined {
    return this.#statuses.get(taskId);
  }

  cancel(taskId: string): boolean {
    const controller = this.#controllers.get(taskId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  async dispatch(input: unknown, externalSignal?: AbortSignal): Promise<TaskResult> {
    validateTaskEnvelope(input);
    const task: TaskEnvelope = input;
    if (this.#statuses.has(task.taskId)) {
      throw new Error(`task already exists: ${task.taskId}`);
    }

    await this.#store.prepare(task.taskId);
    this.#statuses.set(task.taskId, "queued");
    await this.#recordState(task.taskId, "queued");
    await this.#move(task.taskId, "starting");

    const controller = new AbortController();
    const abortFromCaller = () => controller.abort();
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
    if (externalSignal?.aborted) controller.abort();
    this.#controllers.set(task.taskId, controller);

    const runner = new PiRpcChildRunner({
      piBin: this.options.piBin,
      runtimeRoot: this.options.runtimeRoot,
      model: this.options.model,
      thinking: this.options.thinking,
      onEvent: (event) => {
        void this.#store.append(task.taskId, {
          at: new Date().toISOString(),
          kind: "pi_rpc",
          event,
        });
      },
    });

    await this.#move(task.taskId, "running");
    let result: TaskResult;
    try {
      const output = await runner.run(task, getAgentProfile(task.agent), controller.signal);
      await this.#move(task.taskId, "completed");
      result = {
        version: TASK_SCHEMA_VERSION,
        taskId: task.taskId,
        agent: task.agent,
        status: "completed",
        summary: output.text,
        artifacts: [],
        warnings: output.warningMessages,
        usage: {
          durationMs: output.durationMs,
          outputChars: output.text.length,
          outputTruncated: output.outputTruncated,
        },
      };
    } catch (error) {
      const status =
        error instanceof ChildTimeoutError
          ? "timed_out"
          : error instanceof ChildAbortedError
            ? "cancelled"
            : "failed";
      await this.#move(task.taskId, status);
      result = {
        version: TASK_SCHEMA_VERSION,
        taskId: task.taskId,
        agent: task.agent,
        status,
        summary: "",
        artifacts: [],
        warnings: [],
        usage: { durationMs: 0, outputChars: 0, outputTruncated: false },
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.#controllers.delete(task.taskId);
      externalSignal?.removeEventListener("abort", abortFromCaller);
    }

    await this.#store.writeResult(result);
    return result;
  }

  async #move(taskId: string, next: TaskStatus): Promise<void> {
    const current = this.#statuses.get(taskId);
    if (!current) throw new Error(`task has no state: ${taskId}`);
    this.#statuses.set(taskId, transitionTask(current, next));
    await this.#recordState(taskId, next);
  }

  async #recordState(taskId: string, status: TaskStatus): Promise<void> {
    await this.#store.append(taskId, {
      at: new Date().toISOString(),
      kind: "state",
      status,
    });
  }
}
