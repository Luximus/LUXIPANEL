// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi } from "vitest";

vi.mock("@config/paths.js", () => ({
  CONFIG_DIR: "/etc/luxipanel",
  panelConfigDir: () => "/etc/luxipanel",
}));

import { kv } from "./index.js";
import { withKvReadCache } from "./read-cache.js";
import type { Executor } from "../executor/index.js";

/** Executor that counts how many times each file is actually read (= how many
 *  SSH/SFTP round-trips the kv-store paid). */
function makeExecutor(targetId: string, seed: Record<string, string> = {}) {
  const fs = new Map<string, string>(Object.entries(seed));
  const reads: string[] = [];
  const executor = {
    target: { id: targetId, name: targetId },
    async readFile(p: string) {
      reads.push(p);
      if (!fs.has(p)) throw new Error("ENOENT");
      return fs.get(p)!;
    },
    async writeFile(p: string, data: string | Buffer) {
      fs.set(p, typeof data === "string" ? data : data.toString("utf-8"));
    },
    async exec() {
      return { stdout: "", stderr: "", exitCode: 1, durationMs: 0 };
    },
  } as unknown as Executor;
  return { executor, fs, reads };
}

const COLL = "/etc/luxipanel/assistant/conversations-u1.json";
const SEED = { [COLL]: '{"a":{"title":"A"},"b":{"title":"B"}}' };

describe("kv-store scope-local read memo", () => {
  it("reads a collection ONCE per scope, no matter how many readers", async () => {
    const { executor, reads } = makeExecutor("t1", SEED);
    const store = kv(executor).module("assistant").collection("conversations-u1");

    await withKvReadCache(async () => {
      // Sequential AND concurrent readers of the same collection.
      await store.list();
      await store.get("a");
      await Promise.all([store.list(), store.get("b"), store.count()]);
    });

    expect(reads.filter((p) => p === COLL)).toHaveLength(1);
  });

  it("without a scope, every read still hits the executor (unchanged behaviour)", async () => {
    const { executor, reads } = makeExecutor("t1", SEED);
    const store = kv(executor).module("assistant").collection("conversations-u1");

    await store.list();
    await store.get("a");

    expect(reads.filter((p) => p === COLL)).toHaveLength(2);
  });

  it("a write inside the scope invalidates the memo (no stale read-after-write)", async () => {
    const { executor } = makeExecutor("t1", SEED);
    const store = kv(executor).module("assistant").collection<{ title: string }>("conversations-u1");

    const seen = await withKvReadCache(async () => {
      await store.list(); // memoize the pre-write map
      await store.set("c", { title: "C" });
      return store.list(); // must observe the write
    });

    expect(seen.map((d) => d.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("memo is keyed per executor — one server's bytes never serve another", async () => {
    const a = makeExecutor("server-a", { [COLL]: '{"x":{"title":"from A"}}' });
    const b = makeExecutor("server-b", { [COLL]: '{"y":{"title":"from B"}}' });

    const { fromA, fromB } = await withKvReadCache(async () => {
      const listA = await kv(a.executor).module("assistant").collection("conversations-u1").list();
      const listB = await kv(b.executor).module("assistant").collection("conversations-u1").list();
      return { fromA: listA, fromB: listB };
    });

    expect(fromA.map((d) => d.id)).toEqual(["x"]);
    expect(fromB.map((d) => d.id)).toEqual(["y"]);
    expect(a.reads).toHaveLength(1);
    expect(b.reads).toHaveLength(1);
  });

  it("a failed read is NOT memoized — kv errors stay loud on every attempt", async () => {
    const { executor, reads } = makeExecutor("t1", SEED);
    // Unreadable (not ENOENT) → readRaw throws KvReadError.
    (executor as unknown as { readFile: (p: string) => Promise<string> }).readFile = async (p) => {
      reads.push(p);
      throw new Error("EIO: transport failure");
    };
    const store = kv(executor).module("assistant").collection("conversations-u1");

    await withKvReadCache(async () => {
      await expect(store.list()).rejects.toThrow();
      await expect(store.list()).rejects.toThrow();
    });

    expect(reads.filter((p) => p === COLL)).toHaveLength(2);
  });
});
