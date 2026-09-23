# Architecture

## Trust boundary

The mother agent is a supervisor with one capability: dispatching a bounded task. It does not receive filesystem or shell tools. A child is a fresh Pi RPC process and receives only a generated task prompt, its own system prompt, a strict tool allowlist, and an isolated session directory.

The current MVP provides logical isolation, not an operating-system sandbox. A child process still runs as the invoking user. Container or micro-VM isolation is required before untrusted, write-capable workers are added.

## Data flow

1. The mother constructs a `TaskEnvelope` through `dispatch_task`.
2. The orchestrator validates the envelope and records `queued`, `starting`, and `running` transitions.
3. The runner starts a fresh `pi --mode rpc` process with automatic context, skills, prompts, themes, extensions, and project trust disabled.
4. The child independently investigates the objective with read-only tools.
5. The runner waits for `agent_settled`, persists the event stream and normalized result, and closes the child process.
6. The mother receives only `TaskResult`, not the child's session or full parent context.

## Current security properties

- No parent message history is serialized into a child request.
- Child context-file, skill, prompt-template, theme, and extension discovery are disabled.
- Child tools are allowlisted to `read`, `grep`, `find`, and `ls`.
- Each task receives a distinct session and artifact directory.
- The child environment is rebuilt from an allowlist rather than inherited wholesale.
- Time and model-visible output are bounded.
- RPC events and state transitions are stored as JSONL for audit.

## Planned increments

1. Add a mock RPC fixture and a real authenticated opt-in smoke test.
2. Add a planner profile with no mutation tools.
3. Add an OS sandbox runner and read-only filesystem mounts.
4. Add worker/reviewer profiles, isolated Git worktrees, approval gates, and patch artifacts.
5. Add a dependency-aware scheduler with bounded concurrency.
