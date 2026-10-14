// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@config/paths.js", () => ({
  CONFIG_DIR: "/etc/luxipanel",
  panelConfigDir: () => "/etc/luxipanel",
}));

import { kv } from "./index.js";
import type { Executor } from "../executor/index.js";

/** In-memory executor: just the filesystem ops kv-store touches. */
function makeExecutor(seed: Record<string, string> = {}) {
  const fs = new Map<string, string>(Object.entries(seed));
  const executor = {
    target: { id: "t", name: "t" },
    async readFile(p: string) {
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
  return { executor, fs };
}

const COLL = "/etc/luxipanel/assistant/conversations-u1.json";

beforeEach(() => vi.clearAllMocks());

describe("kv-store corrupt-JSON preservation", () => {
  it("backs up a corrupt collection file BEFORE overwriting it", async () => {
    // A corrupt index that still holds (unparseable) bytes on disk.
    const { executor, fs } = makeExecutor({ [COLL]: '{"keep":{"a":1' });
    const store = kv(executor).module("assistant").collection("conversations-u1");

    await store.set("new1", { b: 2 } as Record<string, unknown>);

    // The file was healed to valid JSON containing the written doc…
    const healed = JSON.parse(fs.get(COLL)!);
    expect(healed).toHaveProperty("new1");
    // …and the original corrupt bytes were preserved in a sibling backup.
    const backups = [...fs.keys()].filter((k) => k.startsWith(`${COLL}.corrupt-`));
    expect(backups).toHaveLength(1);
    expect(fs.get(backups[0]!)).toBe('{"keep":{"a":1');
  });

  it("does NOT create a backup for a valid collection file", async () => {
    const { executor, fs } = makeExecutor({ [COLL]: '{"x":{"a":1}}' });
    const store = kv(executor).module("assistant").collection("conversations-u1");

    await store.set("y", { b: 2 } as Record<string, unknown>);

    const backups = [...fs.keys()].filter((k) => k.includes(".corrupt-"));
    expect(backups).toHaveLength(0);
    expect(JSON.parse(fs.get(COLL)!)).toEqual({ x: { a: 1 }, y: { b: 2 } });
  });
});

describe("kv-store atomic overwrite (temp + rename)", () => {
  /** Executor that records the write path and supports rename/unlink. A rename
   *  is modelled as move-key so the final file only ever holds complete bytes. */
  function makeRenameExecutor(seed: Record<string, string> = {}) {
    const fs = new Map<string, string>(Object.entries(seed));
    const writes: string[] = [];
    const renames: Array<[string, string]> = [];
    const executor = {
      target: { id: "t", name: "t" },
      async readFile(p: string) {
        if (!fs.has(p)) throw new Error("ENOENT");
        return fs.get(p)!;
      },
      async writeFile(p: string, data: string | Buffer) {
        writes.push(p);
        fs.set(p, typeof data === "string" ? data : data.toString("utf-8"));
      },
      async rename(from: string, to: string) {
        renames.push([from, to]);
        if (!fs.has(from)) throw new Error("ENOENT rename src");
        fs.set(to, fs.get(from)!);
        fs.delete(from);
      },
      async unlink(p: string) {
        fs.delete(p);
      },
      async exec() {
        return { stdout: "", stderr: "", exitCode: 0, durationMs: 0 };
      },
    } as unknown as Executor;
    return { executor, fs, writes, renames };
  }

  it("overwrites an existing collection via a temp file then rename (never in place)", async () => {
    const { executor, fs, writes, renames } = makeRenameExecutor({ [COLL]: '{"x":{"a":1}}' });
    await kv(executor).module("assistant").collection("conversations-u1").set("y", { b: 2 } as Record<string, unknown>);

    // The durable write targeted a temp sibling, not the live file directly…
    expect(writes.every((p) => p !== COLL)).toBe(true);
    expect(writes[0]!.startsWith(`${COLL}.tmp-`)).toBe(true);
    // …then was renamed over the target — the atomic swap.
    expect(renames).toHaveLength(1);
    expect(renames[0]![1]).toBe(COLL);
    // Result is the merged, complete map; no temp left behind.
    expect(JSON.parse(fs.get(COLL)!)).toEqual({ x: { a: 1 }, y: { b: 2 } });
    expect([...fs.keys()].some((k) => k.includes(".tmp-"))).toBe(false);
  });
});

describe("kv-store per-collection mutex (serialized writes)", () => {
  /** Executor whose readFile/writeFile can be delayed to force interleaving. */
  function makeSlowExecutor(seed: Record<string, string> = {}) {
    const fs = new Map<string, string>(Object.entries(seed));
    let delayNextRead = 0;
    const executor = {
      target: { id: "t", name: "t" },
      async readFile(p: string) {
        if (delayNextRead > 0) {
          const d = delayNextRead;
          delayNextRead = 0;
          await new Promise((r) => setTimeout(r, d));
        }
        if (!fs.has(p)) throw new Error("ENOENT");
        return fs.get(p)!;
      },
      async writeFile(p: string, data: string | Buffer) {
        fs.set(p, typeof data === "string" ? data : data.toString("utf-8"));
      },
      async rename(from: string, to: string) {
        if (!fs.has(from)) throw new Error("ENOENT rename src");
        fs.set(to, fs.get(from)!);
        fs.delete(from);
      },
      async unlink(p: string) {
        fs.delete(p);
      },
      async exec() {
        return { stdout: "", stderr: "", exitCode: 0, durationMs: 0 };
      },
    } as unknown as Executor & { _delayNextRead(ms: number): void };
    (executor as unknown as { _delayNextRead(ms: number): void })._delayNextRead = (ms: number) => {
      delayNextRead = ms;
    };
    return { executor, fs };
  }

  it("serializes two concurrent appends so neither is lost", async () => {
    const { executor, fs } = makeSlowExecutor({ [COLL]: "{}" });
    const store = kv(executor).module("assistant").collection("conversations-u1");

    // Slow down the FIRST caller's read so, WITHOUT the lock, the second caller
    // would read the same empty-ish map and clobber the first write.
    (executor as unknown as { _delayNextRead(ms: number): void })._delayNextRead(20);

    await Promise.all([
      store.set("a", { v: 1 } as Record<string, unknown>),
      store.set("b", { v: 2 } as Record<string, unknown>),
    ]);

    // Both appends survived: the second op observed the first op's write.
    expect(JSON.parse(fs.get(COLL)!)).toEqual({ a: { v: 1 }, b: { v: 2 } });
  });

  it("serializes a burst of concurrent appends to the same collection", async () => {
    const { executor, fs } = makeSlowExecutor({ [COLL]: "{}" });
    const store = kv(executor).module("assistant").collection("conversations-u1");

    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        store.set(`k${i}`, { v: i } as Record<string, unknown>),
      ),
    );

    expect(Object.keys(JSON.parse(fs.get(COLL)!))).toHaveLength(10);
  });
});

describe("kv-store anti-clobber tripwire", () => {
  function makeExecutorWithBackup(seed: Record<string, string> = {}) {
    const fs = new Map<string, string>(Object.entries(seed));
    const executor = {
      target: { id: "t", name: "t" },
      async readFile(p: string) {
        if (!fs.has(p)) throw new Error("ENOENT");
        return fs.get(p)!;
      },
      async writeFile(p: string, data: string | Buffer) {
        fs.set(p, typeof data === "string" ? data : data.toString("utf-8"));
      },
      async rename(from: string, to: string) {
        if (!fs.has(from)) throw new Error("ENOENT rename src");
        fs.set(to, fs.get(from)!);
        fs.delete(from);
      },
      async unlink(p: string) {
        fs.delete(p);
      },
      async exec() {
        return { stdout: "", stderr: "", exitCode: 0, durationMs: 0 };
      },
    } as unknown as Executor;
    return { executor, fs };
  }

  it("(d) snapshots a .bak when a populated collection collapses to empty", async () => {
    const before = JSON.stringify({ a: { v: 1 }, b: { v: 2 } }, null, 2);
    const { executor, fs } = makeExecutorWithBackup({ [COLL]: before });
    const store = kv(executor).module("assistant").collection("conversations-u1");

    // transaction wipes the whole map → N>0 → 0 keys: must back up the prior bytes.
    await store.transaction(async () => ({ next: {}, result: undefined }));

    const backups = [...fs.keys()].filter((k) => k.startsWith(`${COLL}.bak.`));
    expect(backups).toHaveLength(1);
    expect(fs.get(backups[0]!)).toBe(before);
    // The write still went through (never blocked).
    expect(JSON.parse(fs.get(COLL)!)).toEqual({});
  });

  it("snapshots a .bak when a collection loses more than 80% of its keys", async () => {
    const seedMap: Record<string, unknown> = {};
    for (let i = 0; i < 10; i++) seedMap[`k${i}`] = { v: i };
    const before = JSON.stringify(seedMap, null, 2);
    const { executor, fs } = makeExecutorWithBackup({ [COLL]: before });
    const store = kv(executor).module("assistant").collection("conversations-u1");

    // 10 → 1 keys = 90% loss (> 80%).
    await store.transaction(async () => ({ next: { k0: { v: 0 } }, result: undefined }));

    expect([...fs.keys()].filter((k) => k.startsWith(`${COLL}.bak.`))).toHaveLength(1);
  });

  it("does NOT snapshot for an ordinary single-item delete from a large collection", async () => {
    const seedMap: Record<string, unknown> = {};
    for (let i = 0; i < 10; i++) seedMap[`k${i}`] = { v: i };
    const { executor, fs } = makeExecutorWithBackup({ [COLL]: JSON.stringify(seedMap, null, 2) });
    const store = kv(executor).module("assistant").collection("conversations-u1");

    await store.delete("k3"); // 10 → 9 keys, well under the 80% threshold

    expect([...fs.keys()].filter((k) => k.includes(".bak."))).toHaveLength(0);
  });
});

describe("kv-store transient-read clobber guard (readRaw classification)", () => {
  it("(a) genuine ENOENT creates the collection (existed=false, no throw)", async () => {
    // No seed → readFile rejects ENOENT and sudo cat yields nothing: a true
    // absent file. The set() must succeed and create the file, NOT throw.
    const fs = new Map<string, string>();
    const executor = {
      target: { id: "t", name: "t" },
      async readFile(p: string) {
        if (!fs.has(p)) throw new Error("ENOENT: no such file or directory");
        return fs.get(p)!;
      },
      async writeFile(p: string, data: string | Buffer) {
        fs.set(p, typeof data === "string" ? data : data.toString("utf-8"));
      },
      async exec() {
        // sudo cat of a missing file: non-zero exit, empty stdout (does NOT throw).
        return { stdout: "", stderr: "cat: No such file", exitCode: 1, durationMs: 0 };
      },
    } as unknown as Executor;

    await kv(executor).module("assistant").collection("conversations-u1").set("a", { v: 1 } as Record<string, unknown>);
    expect(JSON.parse(fs.get(COLL)!)).toEqual({ a: { v: 1 } });
  });

  it("(b) a TRANSIENT read failure aborts the mutation and writes NOTHING", async () => {
    // The file exists on the target, but the read hiccups (dropped session).
    // Treating this as "absent" would rewrite the whole collection with only the
    // new doc — the silent-loss bug. It must THROW and touch no file.
    const writes: string[] = [];
    const executor = {
      target: { id: "t", name: "t" },
      async readFile() {
        throw new Error("Connection lost before handshake");
      },
      async writeFile(p: string) {
        writes.push(p);
      },
      async exec() {
        // sudo cat can't run either (session is down).
        throw new Error("Connection lost before handshake");
      },
    } as unknown as Executor;

    const store = kv(executor).module("assistant").collection("conversations-u1");
    await expect(store.set("a", { v: 1 } as Record<string, unknown>)).rejects.toMatchObject({
      code: "KV_READ_FAILED",
    });
    // No write of ANY kind happened — the on-disk collection is left intact.
    expect(writes).toHaveLength(0);
  });

  it("(c) recovers a permission-denied read via sudo cat (no throw, no clobber)", async () => {
    // readFile is EACCES but the file EXISTS; sudo cat recovers its bytes. The
    // mutation must merge onto the recovered content, not overwrite it.
    const contents = '{"x":{"a":1}}';
    let liveWrites = 0;
    const fs = new Map<string, string>();
    const executor = {
      target: { id: "t", name: "t" },
      async readFile() {
        throw new Error("EACCES: permission denied");
      },
      async writeFile(p: string, data: string | Buffer) {
        if (p === COLL) liveWrites++;
        fs.set(p, typeof data === "string" ? data : data.toString("utf-8"));
      },
      async rename(from: string, to: string) {
        fs.set(to, fs.get(from)!);
        fs.delete(from);
      },
      async unlink(p: string) {
        fs.delete(p);
      },
      async exec(cmd: string) {
        if (cmd.includes("cat")) return { stdout: contents, stderr: "", exitCode: 0, durationMs: 0 };
        return { stdout: "", stderr: "", exitCode: 0, durationMs: 0 };
      },
    } as unknown as Executor;

    await kv(executor).module("assistant").collection("conversations-u1").set("y", { b: 2 } as Record<string, unknown>);
    // Merged onto the sudo-recovered content, and written atomically (rename),
    // never in place.
    expect(JSON.parse(fs.get(COLL)!)).toEqual({ x: { a: 1 }, y: { b: 2 } });
    expect(liveWrites).toBe(0);
  });
});

describe("kv-store atomic-overwrite fallback (writeRaw HUECO 2)", () => {
  /** Rename executor whose rename fails its first `failTimes` calls. */
  function makeFlakyRenameExecutor(seed: Record<string, string>, failTimes: number) {
    const fs = new Map<string, string>(Object.entries(seed));
    const writes: string[] = [];
    let renameCalls = 0;
    const executor = {
      target: { id: "t", name: "t" },
      async readFile(p: string) {
        if (!fs.has(p)) throw new Error("ENOENT");
        return fs.get(p)!;
      },
      async writeFile(p: string, data: string | Buffer) {
        writes.push(p);
        fs.set(p, typeof data === "string" ? data : data.toString("utf-8"));
      },
      async rename(from: string, to: string) {
        renameCalls++;
        if (renameCalls <= failTimes) throw new Error("rename hiccup");
        if (!fs.has(from)) throw new Error("ENOENT rename src");
        fs.set(to, fs.get(from)!);
        fs.delete(from);
      },
      async unlink(p: string) {
        fs.delete(p);
      },
      async exec() {
        return { stdout: "", stderr: "", exitCode: 0, durationMs: 0 };
      },
    } as unknown as Executor;
    return { executor, fs, writes, renameCount: () => renameCalls };
  }

  it("(a) an atomic replace that succeeds first try does exactly one rename", async () => {
    const { executor, renameCount } = makeFlakyRenameExecutor({ [COLL]: '{"x":{"a":1}}' }, 0);
    await kv(executor).module("assistant").collection("conversations-u1").set("y", { b: 2 } as Record<string, unknown>);
    expect(renameCount()).toBe(1);
  });

  it("(b) retries the atomic replace once when the first rename fails", async () => {
    const { executor, fs, writes, renameCount } = makeFlakyRenameExecutor({ [COLL]: '{"x":{"a":1}}' }, 1);
    await kv(executor).module("assistant").collection("conversations-u1").set("y", { b: 2 } as Record<string, unknown>);

    expect(renameCount()).toBe(2);
    // The live file was NEVER written in place — only temp siblings + rename.
    expect(writes.every((p) => p !== COLL)).toBe(true);
    expect(JSON.parse(fs.get(COLL)!)).toEqual({ x: { a: 1 }, y: { b: 2 } });
    // No temp left behind.
    expect([...fs.keys()].some((k) => k.includes(".tmp-"))).toBe(false);
  });

  it("(c) throws (never truncating in-place) when the atomic replace fails twice", async () => {
    const { executor, fs, writes, renameCount } = makeFlakyRenameExecutor({ [COLL]: '{"x":{"a":1}}' }, 2);
    const store = kv(executor).module("assistant").collection("conversations-u1");

    await expect(store.set("y", { b: 2 } as Record<string, unknown>)).rejects.toMatchObject({
      code: "KV_WRITE_FAILED",
    });
    // Exactly two attempts, and the live file was left byte-for-byte intact —
    // no O_TRUNC in-place fallback.
    expect(renameCount()).toBe(2);
    expect(writes.every((p) => p !== COLL)).toBe(true);
    expect(JSON.parse(fs.get(COLL)!)).toEqual({ x: { a: 1 } });
  });
});

describe("kv-store path safety (safe)", () => {
  it("neutralizes '..' segments so the path cannot escape the config dir", async () => {
    const { executor, fs } = makeExecutor();
    // A traversal attempt via module/collection names must NOT resolve outside
    // /etc/luxipanel — '..' collapses to a harmless token.
    await kv(executor).module("..").collection("..").set("k", { a: 1 } as Record<string, unknown>);

    const keys = [...fs.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe("/etc/luxipanel/-/-.json");
    // No key ever climbs above the base dir.
    expect(keys.some((k) => k.includes("/etc/luxipanel/../"))).toBe(false);
  });

  it("neutralizes a lone '.' segment", async () => {
    const { executor, fs } = makeExecutor();
    await kv(executor).module(".").collection("cfg").set("k", { a: 1 } as Record<string, unknown>);
    expect([...fs.keys()][0]).toBe("/etc/luxipanel/-/cfg.json");
  });

  it("caps an overlong segment at 64 chars", async () => {
    const { executor, fs } = makeExecutor();
    const longName = "a".repeat(200);
    await kv(executor).module(longName).collection("cfg").set("k", { a: 1 } as Record<string, unknown>);

    const key = [...fs.keys()][0]!;
    const moduleSegment = key.replace("/etc/luxipanel/", "").split("/")[0]!;
    expect(moduleSegment).toBe("a".repeat(64));
  });
});

describe("kv-store shell fallback quoting", () => {
  it("quotes the target path via quoteArg when SFTP write fails", async () => {
    const execCalls: string[] = [];
    const fs = new Map<string, string>();
    const executor = {
      target: { id: "t", name: "t" },
      async readFile() {
        throw new Error("ENOENT");
      },
      async writeFile() {
        // Force the shell fallback in writeRawCreate.
        throw new Error("EACCES");
      },
      async exec(cmd: string) {
        execCalls.push(cmd);
        return { stdout: "", stderr: "", exitCode: 0, durationMs: 0 };
      },
    } as unknown as Executor;

    await kv(executor).module("assistant").collection("cfg").set("k", { a: 1 } as Record<string, unknown>);

    // The printf fallback must wrap the path with quoteArg (single-quoted),
    // never interpolate it raw — otherwise a crafted path could inject $()/`.
    const fallback = execCalls.find((c) => c.includes("printf"));
    expect(fallback).toBeDefined();
    // quoteArg wraps the path in single quotes; the outer quoteCmd("sh", …)
    // then re-escapes those quotes (' → '"'"'). The redirect target is the
    // fully-quoted path — never the raw, injectable form.
    expect(fallback).toContain(`> '"'"'/etc/luxipanel/assistant/cfg.json'"'"'`);
    expect(fs.size).toBe(0);
  });

  it("base64-encodes the payload so the fallback is a single control-char-free line", async () => {
    const execCalls: string[] = [];
    const executor = {
      target: { id: "t", name: "t" },
      async readFile() {
        // Existing multi-line (pretty-printed) collection so the merged content
        // written back is genuinely multi-line JSON — the exact shape that broke
        // the raw `printf` fallback over LP `/api/agents/exec`.
        return '{\n  "x": {\n    "a": 1\n  }\n}';
      },
      async writeFile() {
        throw new Error("EACCES"); // force the shell fallback
      },
      async exec(cmd: string) {
        execCalls.push(cmd);
        return { stdout: "", stderr: "", exitCode: 0, durationMs: 0 };
      },
    } as unknown as Executor;

    await kv(executor).module("assistant").collection("cfg").set("y", { b: 2 } as Record<string, unknown>);

    const fallback = execCalls.find((c) => c.includes("base64 -d"));
    expect(fallback).toBeDefined();
    // The command MUST be a single line: LP rejects control chars (newlines).
    expect(fallback).not.toContain("\n");
    // And it must round-trip: some base64 run in the command decodes back to
    // the written JSON (robust to the outer shell-escaping around it).
    const runs = fallback!.match(/[A-Za-z0-9+/]{16,}={0,2}/g) ?? [];
    const decoded = runs
      .map((r) => {
        try {
          return JSON.parse(Buffer.from(r, "base64").toString("utf-8"));
        } catch {
          return undefined;
        }
      })
      .find((v) => v !== undefined);
    expect(decoded).toEqual({ x: { a: 1 }, y: { b: 2 } });
  });
});
