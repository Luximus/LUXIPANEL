// SPDX-License-Identifier: AGPL-3.0-only
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { releasesService } from "../services/releases.service.js";
import type { SessionUser } from "../../../shared/types/index.js";

export const releasesController = {
  preflight: asyncHandler(async (_req, res) => { res.json({ ok: true, data: await releasesService.preflight() }); }),
  status: asyncHandler(async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const base = (res.locals.authBaseUser || res.locals.user) as SessionUser | undefined;
    const canInstall = !!base && base.kind === "admin" && !base.tenantId && !base.direct && (!base.targetId || base.targetId === "local");
    const data = await releasesService.status(req);
    res.json({ ok: true, data: { ...data, canInstall } });
  }),
  install: asyncHandler(async (req: Request, res: Response) => {
    const tag = typeof req.body?.tag === "string" ? req.body.tag : "";
    res.status(202).json({ ok: true, data: await releasesService.start(req, tag) });
  }),
};
