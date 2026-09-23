import { StringDecoder } from "node:string_decoder";

export class StrictJsonlDecoder {
  readonly #decoder = new StringDecoder("utf8");
  #buffer = "";

  push(chunk: Buffer | string): unknown[] {
    this.#buffer += typeof chunk === "string" ? chunk : this.#decoder.write(chunk);
    const records: unknown[] = [];

    while (true) {
      const newline = this.#buffer.indexOf("\n");
      if (newline === -1) break;

      let line = this.#buffer.slice(0, newline);
      this.#buffer = this.#buffer.slice(newline + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.length === 0) continue;
      records.push(JSON.parse(line));
    }

    return records;
  }

  finish(): void {
    this.#buffer += this.#decoder.end();
    if (this.#buffer.length > 0) {
      throw new Error("RPC stream ended with an incomplete JSONL record");
    }
  }
}
