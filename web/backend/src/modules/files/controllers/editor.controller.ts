// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Editor controller — read and write file contents inline.
 * Limited to text files under 2MB.
 */

import { z } from "zod";

import { pathOnlySchema } from "../../../shared/validators/index.js";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { invalidateDir, invalidateFile, invalidateStat, readCachedFileContent, writeCachedFileContent } from "../../../shared/files-cache/index.js";
import { AppError, ErrorCodes } from "../../../shared/errors/index.js";
import { env } from "../../../config/env.js";
import { snapshotService } from "../services/index.js";

const writeSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  encoding: z.enum(["utf-8"]).default("utf-8"),
});

export const editorController = {
  /** GET /api/files/read?path= — read a text file.
   *
   *  Cache-first for small files (≤ FILES_CONTENT_CACHE_MAX_BYTES). Short
   *  TTL (30 s default) so out-of-band writes surface quickly; every
   *  panel-driven mutation invalidates the file's cache key, so writes from
   *  *this* user are seen immediately. */
  read: asyncHandler(async (req: Request, res: Response) => {
    const { path } = pathOnlySchema.parse({ path: req.query["path"] });
    const executor = getExecutor(req);
    const cached = await readCachedFileContent(executor, path);
    if (cached !== null) {
      res.json({ ok: true, path, content: cached, fromCache: true });
      return;
    }
    // Guard against OOM: sftp.readFile buffers the whole file and the UTF-8
    // conversion doubles the memory. Stat first and reject oversized files with
    // 413 instead of loading a multi-GB blob into the panel's heap.
    try {
      const info = await executor.stat(path);
      if (!info.isDir && info.size > env.FILES_EDITOR_MAX_BYTES) {
        throw new AppError(
          `El archivo es demasiado grande para el editor (máx. ${Math.floor(env.FILES_EDITOR_MAX_BYTES / (1024 * 1024))} MB).`,
          413,
          ErrorCodes.PAYLOAD_TOO_LARGE,
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // stat failed for another reason (missing file, transient) — let the
      // read below surface the real error.
    }
    const raw = await executor.readFile(path, "utf-8");
    const content = typeof raw === "string" ? raw : raw.toString("utf-8");
    void writeCachedFileContent(executor, path, content);
    res.json({ ok: true, path, content });
  }),

  /** PUT /api/files/write — write text content to a file. */
  write: asyncHandler(async (req: Request, res: Response) => {
    const body = writeSchema.parse(req.body);
    const executor = getExecutor(req);
    // Mini-backup of the pre-edit state before we overwrite it (non-fatal).
    await snapshotService.capture(executor, body.path, "edit");
    await executor.writeFile(body.path, body.content, { encoding: body.encoding });
    // Listing of the parent dir may have a new file (first write) or an
    // updated mtime/size for an existing one — drop both.
    void invalidateDir(executor, body.path);
    // And the cached content itself, so the next read returns the fresh bytes.
    void invalidateFile(executor, body.path);
    // mtime/size change too — drop stat cache.
    void invalidateStat(executor, body.path);
    res.json({ ok: true });
  }),
};
