export type ChatStreamEvent = { type: string; data: unknown };
/** Incremental SSE parser, tolerant of CRLF and multi-line data. */
export class ChatStreamParser {
  private buffer = "";
  push(chunk: string): ChatStreamEvent[] {
    this.buffer += chunk;
    const output: ChatStreamEvent[] = [];
    let match: RegExpExecArray | null;
    while ((match = /\r?\n\r?\n/.exec(this.buffer))) {
      const frame = this.buffer.slice(0, match.index);
      this.buffer = this.buffer.slice(match.index + match[0].length);
      let type = "message";
      const data: string[] = [];
      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith("event:")) type = line.slice(6).trim();
        if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (data.length)
        try {
          output.push({ type, data: JSON.parse(data.join("\n")) });
        } catch {
          /* Malformed event does not close a live session. */
        }
    }
    if (this.buffer.length > 1048576) this.buffer = "";
    return output;
  }
}
