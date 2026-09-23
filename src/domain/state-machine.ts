import type { TaskStatus } from "./task.ts";

const TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  queued: ["starting", "cancelled"],
  starting: ["running", "failed", "timed_out", "cancelled"],
  running: ["completed", "failed", "timed_out", "cancelled"],
  completed: [],
  failed: [],
  timed_out: [],
  cancelled: [],
};

export function transitionTask(current: TaskStatus, next: TaskStatus): TaskStatus {
  if (!TRANSITIONS[current].includes(next)) {
    throw new Error(`invalid task transition: ${current} -> ${next}`);
  }
  return next;
}
