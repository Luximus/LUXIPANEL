// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadFileBlob, saveDownload } from "./download";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const options = () => ({ headers: { "X-Bridge-Session-Id": "target-a" }, onProgress: vi.fn(), idleTimeoutMs: 1000, maxRetries: 0 });

function streamingFetch() {
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  let signal!: AbortSignal;
  const cancel = vi.fn();
  vi.stubGlobal("fetch", vi.fn((_url, init) => {
    signal = init.signal;
    const body = new ReadableStream<Uint8Array>({ start(c) { stream = c; }, cancel });
    signal.addEventListener("abort", () => stream.error(signal.reason), { once: true });
    return Promise.resolve(new Response(body));
  }));
  return { push: (bytes: number[]) => stream.enqueue(new Uint8Array(bytes)), end: () => stream.close(), cancel, signal: () => signal };
}

describe("file download over an unreliable connection", () => {
  it("keeps authentication and the pinned target, and reports received bytes", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Length": "3" } }));
    vi.stubGlobal("fetch", fetch);
    const opts = options();
    const blob = await downloadFileBlob("/panel/api/files/download?path=example", opts);
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3]);
    expect(opts.onProgress).toHaveBeenLastCalledWith({ received: 3, total: 3 });
    expect(fetch).toHaveBeenCalledWith("/panel/api/files/download?path=example", expect.objectContaining({ headers: expect.objectContaining({ ...opts.headers, Range: "bytes=0-524287" }), credentials: "include", cache: "no-store" }));
  });

  it("times out when even the response headers stop arriving", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason)))));
    const result = downloadFileBlob("/download", options());
    const check = expect(result).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(1001);
    await check;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out a stalled body without saving partial data", async () => {
    vi.useFakeTimers();
    const source = streamingFetch();
    const result = downloadFileBlob("/download", options());
    const check = expect(result).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(0);
    source.push([1, 2]);
    await vi.advanceTimersByTimeAsync(1001);
    await check;
    expect(source.signal().aborted).toBe(true);
  });

  it("allows a slow transfer lasting longer than the inactivity limit", async () => {
    vi.useFakeTimers();
    const source = streamingFetch();
    const result = downloadFileBlob("/download", options());
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(900);
      source.push([i]);
      await vi.advanceTimersByTimeAsync(0);
    }
    source.end();
    expect((await result).size).toBe(4);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts the pending read when the caller cancels or changes target", async () => {
    const source = streamingFetch();
    const controller = new AbortController();
    const result = downloadFileBlob("/download", { ...options(), signal: controller.signal });
    const check = expect(result).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();
    controller.abort();
    await check;
    expect(source.signal().aborted).toBe(true);
  });

  it("rejects a truncated response even if HTTP says 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("abc", { headers: { "Content-Length": "10" } })));
    await expect(downloadFileBlob("/download", options())).rejects.toThrow("Incomplete download");
  });

  it("does not compare compressed Content-Length to decoded bytes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("decoded", { headers: { "Content-Length": "2", "Content-Encoding": "gzip" } })));
    expect((await downloadFileBlob("/download", options())).size).toBe(7);
  });

  it("rejects an expired session instead of saving its error response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 })));
    await expect(downloadFileBlob("/download", options())).rejects.toThrow("401");
  });

  it("downloads a large file in ranges and retries only the failed block", async () => {
    const content = new Uint8Array(524288 + 7);
    content.set([11, 22, 33], 524286);
    let failed = false;
    const fetch = vi.fn((_url, init) => {
      const range = /^bytes=(\d+)-(\d+)$/.exec(init.headers.Range)!;
      const start = Number(range[1]), end = Math.min(Number(range[2]), content.length - 1);
      if (start > 0 && !failed) { failed = true; return Promise.reject(new TypeError("network interrupted")); }
      return Promise.resolve(new Response(content.slice(start, end + 1), {
        status: 206, headers: { "Content-Range": `bytes ${start}-${end}/${content.length}`, ETag: '"build-1"', "Content-Type": "application/octet-stream" },
      }));
    });
    vi.stubGlobal("fetch", fetch);
    const opts = { ...options(), maxRetries: 2, onRetry: vi.fn() };
    const result = await downloadFileBlob("/download", opts);
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(content);
    expect(fetch.mock.calls.map(call => call[1].headers.Range)).toEqual(["bytes=0-524287", "bytes=524288-524294", "bytes=524288-524294"]);
    expect(fetch.mock.calls[1]![1].headers["If-Range"]).toBe('"build-1"');
    expect(fetch.mock.calls.every(call => call[1].headers["X-Bridge-Session-Id"] === "target-a")).toBe(true);
    expect(opts.onProgress).toHaveBeenLastCalledWith({ received: content.length, total: content.length });
    expect(opts.onRetry).toHaveBeenCalledOnce();
  });

  it("discards an incomplete block before retrying it", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("ab", { status: 206, headers: { "Content-Range": "bytes 0-3/4", ETag: '"build-1"' } }))
      .mockResolvedValueOnce(new Response("abcd", { status: 206, headers: { "Content-Range": "bytes 0-3/4", ETag: '"build-1"' } }));
    vi.stubGlobal("fetch", fetch);
    const blob = await downloadFileBlob("/download", { ...options(), maxRetries: 1 });
    expect(await blob.text()).toBe("abcd");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([200, 206])("rejects a changed build between blocks (HTTP %s)", async status => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(new Uint8Array(524288), { status: 206, headers: { "Content-Range": "bytes 0-524287/524289", ETag: '"build-1"' } }))
      .mockResolvedValueOnce(new Response("x", { status, headers: { "Content-Range": "bytes 524288-524288/524289", ETag: '"build-2"' } }));
    vi.stubGlobal("fetch", fetch);
    await expect(downloadFileBlob("/download", { ...options(), maxRetries: 3 })).rejects.toThrow("File changed");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects an unexpected range start", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("abcd", { status: 206, headers: { "Content-Range": "bytes 4-7/8", ETag: '"build-1"' } })));
    await expect(downloadFileBlob("/download", options())).rejects.toThrow("Invalid download range");
  });

  it("supports an empty file", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 416, headers: { "Content-Range": "bytes */0" } })));
    expect((await downloadFileBlob("/download", options())).size).toBe(0);
  });

  it("keeps the blob URL alive while the browser starts saving a large file", () => {
    vi.useFakeTimers();
    const click = vi.fn(), remove = vi.fn();
    const anchor = { href: "", download: "", click, remove };
    vi.stubGlobal("document", { createElement: () => anchor, body: { appendChild: vi.fn() } });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:apk");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    saveDownload(new Blob(["apk"]), "app-debug.apk");
    expect(anchor.download).toBe("app-debug.apk");
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(revoke).toHaveBeenCalledWith("blob:apk");
  });
});
