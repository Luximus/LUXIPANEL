// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Operations controller — create, rename, delete, copy, move, chmod.
 */

import { z } from "zod";

import { pathOnlySchema } from "../../../shared/validators/index.js";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { apiErrorMessage } from "../../../shared/i18n/errors.js";
import { getExecutor, LOCAL_TARGET_ID } from "../../../shared/executor/index.js";
import { dirOf } from "../../../shared/utils/posix-path.js";
import { permissionsService } from "../services/index.js";
import { archiveService, type ArchiveFormat } from "../services/index.js";
import { snapshotService } from "../services/index.js";
import { privilegedRemove, privilegedRename } from "../../../shared/system/privileged-fs-ops.js";
import { invalidateDir, invalidateFile, invalidateStat } from "../../../shared/files-cache/index.js";


const deleteSchema = z.object({
  path: z.string().min(1),
  recursive: z.boolean().default(false),
});
const renameSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});
const copySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});
const chmodSchema = z.object({
  path: z.string().min(1),
  mode: z.string().regex(/^[0-7]{3,4}$/, "Mode must be octal, e.g. 755"),
});
const chownSchema = z.object({
  path: z.string().min(1),
  owner: z.string().min(1),
  group: z.string().optional(),
});
const chmodRecursiveSchema = z.object({
  path: z.string().min(1),
  fileMode: z.string().regex(/^[0-7]{3,4}$/).optional(),
  dirMode: z.string().regex(/^[0-7]{3,4}$/).optional(),
  applyTo: z.enum(["all", "files", "dirs"]).default("all"),
});
const compressSchema = z.object({
  sources: z.array(z.string().min(1)).min(1),
  dest: z.string().min(1),
  format: z.enum(["tar.gz", "tar.bz2", "zip"]).default("tar.gz"),
});
const extractSchema = z.object({
  archive: z.string().min(1),
  destDir: z.string().min(1),
});

export const operationsController = {
  /** POST /api/files/mkdir — create directory. */
  mkdir: asyncHandler(async (req: Request, res: Response) => {
    const { path } = pathOnlySchema.parse(req.body);
    const executor = getExecutor(req);
    await executor.mkdir(path, { recursive: true });
    void invalidateDir(executor, path);
    res.status(201).json({ ok: true });
  }),

  /** DELETE /api/files — delete file or directory. Accepts body or query params. */
  delete: asyncHandler(async (req: Request, res: Response) => {
    const source = req.body && Object.keys(req.body).length > 0
      ? req.body
      : { path: req.query["path"], recursive: req.query["recursive"] === "true" };
    const body = deleteSchema.parse(source);
    const executor = getExecutor(req);
    // Mini-backup before destroying the path (non-fatal).
    await snapshotService.capture(executor, body.path, "delete");
    // Unprivileged rm first; on a permission failure (e.g. a root-owned file
    // inside another user's dir) escalate to `sudo rm`, mirroring the upload
    // ladder — so files that ended up root-owned are still manageable.
    await privilegedRemove(executor, body.path, body.recursive);
    void invalidateDir(executor, body.path);
    void invalidateFile(executor, body.path);
    void invalidateStat(executor, body.path);
    res.json({ ok: true });
  }),

  /** PUT /api/files/rename — rename or move a path. */
  rename: asyncHandler(async (req: Request, res: Response) => {
    const body = renameSchema.parse(req.body);
    const executor = getExecutor(req);
    // Mini-backup of the source before it moves away (non-fatal).
    await snapshotService.capture(executor, body.from, "move");
    // Unprivileged rename first; on a permission failure escalate to `sudo mv`
    // (also handles a cross-filesystem move) so root-owned entries can move.
    await privilegedRename(executor, body.from, body.to);
    void invalidateDir(executor, body.from);
    if (dirOf(body.from) !== dirOf(body.to)) void invalidateDir(executor, body.to);
    void invalidateFile(executor, body.from);
    void invalidateFile(executor, body.to);
    void invalidateStat(executor, body.from);
    void invalidateStat(executor, body.to);
    res.json({ ok: true });
  }),

  /** POST /api/files/copy — copy a file. */
  copy: asyncHandler(async (req: Request, res: Response) => {
    const body = copySchema.parse(req.body);
    const executor = getExecutor(req);
    // Mini-backup of the destination in case the copy overwrites it (non-fatal).
    await snapshotService.capture(executor, body.to, "copy");
    const content = await executor.readFile(body.from);
    await executor.writeFile(body.to, content);
    void invalidateDir(executor, body.to);
    void invalidateFile(executor, body.to);
    void invalidateStat(executor, body.to);
    res.status(201).json({ ok: true });
  }),

  /** PUT /api/files/chmod — change file permissions. */
  chmod: asyncHandler(async (req: Request, res: Response) => {
    const body = chmodSchema.parse(req.body);
    const executor = getExecutor(req);
    // Mini-backup captures the previous mode (restorable) (non-fatal).
    await snapshotService.capture(executor, body.path, "chmod");
    // Both paths go through the executor now: chmodWithExecutor escalates to
    // `sudo chmod` on EPERM (root-owned entry), which the old local fs.chmodSync
    // could not do (it surfaced an opaque 500).
    await permissionsService.chmodWithExecutor(body.path, body.mode, executor);
    void invalidateDir(executor, body.path);
    void invalidateStat(executor, body.path);
    res.json({ ok: true });
  }),

  /** GET /api/files/permissions/recommend?path= — current mode + advice (#5). */
  recommendPermissions: asyncHandler(async (req: Request, res: Response) => {
    const path = String(req.query["path"] || "");
    if (!path) {
      res.status(400).json({ ok: false, error: `path: ${apiErrorMessage(res.locals.locale, "required")}` });
      return;
    }
    const executor = getExecutor(req);
    const stat = await executor.stat(path);
    const analysis = permissionsService.analyzeMode(stat.mode, stat.isDir);
    res.json({ ok: true, data: { path, mode: stat.mode, isDir: stat.isDir, ...analysis } });
  }),

  /** PUT /api/files/chmod-recursive — apply file/dir modes across a tree (#5). */
  chmodRecursive: asyncHandler(async (req: Request, res: Response) => {
    const body = chmodRecursiveSchema.parse(req.body);
    const executor = getExecutor(req);
    // Safe-changes: capture the tree before a bulk permission change.
    await snapshotService.capture(executor, body.path, "chmod");
    await permissionsService.chmodRecursiveWithExecutor(executor, body);
    void invalidateDir(executor, body.path);
    void invalidateStat(executor, body.path);
    res.json({ ok: true });
  }),

  /** PUT /api/files/chown — change file owner. */
  chown: asyncHandler(async (req: Request, res: Response) => {
    const body = chownSchema.parse(req.body);
    const executor = getExecutor(req);
    if (executor.target.id === LOCAL_TARGET_ID) {
      permissionsService.chown(body.path, body.owner, body.group);
    } else {
      await permissionsService.chownWithExecutor(body.path, body.owner, body.group, executor);
    }
    void invalidateDir(executor, body.path);
    void invalidateStat(executor, body.path);
    res.json({ ok: true });
  }),

  /** POST /api/files/compress — create archive. */
  compress: asyncHandler(async (req: Request, res: Response) => {
    const body = compressSchema.parse(req.body);
    const executor = getExecutor(req);
    if (executor.target.id === LOCAL_TARGET_ID) {
      archiveService.compress(body.sources, body.dest, body.format as ArchiveFormat);
    } else {
      await archiveService.compressWithExecutor(body.sources, body.dest, body.format as ArchiveFormat, executor);
    }
    void invalidateDir(executor, body.dest);
    res.status(201).json({ ok: true });
  }),

  /** POST /api/files/extract — extract archive. */
  extract: asyncHandler(async (req: Request, res: Response) => {
    const body = extractSchema.parse(req.body);
    const executor = getExecutor(req);
    if (executor.target.id === LOCAL_TARGET_ID) {
      archiveService.extract(body.archive, body.destDir);
    } else {
      await archiveService.extractWithExecutor(body.archive, body.destDir, executor);
    }
    // destDir gets a wave of new entries; drop its listing (and parent's).
    void invalidateDir(executor, body.destDir);
    res.json({ ok: true });
  }),

  /** GET /api/files/archive-contents?path= — list archive contents. */
  archiveContents: asyncHandler(async (req: Request, res: Response) => {
    const archivePath = String(req.query["path"] || "");
    const executor = getExecutor(req);
    const contents = executor.target.id === LOCAL_TARGET_ID
      ? archiveService.listContents(archivePath)
      : await archiveService.listContentsWithExecutor(archivePath, executor);
    res.json({ ok: true, data: contents });
  }),
};
