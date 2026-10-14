// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Integration test — full cache-first round-trip for mail/accounts.
 *
 * Exercises the contract from the controller's POV:
 *  1. Cache HIT: `serveCachedDataTable` returns the cached items without
 *     touching the live loader.
 *  2. Cache MISS (no conn.json): liveLoader runs and produces the legacy
 *     response shape.
 *  3. Mutation: a write through dataStore.set fires `scheduleRefresh`
 *     which DELs the panel-meta key and execs the dispatcher `--entry`.
 *  4. Cross-target isolation: two different `target.id`s never see each
 *     other's cached blob.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { gzipSync } from "node:zlib";

// In-memory panel-local Redis stub.
const memStore = new Map<string, { value: string; expiresAt: number }>();
const delSpy = vi.fn();
vi.mock("../redis/index.js", () => ({
  getRedis: () => ({
    async get(k: string) {
      const e = memStore.get(k);
      if (!e) return null;
      if (e.expiresAt && Date.now() > e.expiresAt) { memStore.delete(k); return null; }
      return e.value;
    },
    async set(k: string, v: string, _m?: string, ttl?: number) {
      memStore.set(k, { value: v, expiresAt: ttl ? Date.now() + ttl * 1000 : 0 });
      return "OK";
    },
    async del(k: string) { delSpy(k); memStore.delete(k); return 1; },
  }),
}));

import { serveCachedDataTable } from "./serve-cached-datatable.js";
import { scheduleRefresh, _resetRefreshForTests } from "./refresh.js";
import { _resetRemoteCacheForTests } from "./index.js";
import { _resetRemoteCacheConnForTests } from "./conn.js";
import { _resetMetricsForTests } from "./metrics.js";
import type { Executor } from "../executor/types.js";

function b64gz(o: unknown): string {
  return gzipSync(Buffer.from(JSON.stringify(o), "utf-8")).toString("base64");
}

interface FakeOpts {
  id?: string;
  hasConn?: boolean;
  cachedItems?: unknown;
  execHandler?: (cmd: string) => Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number }>;
}

function makeExecutor(opts: FakeOpts = {}): Executor {
  const id = opts.id ?? "T-prod";
  return {
    target: { id, name: id },
    async readFile(p: string) {
      if (p.endsWith("/cache/conn.json")) {
        if (!opts.hasConn) throw new Error("ENOENT");
        return JSON.stringify({ host: "127.0.0.1", port: 7379, password: "hex" });
      }
      throw new Error("ENOENT");
    },
    async exec(cmd: string) {
      if (opts.execHandler) return opts.execHandler(cmd);
      // Default: meta+payload reply with cachedItems[]
      const meta = {
        schemaVersion: 1, version: "v1", count: Array.isArray(opts.cachedItems) ? opts.cachedItems.length : 0,
        collectedAt: Math.floor(Date.now() / 1000) - 5,
        source: "system-collector", pageSizes: [10, 20, 50, 100],
        pages: { "10": 1, "20": 1, "50": 1, "100": 1 },
      };
      const stdout =
        `${opts.cachedItems === undefined ? "(nil)" : b64gz(meta)}\n` +
        `${opts.cachedItems === undefined ? "(nil)" : b64gz(opts.cachedItems)}\n`;
      return { stdout, stderr: "", exitCode: 0, durationMs: 1 };
    },
    async writeFile() {}, async readdir() { return []; }, async stat() { return {} as any; },
    async mkdir() {}, async unlink() {}, async rename() {}, spawn() { return null as any; },
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

describe("mail/accounts cache-first integration", () => {
  it("HIT: serveCachedDataTable returns engine output without calling liveLoader", async () => {
    const items = [
      { id: 1, address: "a@x.com", domain: "x.com", quotaMb: 100, usedMb: 12.5,
        enabled: true, forwards: [], forwardCount: 0 },
      { id: 2, address: "b@x.com", domain: "x.com", quotaMb: 200, usedMb: 0,
        enabled: false, forwards: [], forwardCount: 0 },
    ];
    const ex = makeExecutor({ hasConn: true, cachedItems: items });
    const live = vi.fn(async () => [] as any);
    const result = await serveCachedDataTable<any>({
      executor: ex, module: "mail", collection: "accounts",
      liveLoader: live,
    });
    expect(result.fromCache).toBe(true);
    expect(result.rows).toEqual(items);
    expect(result.version).toBe("v1");
    expect(live).not.toHaveBeenCalled();
  });

  it("MISS: falls back to liveLoader with the SAME response shape", async () => {
    const ex = makeExecutor({ hasConn: false });
    const liveItems = [
      { id: 1, address: "live@x.com", domain: "x.com", quotaMb: 0, usedMb: null,
        enabled: true, forwards: [], forwardCount: 0 },
    ];
    const live = vi.fn(async () => liveItems);
    const result = await serveCachedDataTable<any>({
      executor: ex, module: "mail", collection: "accounts", liveLoader: live,
    });
    expect(result.fromCache).toBe(false);
    expect(result.rows).toEqual(liveItems);
    expect(live).toHaveBeenCalledOnce();
  });

  it("MUTATION: scheduleRefresh DELs panel-meta + execs dispatcher --entry", async () => {
    memStore.set("panel:rc:T-prod:mail:accounts", {
      value: JSON.stringify({ version: "stale", count: 0, collectedAt: 0 }),
      expiresAt: 0,
    });
    const execSpy = vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 1 }));
    const ex = makeExecutor({ execHandler: execSpy });

    await scheduleRefresh(ex, "mail", "accounts");

    expect(delSpy).toHaveBeenCalledWith("panel:rc:T-prod:mail:accounts");
    expect(execSpy).toHaveBeenCalledOnce();
    expect(execSpy.mock.calls[0]![0]).toMatch(/dispatcher\.sh --entry mail accounts/);
  });

  it("ISOLATION: target A and target B never see each other's blob", async () => {
    const itemsA = [{ id: 1, address: "a@x.com", server: "A" }];
    const itemsB = [{ id: 2, address: "b@y.com", server: "B" }];
    const exA = makeExecutor({ id: "A", hasConn: true, cachedItems: itemsA });
    const exB = makeExecutor({ id: "B", hasConn: true, cachedItems: itemsB });

    const rA = await serveCachedDataTable<any>({
      executor: exA, module: "mail", collection: "accounts",
      liveLoader: async () => [],
    });
    const rB = await serveCachedDataTable<any>({
      executor: exB, module: "mail", collection: "accounts",
      liveLoader: async () => [],
    });
    expect(rA.rows[0].server).toBe("A");
    expect(rB.rows[0].server).toBe("B");
    // Panel-local meta keys are scoped by target.id.
    expect(memStore.has("panel:rc:A:mail:accounts")).toBe(true);
    expect(memStore.has("panel:rc:B:mail:accounts")).toBe(true);
  });

  it("FORCE LIVE: forceLive bypasses cache even when fresh entry exists", async () => {
    const items = [{ id: 9, address: "cached@x.com" }];
    const ex = makeExecutor({ hasConn: true, cachedItems: items });
    const live = vi.fn(async () => [{ id: 99, address: "live@x.com" }] as any);
    const result = await serveCachedDataTable<any>({
      executor: ex, module: "mail", collection: "accounts",
      forceLive: true, liveLoader: live,
    });
    expect(result.fromCache).toBe(false);
    expect(result.rows[0].address).toBe("live@x.com");
    expect(live).toHaveBeenCalledOnce();
  });
});
