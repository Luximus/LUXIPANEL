// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — cache-modules.service.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Stub the panel-local Redis so the metrics snapshot dependency works.
vi.mock("../../../shared/redis/index.js", () => ({
  getRedis: () => ({
    async get() { return null; },
    async set() { return "OK"; },
    async del() { return 0; },
  }),
}));

// `enabled` ya no vive en schedule.json: DERIVA del estado del módulo padre
// (moduleRegistryService.getEnabledMap, estado de instancia en el panel host).
// Mock controlable por test — sin esto el service leería settings reales.
const h = vi.hoisted(() => ({ enabledMap: {} as Record<string, boolean> }));
vi.mock("./module-registry.service.js", () => ({
  moduleRegistryService: {
    getEnabledMap: vi.fn(async () => h.enabledMap),
  },
}));

import { cacheModulesService, updateEntryInputSchema } from "./cache-modules.service.js";
import type { Executor } from "../../../shared/executor/types.js";

interface FakeFS {
  files: Map<string, string>;
  /** Set of paths that throw on read (simulate missing). */
  missing?: Set<string>;
  /** Captured exec calls. */
  execs: string[];
  /** Captured batchSftp calls. */
  batches: any[][];
}

function makeExecutor(id: string, fs: FakeFS): Executor {
  return {
    target: { id, name: id },
    async readFile(filePath: string) {
      if (fs.missing?.has(filePath)) throw new Error("ENOENT");
      if (fs.files.has(filePath)) return fs.files.get(filePath)!;
      throw new Error("ENOENT");
    },
    async writeFile(filePath: string, data: string | Buffer) {
      fs.files.set(filePath, data.toString());
    },
    async mkdir() {},
    async exec(cmd: string) {
      fs.execs.push(cmd);
      return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
    },
    async readdir() { return []; },
    async stat() { return {} as any; },
    async unlink() {},
    async rename() {},
    async batchSftp(operations: any[]) {
      fs.batches.push(operations);
      return operations.map((op: any) => {
        if (op.op === "writeFile") {
          fs.files.set(op.path, op.data);
          return { id: op.id, op: op.op, ok: true };
        }
        if (op.op === "readFile") {
          if (!fs.missing?.has(op.path) && fs.files.has(op.path)) {
            return { id: op.id, op: op.op, ok: true, data: fs.files.get(op.path) };
          }
          return { id: op.id, op: op.op, ok: false, error: "ENOENT" };
        }
        return { id: op.id, op: op.op, ok: true };
      });
    },
    spawn() { return null as any; },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.enabledMap = {};
});

describe("list", () => {
  it("returns every cacheable entry, falling back to policy defaults when schedule.json is absent", async () => {
    const fs: FakeFS = { files: new Map(), missing: new Set(), execs: [], batches: [] };
    const ex = makeExecutor("T-list-defaults", fs);
    const rows = await cacheModulesService.list(ex);
    // Hosting policies are authoritative sidecars, never collector snapshots.
    expect(rows.some(row => row.module === "hosting" && row.collection === "accounts")).toBe(false);
    expect(rows.length).toBe(17);
    const users = rows.find((r) => r.module === "users" && r.collection === "system")!;
    expect(users.enabled).toBe(true); // default when the module map has no entry
    expect(users.intervalSeconds).toBe(users.defaultIntervalSeconds);
    expect(users.lastCollectedAt).toBeNull();
    expect(users.engineStat).toBeNull();
  });

  it("merges schedule.json interval overrides and derives enabled from the module map", async () => {
    // `enabled` sale del módulo padre, NO de schedule.json.
    h.enabledMap = { users: false, mail: true };
    const fs: FakeFS = {
      files: new Map([
        [
          "/etc/luxipanel/cache-engine/schedule.json",
          JSON.stringify({
            "users/system": { enabled: false, intervalSeconds: 900 },
            "mail/accounts": { enabled: true, intervalSeconds: 60 },
          }),
        ],
        [
          "/etc/luxipanel/cache-engine/state/users__system.stat",
          JSON.stringify({
            module: "users", collection: "system", version: "abc",
            count: 5, changed: true, ok: true, bytes: 320, durationMs: 12, wallMs: 13,
          }),
        ],
        ["/etc/luxipanel/cache-engine/state/users__system.last", "1750000000"],
      ]),
      execs: [],
      batches: [],
    };
    const ex = makeExecutor("T-list-overrides", fs);
    const rows = await cacheModulesService.list(ex);
    const users = rows.find((r) => r.module === "users" && r.collection === "system")!;
    expect(users.enabled).toBe(false);
    expect(users.intervalSeconds).toBe(900);
    expect(users.lastCollectedAt).toBe(1750000000);
    expect(users.engineStat?.count).toBe(5);

    const mail = rows.find((r) => r.module === "mail" && r.collection === "accounts")!;
    expect(mail.intervalSeconds).toBe(60);
  });
});

describe("update", () => {
  it("rejects non-cacheable (volatile or unknown) entries", async () => {
    const fs: FakeFS = { files: new Map(), execs: [], batches: [] };
    const ex = makeExecutor("T-upd-reject", fs);
    await expect(
      cacheModulesService.update(ex, "files", "anything", { intervalSeconds: 300 }),
    ).rejects.toThrow(/not cacheable/);
  });

  it("persists schedule.json (chmod 600) and merges with previous entries", async () => {
    const fs: FakeFS = {
      files: new Map([
        [
          "/etc/luxipanel/cache-engine/schedule.json",
          JSON.stringify({ "mail/accounts": { enabled: true, intervalSeconds: 300 } }),
        ],
      ]),
      execs: [],
      batches: [],
    };
    const ex = makeExecutor("T-upd-persist", fs);
    const row = await cacheModulesService.update(ex, "users", "system", {
      intervalSeconds: 600,
    });
    // `enabled` deriva del módulo padre (map vacío ⇒ default true).
    expect(row.enabled).toBe(true);
    expect(row.intervalSeconds).toBe(600);

    const persisted = JSON.parse(fs.files.get("/etc/luxipanel/cache-engine/schedule.json")!);
    // Sin entrada previa, `enabled` persistido conserva el default true.
    expect(persisted["users/system"]).toEqual({ enabled: true, intervalSeconds: 600 });
    expect(persisted["mail/accounts"]).toEqual({ enabled: true, intervalSeconds: 300 });
    // chmod 600 was applied.
    expect(fs.execs.some((c) => /chmod 600/.test(c))).toBe(true);
  });

  it("triggers an immediate dispatcher refresh when the interval is shortened", async () => {
    const fs: FakeFS = {
      files: new Map([
        [
          "/etc/luxipanel/cache-engine/schedule.json",
          JSON.stringify({ "users/system": { enabled: true, intervalSeconds: 600 } }),
        ],
      ]),
      execs: [],
      batches: [],
    };
    const ex = makeExecutor("T-upd-refresh", fs);
    await cacheModulesService.update(ex, "users", "system", {
      intervalSeconds: 60,
    });
    // Allow microtasks for the void scheduleRefresh chain.
    await new Promise((r) => setTimeout(r, 10));
    expect(fs.execs.some((c) => /dispatcher\.sh --entry users system/.test(c))).toBe(true);
  });

  it("input validation: out-of-range interval is rejected", () => {
    expect(updateEntryInputSchema.safeParse({ intervalSeconds: 10 }).success).toBe(false);
    expect(updateEntryInputSchema.safeParse({ intervalSeconds: 999999 }).success).toBe(false);
    expect(updateEntryInputSchema.safeParse({ intervalSeconds: 300 }).success).toBe(true);
  });
});
