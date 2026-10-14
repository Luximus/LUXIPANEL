// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Share-links controller (#17). Served by the client's nginx/PHP gatekeeper.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { canAccessPath } from "../../../shared/auth/role-permissions.js";
import path from "node:path";
import { assertCanonicalFilePathPermission } from "../middlewares/role-file-permissions.middleware.js";
import { shareService } from "../services/index.js";

const createSchema = z.object({
  path: z.string().min(1),
  root: z.string().min(1),
  expiresInMin: z.number().int().positive().max(60 * 24 * 30).default(60),
  password: z.string().max(200).optional(),
  maxDownloads: z.number().int().min(0).max(100000).optional(),
});

export const shareController = {
  /** GET /api/files/share/roots — public roots a share can be published under. */
  roots: asyncHandler(async (req: Request, res: Response) => {
    const data = await shareService.publicRoots(getExecutor(req));
    const user = res.locals.user;
    res.json({ ok: true, data: data.filter((root) => user && canAccessPath(user, root.root, "write")) });
  }),

  /** GET /api/files/share — list shares (with live download counts). */
  list: asyncHandler(async (req: Request, res: Response) => {
    const data = await shareService.list(getExecutor(req));
    const user = res.locals.user;
    res.json({ ok: true, data: data.filter((entry) => user && canAccessPath(user, entry.path, "read") && (user.kind === "admin" || entry.createdBy === String(user.userId))) });
  }),

  /** POST /api/files/share — create a share link. */
  create: asyncHandler(async (req: Request, res: Response) => {
    const body = createSchema.parse(req.body);
    const user = res.locals.user;
    if (!user || !canAccessPath(user, body.path, "read") || !canAccessPath(user, body.root, "write")) {
      res.status(403).json({ ok: false, error: apiModuleMessage(res.locals.locale, "pathForbidden") });
      return;
    }
    await assertCanonicalFilePathPermission(getExecutor(req), user, path.posix.join(body.root, "_lxpshare.php"), "write");
    try {
      const data = await shareService.create(getExecutor(req), { ...body, createdBy: String(user.userId) });
      res.status(201).json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: (err as Error).message });
    }
  }),

  /** POST /api/files/share/:token/revoke */
  revoke: asyncHandler(async (req: Request, res: Response) => {
    const token = String(req.params["token"]);
    const executor = getExecutor(req);
    const entry = await shareService.get(executor, token);
    if (!entry) { res.status(404).json({ ok: false, error: apiModuleMessage(res.locals.locale, "shareNotFound") }); return; }
    const user = res.locals.user;
    if (!user || !canAccessPath(user, entry.path, "write") || (user.kind !== "admin" && entry.createdBy !== String(user.userId))) {
      res.status(403).json({ ok: false, error: apiModuleMessage(res.locals.locale, "shareForbidden") });
      return;
    }
    const ok = await shareService.revoke(executor, token);
    res.status(ok ? 200 : 502).json({ ok, error: ok ? undefined : apiModuleMessage(res.locals.locale, "shareRevokeFailed") });
  }),
};
