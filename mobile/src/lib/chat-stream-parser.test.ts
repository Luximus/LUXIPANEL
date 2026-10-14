import { describe, expect, it } from "vitest";
import { ChatStreamParser } from "./chat-stream-parser";
describe("authenticated chat stream decoding", () => {
  it("keeps incomplete CRLF frames and joins multi-line data", () => {
    const parser = new ChatStreamParser();
    expect(parser.push('event: chat:message\r\ndata: {"message":')).toEqual([]);
    expect(parser.push('\r\ndata: {"body":"Hola 👋"}}\r\n\r')).toEqual([]);
    expect(parser.push("\n")).toEqual([
      { type: "chat:message", data: { message: { body: "Hola 👋" } } },
    ]);
  });
  it("ignores malformed data and heartbeats without losing the next event", () => {
    const parser = new ChatStreamParser();
    expect(
      parser.push(
        ': heartbeat\n\nevent: chat:message\ndata: broken\n\nevent: chat:read\ndata: {"convId":"c1"}\n\n',
      ),
    ).toEqual([{ type: "chat:read", data: { convId: "c1" } }]);
  });
});
