import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./api-client", () => ({
  resolvePanelApiPath: (path: string) => `/panel${path}`,
  scopeHeaders: () => ({ "X-Bridge-Session-Id": "selected-bridge" }),
}));
import { createNotificationStream } from "./notification-event-stream";

afterEach(() => { vi.unstubAllGlobals(); });

describe("notification stream transport", () => {
  it("sends the tab's bridge header and parses SSE split across chunks", async () => {
    let writer!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start(controller) { writer = controller; } });
    const fetchMock = vi.fn(async () => ({ ok: true, body }));
    vi.stubGlobal("fetch", fetchMock);
    const stream = createNotificationStream();
    const received = vi.fn();
    stream.addEventListener("notification:created", received);
    try {
      await vi.waitFor(() => expect(stream.readyState).toBe(1));
      expect(fetchMock).toHaveBeenCalledWith("/panel/api/notifications/stream", expect.objectContaining({
        headers: { "X-Bridge-Session-Id": "selected-bridge", Accept: "text/event-stream" }, credentials: "include",
      }));
      const encoder = new TextEncoder();
      writer.enqueue(encoder.encode(": heartbeat\r\nevent: notification:cre"));
      writer.enqueue(encoder.encode("ated\r\ndata: {\"id\":\"a\"}\r\n\r\n"));
      await vi.waitFor(() => expect(received).toHaveBeenCalledOnce());
      expect((received.mock.calls[0]![0] as MessageEvent).data).toBe('{"id":"a"}');
    } finally { stream.close(); }
  });

  it("aborts on close and suppresses a delayed connection", async () => {
    let resolve!: (response: unknown) => void;
    const fetchMock = vi.fn(() => new Promise(done => { resolve = done; }));
    vi.stubGlobal("fetch", fetchMock);
    const stream = createNotificationStream();
    const opened = vi.fn(), error = vi.fn();
    stream.addEventListener("open", opened); stream.addEventListener("error", error);
    stream.close();
    resolve({ ok: true, body: new ReadableStream() });
    await Promise.resolve(); await Promise.resolve();
    expect((fetchMock.mock.calls[0] as unknown[])[1]).toMatchObject({ signal: expect.objectContaining({ aborted: true }) });
    expect(stream.readyState).toBe(2);
    expect(opened).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
  });
});
