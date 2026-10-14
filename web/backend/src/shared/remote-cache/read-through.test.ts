// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — read-through.ts and refresh.ts integration with the
 * cacheable allowlist. Mocks the executor + panel-local Redis.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { gzipSync } from "node:zlib";

const memStore = new Map<string, { value: string; expiresAt: number }>();
const delSpy = vi.fn();
vi.mock("../redis/index.js", () => ({
  getRedis: () => ({
    async get(k: string) {
      const e = memStore.get(k);
      if (!e) return null;
      if (e.expiresAt && Date.now() > e.expiresAt) {
        memStore.delete(k);
        return null;
      }
      return e.value;
    },
    async set(k: string, v: string, _mode?: string, ttl?: number) {
      memStore.set(k, {
        value: v,
        expiresAt: ttl ? Date.now() + ttl * 1000 : 0,
      });
      return "OK";
    },
    async del(k: string) {
      delSpy(k);
      memStore.delete(k);
      return 1;
    },
  }),
}));

import { listCached } from "./read-through.js";
import { scheduleRefresh, _resetRefreshForTests } from "./refresh.js";
import { _resetRemoteCacheForTests } from "./index.js";
import { _resetRemoteCacheConnForTests } from "./conn.js";
import { _resetMetricsForTests } from "./metrics.js";
import type { Executor } from "../executor/types.js";

function b64gz(obj: unknown): string {
  return gzipSync(Buffer.from(JSON.stringify(obj), "utf-8")).toString("base64");
}

interface FakeExecOpts {
  id?: string;
  hasConn?: boolean;
  cachedMeta?: unknown;
  cachedData?: unknown;
  execSpy?: ReturnType<typeof vi.fn>;
}

function makeExecutor(opts: FakeExecOpts = {}): Executor {
  const id = opts.id ?? "T1";
  const execSpy =
    opts.execSpy ??
    vi.fn().mockImplementation(async () => {
      const stdout =
        `${opts.cachedMeta === undefined ? "(nil)" : b64gz(opts.cachedMeta)}\n` +
        `${opts.cachedData === undefined ? "(nil)" : b64gz(opts.cachedData)}\n`;
      return { stdout, stderr: "", exitCode: 0, durationMs: 1 };
    });
  return {
    target: { id, name: id },
    async readFile(filePath: string) {
      if (filePath.endsWith("/cache/conn.json")) {
        if (!opts.hasConn) throw new Error("ENOENT");
        return JSON.stringify({ host: "127.0.0.1", port: 7379, password: "hex" });
      }
      throw new Error("not mocked: " + filePath);
    },
    exec: execSpy as any,
    async writeFile() {},
    async readdir() { return []; },
    async stat() { return {} as any; },
    async mkdir() {},
    async unlink() {},
    async rename() {},
    spawn() { return null as any; },
  };
}

beforeEach(() => {
  memStore.clear();
  delSpy.mockClear();
  _resetRemoteCacheForTests();
  _resetRemoteCacheConnForTests();
  _resetMetricsForTests();
  _resetRefreshForTests();
});

describe("listCached", () => {
  it("returns cached rows for a cacheable module without invoking the loader", async () => {
    const rows = [{ id: "u1", username: "alice" }];
    const meta = {
      schemaVersion: 1, version: "v1", count: 1,
      collectedAt: Math.floor(Date.now() / 1000) - 5,
      source: "sidecar-mirror", pageSizes: [10, 20, 50, 100],
      pages: { "10": 1, "20": 1, "50": 1, "100": 1 },
    };
    const ex = makeExecutor({ hasConn: true, cachedMeta: meta, cachedData: rows });
    const loader = vi.fn(async () => [{ id: "ignored" }] as any);

    const out = await listCached(ex, "webhooks", "webhooks", loader);
    expect(out).toEqual(rows);
    expect(loader).not.toHaveBeenCalled();
  });

  it("falls back to the loader on cache miss / no conn", async () => {
    const ex = makeExecutor({ hasConn: false });
    const loader = vi.fn(async () => [{ id: "fromJson" }] as any);

    const out = await listCached(ex, "webhooks", "webhooks", loader);
    expect(out).toEqual([{ id: "fromJson" }]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("bypasses the cache entirely for non-cacheable modules (no exec)", async () => {
    const execSpy = vi.fn();
    const ex = makeExecutor({ hasConn: true, execSpy });
    const loader = vi.fn(async () => [{ id: "vol" }] as any);

    const out = await listCached(ex, "files", "anything", loader);
    expect(out).toEqual([{ id: "vol" }]);
    expect(execSpy).not.toHaveBeenCalled();
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe("scheduleRefresh", () => {
  it("execs dispatcher with --entry for cacheable (module, collection) and DELs panel-meta", async () => {
    const execSpy = vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 1 }));
    const ex = makeExecutor({ id: "T-X", execSpy });
    // pre-populate panel meta so we can assert it gets dropped
    memStore.set("panel:rc:T-X:webhooks:webhooks", {
      value: JSON.stringify({ version: "old", count: 0, collectedAt: 0 }),
      expiresAt: 0,
    });

    await scheduleRefresh(ex, "webhooks", "webhooks");

    expect(delSpy).toHaveBeenCalledWith("panel:rc:T-X:webhooks:webhooks");
    expect(execSpy).toHaveBeenCalledTimes(1);
    expect(execSpy.mock.calls[0]![0]).toMatch(/dispatcher\.sh --entry webhooks webhooks/);
  });

  it("coalesces bursts: a second refresh within the window reuses the in-flight promise", async () => {
    const execSpy = vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 1 }));
    const ex = makeExecutor({ execSpy });

    const a = scheduleRefresh(ex, "webhooks", "webhooks");
    const b = scheduleRefresh(ex, "webhooks", "webhooks");
    expect(a).toBe(b);
    await Promise.all([a, b]);
    expect(execSpy).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for non-cacheable / volatile modules", async () => {
    const execSpy = vi.fn();
    const ex = makeExecutor({ execSpy });
    await scheduleRefresh(ex, "files", "anything");
    await scheduleRefresh(ex, "monitor", "alert-events");
    expect(execSpy).not.toHaveBeenCalled();
    expect(delSpy).not.toHaveBeenCalled();
  });

  it("rejects unsafe module/collection tokens (defence in depth)", async () => {
    const execSpy = vi.fn();
    const ex = makeExecutor({ execSpy });
    // Even if the policy were somehow tricked, the safeToken regex protects
    // the shell command. Use a known cacheable module so cachePolicyFor
    // doesn't short-circuit, but pass an injection-shaped collection.
    // (cachePolicyFor returns null for unknown collections, so this is
    // belt-and-suspenders: we ensure no exec fires for either reason.)
    await scheduleRefresh(ex, "auth", "users; rm -rf /");
    expect(execSpy).not.toHaveBeenCalled();
  });
});
