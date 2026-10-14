// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Files "safe changes" snapshots — service (Fase 0.1, keystone).
 *
 * Captures a path's pre-mutation state so the user can restore it, compare
 * before/after, or download the backup. Everything runs through the supplied
 * `Executor` so blobs and metadata land on the connected client server (never
 * the panel host). Capture is best-effort: a failure here MUST NOT block the
 * user's actual edit/delete/move — callers `void` it or swallow the error.
 *
 * Storage layout on the client server:
 *   ${LUXIPANEL_CONFIG_DIR}/files-snapshots/<uuid>      ← blob (raw bytes / tar.gz)
 *   ${LUXIPANEL_CONFIG_DIR}/files/snapshots.json        ← metadata map (kv-store)
 */

import path from "node:path";
import { randomUUID } from "node:crypto";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { dirOf } from "../../../shared/utils/posix-path.js";
import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import { CONFIG_DIR } from "@config/paths.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { invalidateDir, invalidateFile, invalidateStat } from "../../../shared/files-cache/index.js";
import type { SnapshotKind, SnapshotOp, SnapshotRecord } from "../models/snapshot.model.js";
import { filesConfigService } from "./files-config.service.js";
import type { FilesConfig } from "./files-config.service.js";

const log = createModuleLogger("files-snapshots");

const OCTAL = /^[0-7]{3,4}$/;
const TAR_TIMEOUT_MS = 60_000;

function snapshotDir(): string {
  return path.posix.join(CONFIG_DIR, "files-snapshots");
}

function blobPathFor(name: string): string {
  return path.posix.join(snapshotDir(), name);
}


function baseName(p: string): string {
  const trimmed = p.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

const store = makeKvStore<SnapshotRecord>({ module: "files", collection: "snapshots", idStrategy: "uuid" });

/** mkdir -p the snapshot dir (best effort, with sudo fallback). */
async function ensureSnapshotDir(executor: Executor): Promise<void> {
  const dir = snapshotDir();
  try {
    await executor.exec(quoteCmd("mkdir", ["-p", dir]));
  } catch {
    await executor.exec(quoteCmd("sudo", ["-n", "mkdir", "-p", dir]));
  }
}

async function removeBlob(executor: Executor, blobName: string): Promise<void> {
  try {
    await executor.exec(quoteCmd("rm", ["-f", blobPathFor(blobName)]));
  } catch {
    /* non-fatal */
  }
}

function invalidateAround(executor: Executor, p: string): void {
  void invalidateDir(executor, p);
  void invalidateFile(executor, p);
  void invalidateStat(executor, p);
}

function pruneCandidates(all: SnapshotRecord[], config: FilesConfig, forPath?: string): SnapshotRecord[] {
  const sorted = [...all].sort((a, b) => (b.capturedAt || "").localeCompare(a.capturedAt || ""));
  const selected = new Map<string, SnapshotRecord>();
  const byPath = new Map<string, SnapshotRecord[]>();
  for (const rec of sorted) {
    if (forPath && rec.path !== forPath) continue;
    const group = byPath.get(rec.path) ?? [];
    group.push(rec);
    byPath.set(rec.path, group);
  }
  for (const group of byPath.values()) {
    for (const rec of group.slice(config.snapshotMaxPerPath)) selected.set(rec.id, rec);
  }
  for (const rec of sorted.slice(config.snapshotMaxTotal)) selected.set(rec.id, rec);
  return [...selected.values()];
}

export const snapshotService = {
  /**
   * Capture the current state of `path` before a mutation. Returns the record
   * or null when snapshots are disabled / capture failed (never throws).
   */
  async capture(executor: Executor, targetPath: string, op: SnapshotOp): Promise<SnapshotRecord | null> {
    try {
      const config = await filesConfigService.get(executor);
      if (!config.snapshotsEnabled) return null;
      const max = config.snapshotMaxBytes;
      const id = randomUUID();

      // Resolve pre-state. A missing path is a valid snapshot ("absent").
      let stat: Awaited<ReturnType<Executor["stat"]>> | null = null;
      try {
        stat = await executor.stat(targetPath);
      } catch {
        stat = null;
      }

      let kind: SnapshotKind;
      let sizeBytes = 0;
      let blobName: string | undefined;
      let originalMode: string | undefined;
      let note: string | undefined;

      if (!stat) {
        kind = "absent";
      } else if (stat.isDir) {
        await ensureSnapshotDir(executor);
        const blobPath = blobPathFor(id);
        await executor.exec(
          quoteCmd("tar", ["-czf", blobPath, "-C", dirOf(targetPath), baseName(targetPath)]),
          { timeoutMs: TAR_TIMEOUT_MS },
        );
        const blobStat = await executor.stat(blobPath).catch(() => null);
        const sz = blobStat?.size ?? 0;
        if (sz === 0 || sz > max) {
          await removeBlob(executor, id);
          kind = "skipped";
          note = `Carpeta demasiado grande para respaldar (>${max} bytes)`;
        } else {
          kind = "dir";
          sizeBytes = sz;
          blobName = id;
          originalMode = OCTAL.test(stat.mode) ? stat.mode : undefined;
        }
      } else if (stat.size > max) {
        kind = "skipped";
        note = `Archivo demasiado grande para respaldar (${stat.size} > ${max} bytes)`;
      } else {
        const buf = await executor.readFile(targetPath);
        await ensureSnapshotDir(executor);
        await executor.writeFile(blobPathFor(id), buf);
        kind = "file";
        sizeBytes = stat.size;
        blobName = id;
        originalMode = OCTAL.test(stat.mode) ? stat.mode : undefined;
      }

      const rec = await store(executor).create({
        id,
        path: targetPath,
        op,
        kind,
        sizeBytes,
        blobName,
        originalMode,
        note,
        capturedAt: new Date().toISOString(),
      });

      void this.prune(executor, targetPath);
      return rec;
    } catch (err) {
      log.warn({ err: (err as Error).message, targetPath, op }, "snapshot capture failed (non-fatal)");
      return null;
    }
  },

  /** List snapshots, newest first. Optionally filtered by exact path. */
  async list(executor: Executor, forPath?: string): Promise<SnapshotRecord[]> {
    const all = await store(executor).list();
    const rows = forPath ? all.filter((r) => r.path === forPath) : all;
    return rows.sort((a, b) => (b.capturedAt || "").localeCompare(a.capturedAt || ""));
  },

  async get(executor: Executor, id: string): Promise<SnapshotRecord | null> {
    return store(executor).get(id);
  },

  /** Raw blob bytes for a captured snapshot. Throws for absent/skipped. */
  async readBlob(executor: Executor, rec: SnapshotRecord): Promise<Buffer> {
    if (!rec.blobName || (rec.kind !== "file" && rec.kind !== "dir")) {
      throw new Error("snapshot has no downloadable content");
    }
    const raw = await executor.readFile(blobPathFor(rec.blobName));
    return typeof raw === "string" ? Buffer.from(raw) : raw;
  },

  /** Text content of a file snapshot (for diff/preview). */
  async readText(executor: Executor, rec: SnapshotRecord): Promise<string> {
    if (rec.kind !== "file") throw new Error("only file snapshots have text content");
    return (await this.readBlob(executor, rec)).toString("utf-8");
  },

  /**
   * Restore the captured state back onto its original path. Captures the
   * current state first (op="restore") so the restore is itself reversible.
   */
  async restore(executor: Executor, id: string): Promise<SnapshotRecord> {
    const rec = await store(executor).get(id);
    if (!rec) throw new Error("snapshot not found");
    if (rec.kind === "skipped") throw new Error("snapshot content was not captured (too large)");

    // Make the restore reversible.
    await this.capture(executor, rec.path, "restore");

    const parent = dirOf(rec.path);
    if (rec.kind === "absent") {
      await executor.exec(quoteCmd("rm", ["-rf", rec.path]));
    } else if (rec.kind === "file") {
      const buf = await this.readBlob(executor, rec);
      try {
        await executor.exec(quoteCmd("mkdir", ["-p", parent]));
      } catch {
        /* parent likely exists */
      }
      await executor.writeFile(rec.path, buf);
      if (rec.originalMode && OCTAL.test(rec.originalMode)) {
        try {
          await executor.exec(quoteCmd("chmod", [rec.originalMode, rec.path]));
        } catch {
          /* non-fatal */
        }
      }
    } else if (rec.kind === "dir") {
      try {
        await executor.exec(quoteCmd("mkdir", ["-p", parent]));
      } catch {
        /* exists */
      }
      await executor.exec(quoteCmd("tar", ["-xzf", blobPathFor(rec.blobName!), "-C", parent]), {
        timeoutMs: TAR_TIMEOUT_MS,
      });
    }

    invalidateAround(executor, rec.path);
    return rec;
  },

  /** Delete one snapshot (blob + metadata). */
  async remove(executor: Executor, id: string): Promise<boolean> {
    const rec = await store(executor).get(id);
    if (!rec) return false;
    if (rec.blobName) await removeBlob(executor, rec.blobName);
    return store(executor).delete(id);
  },

  /**
   * Retention: keep at most FILES_SNAPSHOT_MAX_PER_PATH per path and
   * FILES_SNAPSHOT_MAX_TOTAL overall, pruning oldest first (blob + metadata).
   */
  async prune(executor: Executor, forPath?: string, strict = false): Promise<void> {
    try {
      const config = await filesConfigService.get(executor);
      const toDelete = pruneCandidates(await store(executor).list(), config, forPath);

      const ids = new Set<string>();
      const blobNames: string[] = [];
      for (const rec of toDelete) {
        if (ids.has(rec.id)) continue;
        ids.add(rec.id);
        if (rec.blobName) blobNames.push(rec.blobName);
      }
      if (ids.size === 0) return;

      // Remove all pruned blobs in a single `rm -f` (best-effort) instead of one
      // exec per record, then drop all metadata entries in a single map write
      // (transaction = 1 read + 1 write) instead of a read+write per delete.
      if (blobNames.length > 0) {
        try {
          const removed = await executor.exec(quoteCmd("rm", ["-f", ...blobNames.map(blobPathFor)]));
          if (removed.exitCode !== 0) throw new Error(removed.stderr || "No se pudieron eliminar copias");
        } catch (err) {
          if (strict) throw err;
          return;
        }
      }
      await store(executor).transaction(async (current) => {
        for (const id of ids) delete current[id];
        return { next: current, result: undefined };
      });
    } catch (err) {
      log.warn({ err: (err as Error).message }, "snapshot prune failed (non-fatal)");
      if (strict) throw err;
    }
  },

  async previewPrune(executor: Executor): Promise<{ count: number; bytes: number; total: number }> {
    const all = await store(executor).list();
    const config = await filesConfigService.get(executor);
    const toDelete = pruneCandidates(all, config);
    return { count: toDelete.length, bytes: toDelete.reduce((sum, rec) => sum + rec.sizeBytes, 0), total: all.length };
  },
};
