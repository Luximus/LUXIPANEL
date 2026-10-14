// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — shared/remote-cache
 *
 * Mocks the executor (no real SSH) and the panel-local Redis (no ioredis
 * connection needed). Covers: fail-open paths, circuit breaker,
 * fresh/stale/very-stale classification, projection round-trip and
 * cross-target isolation.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { gzipSync } from "node:zlib";

// ── mock the panel-local Redis so getRedis() returns an in-memory store ─
const memStore = new Map<string, { value: string; expiresAt: number }>();
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
  }),
}));

import {
  getCachedFull,
  remoteCacheHealth,
  _resetRemoteCacheForTests,
} from "./index.js";
import { _resetRemoteCacheConnForTests } from "./conn.js";
import { _resetMetricsForTests, snapshot } from "./metrics.js";
import type { Executor } from "../executor/types.js";

function b64gz(obj: unknown): string {
  return gzipSync(Buffer.from(JSON.stringify(obj), "utf-8")).toString("base64");
}

interface FakeRedis {
  meta?: unknown;
  data?: unknown;
}

interface FakeOpts {
  id?: string;
  conn?: { host: string; port: number; password: string } | "missing";
  redis?: FakeRedis;
  exec?: {
    /** Force an exec error (non-zero exit). */
    fail?: boolean;
    /** stdout override (advanced cases). */
    stdoutOverride?: string;
  };
}

function makeExecutor(opts: FakeOpts = {}): Executor {
  const id = opts.id ?? "target-A";
  const conn = opts.conn ?? { host: "127.0.0.1", port: 7379, password: "hex" };
  return {
    target: { id, name: id },
    async readFile(filePath: string) {
      if (filePath.endsWith("/cache/conn.json")) {
        if (conn === "missing") throw new Error("ENOENT");
        return JSON.stringify(conn);
      }
      throw new Error("not mocked: " + filePath);
    },
    async exec(_cmd: string) {
      if (opts.exec?.fail) {
        return { stdout: "", stderr: "boom", exitCode: 1, durationMs: 1 };
      }
      const stdout =
        opts.exec?.stdoutOverride !== undefined
          ? opts.exec.stdoutOverride
          : `${opts.redis?.meta === undefined ? "(nil)" : b64gz(opts.redis.meta)}\n` +
            `${opts.redis?.data === undefined ? "(nil)" : b64gz(opts.redis.data)}\n`;
      return { stdout, stderr: "", exitCode: 0, durationMs: 5 };
    },
    // unused
    async writeFile() {},
    async readdir() { return []; },
    async stat() { return {} as any; },
    async mkdir() {},
    async unlink() {},
    async rename() {},
    spawn() { return null as any; },
  };
}

function metaWith(opts: { version?: string; collectedAtSecAgo?: number; count?: number }) {
  return {
    schemaVersion: 1,
    version: opts.version ?? "abc",
    count: opts.count ?? 1,
    collectedAt: Math.floor(Date.now() / 1000) - (opts.collectedAtSecAgo ?? 10),
    source: "sidecar-mirror",
    pageSizes: [10, 20, 50, 100],
    pages: { "10": 1, "20": 1, "50": 1, "100": 1 },
  };
}

beforeEach(() => {
  memStore.clear();
  _resetRemoteCacheForTests();
  _resetRemoteCacheConnForTests();
  _resetMetricsForTests();
});

describe("fail-open paths", () => {
  it("returns null when conn.json is missing (no-conn metric)", async () => {
    const ex = makeExecutor({ conn: "missing" });
    const v = await getCachedFull(ex, "auth", "users");
    expect(v).toBeNull();
    const snap = snapshot(ex.target.id);
    expect(snap[0]?.counts["no-conn"]).toBe(1);
  });

  it("returns null when meta key is nil (miss)", async () => {
    const ex = makeExecutor({ redis: {} }); // both nil
    const v = await getCachedFull(ex, "auth", "users");
    expect(v).toBeNull();
    const snap = snapshot(ex.target.id);
    expect(snap[0]?.counts.miss).toBe(1);
  });

  it("returns null and trips breaker on repeated exec failures", async () => {
    const ex = makeExecutor({ exec: { fail: true } });
    for (let i = 0; i < 3; i++) {
      const v = await getCachedFull(ex, "auth", "users");
      expect(v).toBeNull();
    }
    // 4th call: breaker should be open → bypass
    const v4 = await getCachedFull(ex, "auth", "users");
    expect(v4).toBeNull();
    expect(remoteCacheHealth(ex.target.id).breaker.open).toBe(true);
    const snap = snapshot(ex.target.id);
    expect(snap[0]?.counts.error).toBeGreaterThanOrEqual(3);
    expect(snap[0]?.counts["bypass-breaker"]).toBeGreaterThanOrEqual(1);
  });
});

describe("hit paths", () => {
  it("decodes a fresh page and reports freshness=fresh", async () => {
    const meta = metaWith({ collectedAtSecAgo: 5 });
    const rows = [{ id: "u1", username: "alice" }];
    const ex = makeExecutor({ redis: { meta, data: rows } });

    const v = await getCachedFull(ex, "auth", "users");
    expect(v).not.toBeNull();
    expect(v!.rows).toEqual(rows);
    expect(v!.meta.version).toBe(meta.version);
    expect(v!.freshness).toBe("fresh");
    expect(snapshot(ex.target.id)[0]?.counts["hit-fresh"]).toBe(1);
  });

  it("returns stale (still served) between FRESH and VERY_STALE", async () => {
    // Default FRESH=600s VERY_STALE=3600s → 1500s ago is stale-but-served.
    const meta = metaWith({ collectedAtSecAgo: 1500 });
    const rows = [{ id: "u1" }, { id: "u2" }];
    const ex = makeExecutor({ redis: { meta, data: rows } });

    const v = await getCachedFull(ex, "auth", "users");
    expect(v).not.toBeNull();
    expect(v!.freshness).toBe("stale");
    expect(snapshot(ex.target.id)[0]?.counts["hit-stale"]).toBe(1);
  });

  it("fails open beyond VERY_STALE", async () => {
    const meta = metaWith({ collectedAtSecAgo: 10_000 });
    const rows = [{ id: "u1" }];
    const ex = makeExecutor({ redis: { meta, data: rows } });

    const v = await getCachedFull(ex, "auth", "users");
    expect(v).toBeNull();
    expect(snapshot(ex.target.id)[0]?.counts.miss).toBe(1);
  });

  it("getCachedFull decodes the full projected array", async () => {
    const meta = metaWith({ collectedAtSecAgo: 5, count: 3 });
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const ex = makeExecutor({ redis: { meta, data: rows } });

    const v = await getCachedFull(ex, "auth", "users");
    expect(v?.rows.length).toBe(3);
    expect(v?.freshness).toBe("fresh");
  });
});

describe("per-target isolation", () => {
  it("server A's payload never leaks into server B's read", async () => {
    const metaA = metaWith({ version: "verA", collectedAtSecAgo: 5 });
    const rowsA = [{ id: "A", server: "A" }];
    const exA = makeExecutor({ id: "target-A", redis: { meta: metaA, data: rowsA } });
    const vA = await getCachedFull(exA, "auth", "users");
    expect((vA!.rows[0] as any).server).toBe("A");

    const metaB = metaWith({ version: "verB", collectedAtSecAgo: 5 });
    const rowsB = [{ id: "B", server: "B" }];
    const exB = makeExecutor({ id: "target-B", redis: { meta: metaB, data: rowsB } });
    const vB = await getCachedFull(exB, "auth", "users");
    expect((vB!.rows[0] as any).server).toBe("B");

    // Sanity: panel-local meta keys are namespaced by target.id.
    expect(memStore.has("panel:rc:target-A:auth:users")).toBe(true);
    expect(memStore.has("panel:rc:target-B:auth:users")).toBe(true);
  });
});
