// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Snapshot controller — list, diff, restore, download and delete the
 * automatic mini-backups taken before edit/delete/move/replace operations
 * ("Modo cambios seguros").
 */

import path from "node:path";
import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { canAccessPath } from "../../../shared/auth/role-permissions.js";
import { snapshotService } from "../services/index.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";

const listSchema = z.object({ path: z.string().min(1).optional() });

/**
 * Snapshots are keyed by opaque id and the captured PATH is internal, so the
 * `files.history` route permission is NOT enough on its own: the snapshot store
 * is per-server (not per-user), so without a path check a user restricted to
 * `/home/x` could list/read/restore snapshots of `/etc/...`. Every handler that
 * exposes or mutates a captured path re-checks the per-group path policy.
 */
function assertCanAccess(res: Response, targetPath: string, op: "read" | "write"): boolean {
  const user = res.locals.user;
  // No session user in context → deny (fail closed).
  if (!user || !canAccessPath(user, targetPath, op)) {
    res.status(403).json({ ok: false, error: apiModuleMessage(res.locals.locale, "pathForbidden") });
    return false;
  }
  return true;
}

export const snapshotController = {
  /** GET /api/files/snapshots?path= — list snapshots (newest first). */
  list: asyncHandler(async (req: Request, res: Response) => {
    const { path: forPath } = listSchema.parse({ path: req.query["path"] });
    const executor = getExecutor(req);
    const user = res.locals.user;
    const snapshots = await snapshotService.list(executor, forPath);
    // Drop snapshots whose captured path the caller can't read.
    const visible = snapshots.filter((s) => user && canAccessPath(user, s.path, "read"));
    res.json({ ok: true, data: visible });
  }),

  /**
   * GET /api/files/snapshots/:id/diff — before/after for a file snapshot.
   * `before` is the captured blob text; `after` is the file's current content
   * ("" if it no longer exists). Front-end feeds both into the Monaco diff.
   */
  diff: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"]);
    const executor = getExecutor(req);
    const rec = await snapshotService.get(executor, id);
    if (!rec) {
      res.status(404).json({ ok: false, error: apiModuleMessage(res.locals.locale, "snapshotNotFound") });
      return;
    }
    if (!assertCanAccess(res, rec.path, "read")) return;
    if (rec.kind !== "file") {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "snapshotCompareOnly") });
      return;
    }
    const before = await snapshotService.readText(executor, rec);
    let after = "";
    try {
      const raw = await executor.readFile(rec.path, "utf-8");
      after = typeof raw === "string" ? raw : raw.toString("utf-8");
    } catch {
      after = "";
    }
    res.json({ ok: true, path: rec.path, kind: rec.kind, before, after });
  }),

  /** POST /api/files/snapshots/:id/restore — restore captured state. */
  restore: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"]);
    const executor = getExecutor(req);
    // Resolve the captured path FIRST and enforce write access before the
    // restore writes to it (arbitrary-write otherwise).
    const target = await snapshotService.get(executor, id);
    if (!target) {
      res.status(404).json({ ok: false, error: apiModuleMessage(res.locals.locale, "snapshotNotFound") });
      return;
    }
    if (!assertCanAccess(res, target.path, "write")) return;
    try {
      const rec = await snapshotService.restore(executor, id);
      res.json({ ok: true, path: rec.path, kind: rec.kind });
    } catch (err) {
      res.status(400).json({ ok: false, error: (err as Error).message });
    }
  }),

  /** GET /api/files/snapshots/:id/download — download the backup blob. */
  download: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"]);
    const executor = getExecutor(req);
    const rec = await snapshotService.get(executor, id);
    if (!rec) {
      res.status(404).json({ ok: false, error: apiModuleMessage(res.locals.locale, "snapshotNotFound") });
      return;
    }
    if (!assertCanAccess(res, rec.path, "read")) return;
    if (rec.kind === "absent" || rec.kind === "skipped") {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "snapshotNoDownload") });
      return;
    }
    const buf = await snapshotService.readBlob(executor, rec);
    const base = path.basename(rec.path.replace(/\/+$/, "")) || "snapshot";
    const filename = rec.kind === "dir" ? `${base}.tar.gz` : base;
    const mime = rec.kind === "dir" ? "application/gzip" : "application/octet-stream";
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", buf.length);
    res.end(buf);
  }),

  /** DELETE /api/files/snapshots/:id — drop a snapshot (blob + metadata). */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"]);
    const executor = getExecutor(req);
    const rec = await snapshotService.get(executor, id);
    if (!rec) {
      res.status(404).json({ ok: false, error: apiModuleMessage(res.locals.locale, "snapshotNotFound") });
      return;
    }
    if (!assertCanAccess(res, rec.path, "write")) return;
    const ok = await snapshotService.remove(executor, id);
    if (!ok) {
      res.status(404).json({ ok: false, error: apiModuleMessage(res.locals.locale, "snapshotNotFound") });
      return;
    }
    res.json({ ok: true });
  }),
};
