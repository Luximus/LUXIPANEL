// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * File-meta controller — tags (#23) + comments (#24) per path.
 */

import { z } from "zod";

import { pathOnlySchema } from "../../../shared/validators/index.js";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { canAccessPath } from "../../../shared/auth/role-permissions.js";
import { fileMetaService } from "../services/index.js";

const setSchema = z.object({
  path: z.string().min(1),
  tags: z.array(z.string()).default([]),
  comment: z.string().default(""),
});

export const fileMetaController = {
  /** GET /api/files/meta?path= */
  get: asyncHandler(async (req: Request, res: Response) => {
    const { path } = pathOnlySchema.parse({ path: req.query["path"] });
    const data = await fileMetaService.get(getExecutor(req), path);
    res.json({ ok: true, data });
  }),

  /** PUT /api/files/meta */
  set: asyncHandler(async (req: Request, res: Response) => {
    const body = setSchema.parse(req.body);
    const data = await fileMetaService.set(getExecutor(req), body.path, body.tags, body.comment);
    res.json({ ok: true, data });
  }),

  /** GET /api/files/meta/all — all annotated files. */
  all: asyncHandler(async (req: Request, res: Response) => {
    const data = await fileMetaService.listAll(getExecutor(req));
    const user = res.locals.user;
    res.json({ ok: true, data: data.filter((entry) => user && canAccessPath(user, entry.path, "read")) });
  }),
};
