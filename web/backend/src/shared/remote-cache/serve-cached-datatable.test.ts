// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — serveCachedDataTable
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { gzipSync } from "node:zlib";

const memStore = new Map<string, { value: string; expiresAt: number }>();
vi.mock("../redis/index.js", () => ({
  getRedis: () => ({
    async get(k: string) { return memStore.get(k)?.value ?? null; },
    async set(k: string, v: string, _m?: string, ttl?: number) {
      memStore.set(k, { value: v, expiresAt: ttl ? Date.now() + ttl * 1000 : 0 });
      return "OK";
    },
    async del(k: string) { memStore.delete(k); return 1; },
  }),
}));

import { serveCachedDataTable } from "./serve-cached-datatable.js";
import { _resetRemoteCacheForTests } from "./index.js";
import { _resetRemoteCacheConnForTests } from "./conn.js";
import { _resetMetricsForTests } from "./metrics.js";
import type { Executor } from "../executor/types.js";

function b64gz(o: unknown): string {
  return gzipSync(Buffer.from(JSON.stringify(o), "utf-8")).toString("base64");
}

function makeExecutor(opts: {
  id?: string;
  cachedMeta?: unknown;
  cachedData?: unknown;
  hasConn?: boolean;
}): Executor {
  return {
    target: { id: opts.id ?? "T1", name: opts.id ?? "T1" },
    async readFile(filePath: string) {
      if (filePath.endsWith("/cache/conn.json") && opts.hasConn !== false) {
        return JSON.stringify({ host: "127.0.0.1", port: 7379, password: "x" });
      }
      throw new Error("ENOENT");
    },
    async exec() {
      const stdout =
        `${opts.cachedMeta === undefined ? "(nil)" : b64gz(opts.cachedMeta)}\n` +
        `${opts.cachedData === undefined ? "(nil)" : b64gz(opts.cachedData)}\n`;
      return { stdout, stderr: "", exitCode: 0, durationMs: 1 };
    },
    async writeFile() {}, async readdir() { return []; }, async stat() { return {} as any; },
    async mkdir() {}, async unlink() {}, async rename() {}, spawn() { return null as any; },
  };
}

beforeEach(() => {
  memStore.clear();
  _resetRemoteCacheForTests();
  _resetRemoteCacheConnForTests();
  _resetMetricsForTests();
});

describe("serveCachedDataTable", () => {
  it("returns cached rows for a cacheable collection without calling liveLoader", async () => {
    const meta = {
      schemaVersion: 1, version: "v1", count: 1,
      collectedAt: Math.floor(Date.now() / 1000) - 5,
      source: "system-collector", pageSizes: [10, 20, 50, 100],
      pages: { "10": 1, "20": 1, "50": 1, "100": 1 },
    };
    const rows = [{ address: "a@x.com", quotaMb: 100 }];
    const ex = makeExecutor({ cachedMeta: meta, cachedData: rows, hasConn: true });
    const live = vi.fn();
    const out = await serveCachedDataTable<any>({
      executor: ex, module: "mail", collection: "accounts",
      liveLoader: live,
    });
    expect(out.fromCache).toBe(true);
    expect(out.rows).toEqual(rows);
    expect(out.version).toBe("v1");
    expect(live).not.toHaveBeenCalled();
  });

  it("falls back to liveLoader on cache miss", async () => {
    const ex = makeExecutor({ hasConn: false });
    const live = vi.fn(async () => [{ address: "live@x.com" }] as any);
    const out = await serveCachedDataTable<any>({
      executor: ex, module: "mail", collection: "accounts", liveLoader: live,
    });
    expect(out.fromCache).toBe(false);
    expect(out.rows).toEqual([{ address: "live@x.com" }]);
    expect(live).toHaveBeenCalledTimes(1);
  });

  it("bypasses cache for non-cacheable modules", async () => {
    const ex = makeExecutor({ hasConn: true });
    const live = vi.fn(async () => [{ id: "x" }] as any);
    const out = await serveCachedDataTable<any>({
      executor: ex, module: "files", collection: "anything", liveLoader: live,
    });
    expect(out.fromCache).toBe(false);
    expect(live).toHaveBeenCalledTimes(1);
  });

  it("respects forceLive flag (skips cache even when allowlisted)", async () => {
    const meta = { schemaVersion: 1, version: "v1", count: 0, collectedAt: Date.now() / 1000, source: "sidecar-mirror", pageSizes: [10,20,50,100], pages: {"10":0} };
    const ex = makeExecutor({ cachedMeta: meta, cachedData: [], hasConn: true });
    const live = vi.fn(async () => [{ live: true }] as any);
    const out = await serveCachedDataTable<any>({
      executor: ex, module: "mail", collection: "accounts",
      liveLoader: live, forceLive: true,
    });
    expect(out.fromCache).toBe(false);
    expect(live).toHaveBeenCalledTimes(1);
  });
});
