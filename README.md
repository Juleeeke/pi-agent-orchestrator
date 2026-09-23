# Pi Agent Orchestrator

A context-isolated mother/child agent runtime built on Pi. The mother agent plans and delegates; each child runs in a fresh Pi RPC process with its own prompt, tool allowlist, session directory, and sanitized environment.

## MVP status

Implemented:

- Mother-agent Pi extension exposing only `dispatch_task`
- Read-only autonomous `scout` child
- Strict `TaskEnvelope` validation
- Separate Pi RPC process per child
- Disabled implicit context, skills, prompt templates, themes, extensions, and project resources
- Per-task session, event log, result file, timeout, cancellation, and output cap
- Unit tests for protocol, state transitions, JSONL framing, tool isolation, and environment isolation

Not yet implemented:

- OS/container sandboxing
- Write-capable workers
- Multiple concurrent children and DAG scheduling
- Durable resume after orchestrator restart
- Cost/token enforcement (time and output limits are enforced now)

## Requirements

- Node.js 22.19 or newer
- Pi 0.87.1 available as `pi`
- A configured Pi model provider

## Install

```bash
npm install
npm run check
```

## Start the mother agent

```bash
npm run mother
```

You may pass normal Pi model flags after `--`:

```bash
npm run mother -- --model openai/gpt-5.4 --thinking high
```

The launcher deliberately gives the mother only the `dispatch_task` tool. The mother cannot read or modify workspace files directly.

## Run one task without the mother UI

Copy `examples/scout-task.json`, replace its workspace with an absolute path, then run:

```bash
npm run dev -- /absolute/path/to/task.json
```

Task logs and normalized results are written below `runtime/tasks/<task-id>/`.

## Isolation boundary

This MVP provides process, context, prompt, tool, resource-discovery, session, and environment separation. It does **not** yet provide a kernel-level security boundary: Pi child processes still run as the current operating-system user. See [docs/architecture.md](docs/architecture.md) before adding write tools or running untrusted tasks.
