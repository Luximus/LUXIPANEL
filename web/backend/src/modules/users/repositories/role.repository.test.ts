// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Regression tests — role id generation must be numeric (roles.id is an integer
 * FK joined as `byId.get(u.roleId)`) AND collision-safe under concurrency. The
 * old `all.reduce(max) + 1` gave two simultaneous creates the same id, so the
 * second `set()` clobbered the first (a lost role).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Deterministic low-bits so concurrent creates in the same millisecond get
// distinct ids in the test (production uses crypto.randomInt(1000)).
let seq = 0;
vi.mock("node:crypto", () => ({ randomInt: () => seq++ % 1000 }));

const map = new Map<string, Record<string, unknown>>();
vi.mock("../../../shared/kv-store/index.js", () => ({
  kv: () => ({
    module: () => ({
      collection: () => ({
        list: async () => [...map.values()],
        find: async (pred: (r: Record<string, unknown>) => boolean) => [...map.values()].find(pred),
        get: async (id: string) => map.get(id),
        set: async (id: string, val: Record<string, unknown>) => {
          map.set(id, val);
        },
        delete: async (id: string) => map.delete(id),
      }),
    }),
  }),
}));

import { roleRepository } from "./role.repository.js";

beforeEach(() => {
  map.clear();
  seq = 0;
});

describe("roleRepository.nextId — numeric + collision-safe", () => {
  it("assigns a numeric integer id (never a string-concatenated value)", async () => {
    const role = await roleRepository.create({ name: "admin", description: null, modules: [], permissions: {} } as never);
    expect(typeof role.id).toBe("number");
    expect(Number.isInteger(role.id)).toBe(true);
    expect(role.id).toBeGreaterThan(0);
  });

  it("two CONCURRENT creates get distinct ids and BOTH persist (no lost role)", async () => {
    const [a, b] = await Promise.all([
      roleRepository.create({ name: "one", description: null, modules: [], permissions: {} } as never),
      roleRepository.create({ name: "two", description: null, modules: [], permissions: {} } as never),
    ]);
    expect(a.id).not.toBe(b.id);
    // Both rows survived — the old max+1 would have collided and dropped one.
    expect(map.size).toBe(2);
  });

  it("does not collide with an existing id already present in the snapshot", async () => {
    // Seed a pre-existing id equal to the next time-based candidate.
    const now = Date.now();
    map.set(String(now * 1000), { id: now * 1000, name: "seed", modules: [], permissions: {}, createdAt: "", updatedAt: "" });
    const role = await roleRepository.create({ name: "fresh", description: null, modules: [], permissions: {} } as never);
    expect(role.id).not.toBe(now * 1000);
    expect(map.has(String(role.id))).toBe(true);
    expect(map.size).toBe(2);
  });
});
