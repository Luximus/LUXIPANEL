// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
const locks = vi.hoisted(() => new Set<string>());
vi.mock("../../../shared/redis/index.js", () => ({ getRedis: () => ({ set: async (key: string) => { if (locks.has(key)) return null; locks.add(key); return "OK"; }, eval: async (_script: string, _n: number, key: string) => { locks.delete(key); return 1; } }) }));
import { withTenantDatabaseCreationLock } from "./tenant-database-scope.js";

describe("tenant database creation quota", () => {
  it("serializes concurrent creates for the same account across engines", async () => {
    let existing = 0;
    const create = () => withTenantDatabaseCreationLock("target:owner", async () => {
      const count = existing;
      await Promise.resolve();
      if (count >= 1) throw new Error("quota exceeded");
      existing++;
    });
    const results = await Promise.allSettled([create(), create()]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(existing).toBe(1);
  });
});
