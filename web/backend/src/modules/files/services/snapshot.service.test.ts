// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory snapshot metadata store, shared with the dataStore mock below.
const records = new Map<string, Record<string, unknown>>();

vi.mock("../../../shared/data-store/index.js", () => ({
  dataStore: () => ({
    list: async () => [...records.values()],
    get: async (id: string) => records.get(String(id)) ?? null,
    create: async (d: Record<string, unknown>) => {
      records.set(String(d.id), d);
      return d;
    },
    delete: async (id: string) => records.delete(String(id)),
    transaction: async (
      fn: (m: Record<string, unknown>) => Promise<{ next: Record<string, unknown>; result: unknown }>,
    ) => {
      const map: Record<string, unknown> = {};
      for (const [k, v] of records) map[k] = v;
      const { next, result } = await fn(map);
      records.clear();
      for (const k of Object.keys(next)) records.set(k, next[k] as Record<string, unknown>);
      return result;
    },
  }),
}));

vi.mock("../../../shared/files-cache/index.js", () => ({
  invalidateDir: vi.fn(),
  invalidateFile: vi.fn(),
  invalidateStat: vi.fn(),
}));

const { snapshotService } = await import("./snapshot.service.js");

interface FakeStat {
  size: number;
  isDir: boolean;
  mode: string;
}

function makeExecutor() {
  const files = new Map<string, Buffer>();
  const stats = new Map<string, FakeStat>();
  const calls: string[] = [];

  function setFile(p: string, content: string | Buffer, mode = "0644") {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
    files.set(p, buf);
    stats.set(p, { size: buf.length, isDir: false, mode });
  }

  const executor = {
    target: { id: "remote", name: "R" },
    exec: vi.fn(async (cmd: string) => {
      calls.push(cmd);
      // Emulate `rm -f <blob>` so removeBlob during prune doesn't keep stale state.
      const rm = cmd.match(/rm -f (\S+)/);
      if (rm) {
        const p = rm[1]!.replace(/^"|"$/g, "");
        files.delete(p);
        stats.delete(p);
      }
      return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
    }),
    stat: vi.fn(async (p: string) => {
      const s = stats.get(p);
      if (!s) throw new Error("ENOENT");
      return { ...s, type: s.isDir ? "dir" : "file", path: p } as never;
    }),
    readFile: vi.fn(async (p: string, enc?: BufferEncoding) => {
      const b = files.get(p);
      if (!b) throw new Error("ENOENT");
      return enc ? b.toString(enc) : b;
    }),
    writeFile: vi.fn(async (p: string, data: string | Buffer) => {
      setFile(p, data);
    }),
  } as never;

  return { executor, files, stats, calls, setFile };
}

describe("snapshotService", () => {
  beforeEach(() => {
    records.clear();
  });

  it("captures a file's bytes and records kind=file", async () => {
    const env = makeExecutor();
    env.setFile("/var/www/app/.env", "SECRET=1");
    const rec = await snapshotService.capture(env.executor, "/var/www/app/.env", "edit");

    expect(rec).not.toBeNull();
    expect(rec!.kind).toBe("file");
    expect(rec!.sizeBytes).toBe("SECRET=1".length);
    expect(rec!.blobName).toBeTruthy();
    // A blob was written under the snapshot dir.
    const blob = [...env.files.keys()].find((k) => k.includes("files-snapshots"));
    expect(blob).toBeTruthy();
  });

  it("records kind=absent when the path does not exist", async () => {
    const env = makeExecutor();
    const rec = await snapshotService.capture(env.executor, "/var/www/new-file.txt", "edit");
    expect(rec!.kind).toBe("absent");
    expect(rec!.blobName).toBeUndefined();
  });

  it("restores a file snapshot back onto its path", async () => {
    const env = makeExecutor();
    env.setFile("/var/www/app/index.php", "<?php echo 'v1';");
    const snap = await snapshotService.capture(env.executor, "/var/www/app/index.php", "edit");

    // User overwrites the file.
    env.setFile("/var/www/app/index.php", "<?php echo 'BROKEN';");

    await snapshotService.restore(env.executor, snap!.id);

    expect(env.files.get("/var/www/app/index.php")!.toString("utf-8")).toBe("<?php echo 'v1';");
  });

  it("prune batches blob removal (one rm) and metadata deletes (one transaction)", async () => {
    const env = makeExecutor();
    const p = "/var/www/app/.env";
    // Seed 22 snapshots for the same path (per-path cap = 20 ⇒ 2 pruned).
    for (let i = 0; i < 22; i++) {
      const id = `snap-${i}`;
      records.set(id, {
        id,
        path: p,
        op: "edit",
        kind: "file",
        sizeBytes: 1,
        blobName: `${id}.blob`,
        capturedAt: new Date(2020, 0, 1, 0, 0, i).toISOString(),
      });
    }

    await snapshotService.prune(env.executor, p);

    // Only the 20 newest survive; the two oldest were dropped.
    expect(records.size).toBe(20);
    expect(records.has("snap-0")).toBe(false);
    expect(records.has("snap-1")).toBe(false);

    // A SINGLE `rm` exec removed both pruned blobs (no per-record exec).
    const rmCalls = env.calls.filter((c) => c.startsWith("rm "));
    expect(rmCalls).toHaveLength(1);
    expect(rmCalls[0]).toContain("snap-0.blob");
    expect(rmCalls[0]).toContain("snap-1.blob");
  });

  it("diff exposes the captured text via readText", async () => {
    const env = makeExecutor();
    env.setFile("/etc/nginx/nginx.conf", "worker_processes 1;");
    const snap = await snapshotService.capture(env.executor, "/etc/nginx/nginx.conf", "edit");
    const text = await snapshotService.readText(env.executor, snap!);
    expect(text).toBe("worker_processes 1;");
  });
});
