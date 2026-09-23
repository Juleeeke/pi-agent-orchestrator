#!/usr/bin/env node

let buffer = "";

function emit(record) {
  process.stdout.write(`${JSON.stringify(record)}\n`);
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  while (true) {
    const newline = buffer.indexOf("\n");
    if (newline === -1) break;
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const command = JSON.parse(line);
    emit({
      id: command.id,
      type: "response",
      command: command.type,
      success: true,
    });
    emit({
      type: "message_update",
      assistantMessageEvent: {
        type: "text_delta",
        delta: "verified fake child result",
      },
    });
    emit({ type: "agent_settled" });
  }
});
