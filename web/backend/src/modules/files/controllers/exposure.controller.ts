// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Exposure controller — scan public roots for sensitive files, probe a file's
 * public URL, and block a file via .htaccess (#3 / #16).
 */

import { pathOnlySchema } from "../../../shared/validators/index.js";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { exposureService } from "../services/index.js";
import { canAccessPath } from "../../../shared/auth/role-permissions.js";


export const exposureController = {
  /** GET /api/files/exposure/scan — sensitive files inside nginx public roots. */
  scan: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const user = res.locals.user;
    const data = await exposureService.scan(executor, (root) => Boolean(user && canAccessPath(user, root, "read")));
    res.json({ ok: true, data });
  }),

  /** GET /api/files/exposure/probe?path= — fetch the file's public URL (SSRF-safe). */
  probe: asyncHandler(async (req: Request, res: Response) => {
    const { path } = pathOnlySchema.parse({ path: req.query["path"] });
    const executor = getExecutor(req);
    try {
      const data = await exposureService.probe(executor, path);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: (err as Error).message });
    }
  }),

  /** POST /api/files/exposure/block — append a .htaccess deny rule for a file. */
  block: asyncHandler(async (req: Request, res: Response) => {
    const { path } = pathOnlySchema.parse(req.body);
    const executor = getExecutor(req);
    const data = await exposureService.blockHtaccess(executor, path);
    res.json({ ok: true, data });
  }),
};
