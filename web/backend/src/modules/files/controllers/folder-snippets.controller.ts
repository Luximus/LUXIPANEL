// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Folder → terminal-snippets controller. Read-only analysis of a directory on
 * the connected server; returns a snippet plan the UI reviews before importing
 * it through the terminal module's bulk-import endpoint.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { suggestFolderSnippets } from "../services/folder-snippets.service.js";

const suggestSchema = z.object({
  path: z.string().min(1),
});

export const folderSnippetsController = {
  /** GET /api/files/snippets/suggest?path=/var/www/LUXIPANEL */
  suggest: asyncHandler(async (req: Request, res: Response) => {
    const { path } = suggestSchema.parse({ path: req.query["path"] });
    const executor = getExecutor(req);
    const data = await suggestFolderSnippets(path, executor);
    res.json({ ok: true, data });
  }),
};
