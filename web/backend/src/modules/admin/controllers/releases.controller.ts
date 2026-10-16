// SPDX-License-Identifier: AGPL-3.0-only
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { releaseDetails, translatedReleaseDetails } from "../services/release-details.service.js";
import { releasesService } from "../services/releases.service.js";
import type { SessionUser } from "../../../shared/types/index.js";

import { releaseBranchDetails } from "../services/release-branches.service.js";
import { ValidationError } from "../../../shared/errors/index.js";

import { projectContributors } from "../services/release-contributors.service.js";

export const releasesController = {
  contributors: asyncHandler(async (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, data: await projectContributors() });
  }),
  preflight: asyncHandler(async (_req, res) => { res.json({ ok: true, data: await releasesService.preflight() }); }),
  status: asyncHandler(async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const base = (res.locals.authBaseUser || res.locals.user) as SessionUser | undefined;
    const canInstall = !!base && base.kind === "admin" && !base.tenantId && !base.direct && (!base.targetId || base.targetId === "local");
    const data = await releasesService.status(req);
    res.json({ ok: true, data: { ...data, canInstall } });
  }),
  branchDetails: asyncHandler(async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, data: await releaseBranchDetails(String(req.params.branch), String(req.query.commit || "")) });
  }),
  details: asyncHandler(async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, data: await releaseDetails(String(req.params.tag)) });
  }),
  translate: asyncHandler(async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, data: await translatedReleaseDetails(String(req.params.tag), req.body?.locale, { executor: getExecutor(req), user: res.locals.user as SessionUser }) });
  }),
  install: asyncHandler(async (req: Request, res: Response) => {
    const tag = typeof req.body?.tag === "string" ? req.body.tag : "";
    if (req.body?.branch !== undefined) {
      if (tag || typeof req.body.branch !== "string" || typeof req.body.commit !== "string") throw new ValidationError("Selecciona una rama y su revisión, o una versión publicada.");
      res.status(202).json({ ok: true, data: await releasesService.start(req, "", { name: req.body.branch, commit: req.body.commit }) });
    } else res.status(202).json({ ok: true, data: await releasesService.start(req, tag) });
  }),
};
