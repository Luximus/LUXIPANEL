import { describe, expect, it } from "vitest";
import { takeAgentEvents } from "./directAgent";

describe("takeAgentEvents", () => {
  it("preserves a partial frame and decodes the next SSE chunk", () => {
    const first = takeAgentEvents('id: 1\r\ndata: {"type":"text","delta":"Hola"}\r\n\r\ndata: {"type":"do');
    expect(first.events).toEqual([{ type: "text", delta: "Hola" }]);
    const second = takeAgentEvents(first.rest + 'ne"}\n\n');
    expect(second.events).toEqual([{ type: "done" }]);
    expect(second.rest).toBe("");
  });
});
