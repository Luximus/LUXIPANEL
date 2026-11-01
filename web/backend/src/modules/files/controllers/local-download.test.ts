// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseDownloadRange, streamLocalDownload } from "./local-download.js";

class CaptureResponse extends Writable {
  statusCode = 200;
  headers: Record<string, string | number> = {};
  parts: Buffer[] = [];
  setHeader(name: string, value: string | number) { this.headers[name] = value; }
  status(code: number) { this.statusCode = code; return this; }
  _write(chunk: Buffer, _encoding: BufferEncoding, callback: () => void) { this.parts.push(Buffer.from(chunk)); callback(); }
  bytes() { return Buffer.concat(this.parts); }
}

describe("local file ranges", () => {
  it.each([
    ["bytes=0-3", 10, { start: 0, end: 3 }],
    ["bytes=7-99", 10, { start: 7, end: 9 }],
    ["bytes=7-", 10, { start: 7, end: 9 }],
    ["bytes=-3", 10, { start: 7, end: 9 }],
    ["bytes=-30", 10, { start: 0, end: 9 }],
    ["bytes=10-11", 10, null],
    ["bytes=5-2", 10, null],
    ["bytes=-0", 10, null],
    ["bytes=0-0", 0, null],
    ["bytes=0-1,4-5", 10, null],
    ["bytes=90071992547409999-", 10, null],
  ] as const)("parses %s for a file of %i bytes", (range, size, expected) => {
    expect(parseDownloadRange(range, size)).toEqual(expected);
  });
});

describe("local file streaming", () => {
  let dir: string, file: string;
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), "lxp-download-test-")); file = path.join(dir, "app-debug.apk"); await writeFile(file, "0123456789"); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });
  async function download(headers: Record<string, string> = {}, method = "GET") {
    const res = new CaptureResponse();
    await streamLocalDownload({ headers, method } as never, res as never, file);
    return res;
  }
  it("streams the full file for an ordinary download", async () => {
    const res = await download();
    expect(res.bytes().toString()).toBe("0123456789");
    expect(res.statusCode).toBe(200);
    expect(res.headers["Accept-Ranges"]).toBe("bytes");
    expect(res.headers["Content-Length"]).toBe(10);
  });
  it("streams only the requested bytes and supplies a strong validator", async () => {
    const res = await download({ range: "bytes=2-5" });
    expect(res.bytes().toString()).toBe("2345");
    expect(res.statusCode).toBe(206);
    expect(res.headers["Content-Range"]).toBe("bytes 2-5/10");
    expect(res.headers["Content-Length"]).toBe(4);
    expect(res.headers["ETag"]).toMatch(/^".+"$/);
    expect(res.headers["Cache-Control"]).toContain("no-transform");
  });
  it("resumes the same build with If-Range", async () => {
    const first = await download({ range: "bytes=0-4" });
    const second = await download({ range: "bytes=5-9", "if-range": String(first.headers["ETag"]) });
    expect(second.statusCode).toBe(206);
    expect(Buffer.concat([first.bytes(), second.bytes()]).toString()).toBe("0123456789");
  });
  it("returns a fresh full response if the APK changed between chunks", async () => {
    const first = await download({ range: "bytes=0-4" });
    await writeFile(file, "new APK build");
    const second = await download({ range: "bytes=5-9", "if-range": String(first.headers["ETag"]) });
    expect(second.statusCode).toBe(200);
    expect(second.headers["ETag"]).not.toBe(first.headers["ETag"]);
    expect(second.bytes().toString()).toBe("new APK build");
  });
  it("returns 416 with no bytes for an unsatisfiable range", async () => {
    const res = await download({ range: "bytes=99-100" });
    expect(res.statusCode).toBe(416);
    expect(res.headers["Content-Range"]).toBe("bytes */10");
    expect(res.bytes().length).toBe(0);
  });
  it("HEAD sends metadata without reading a body", async () => {
    const res = await download({}, "HEAD");
    expect(res.headers["Content-Length"]).toBe(10);
    expect(res.bytes().length).toBe(0);
  });
});
