// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { filesConfigService } from "../services/files-config.service.js";
import { snapshotService } from "../services/snapshot.service.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";

const ceiling = filesConfigService.ceilings();
const MiB = 1024 * 1024;
const patchSchema = z.object({
  uploadMaxBytes: z.number().int().min(MiB).max(ceiling.uploadMaxBytes).multipleOf(MiB).optional(),
  snapshotsEnabled: z.boolean().optional(),
  snapshotMaxBytes: z.number().int().min(MiB).max(ceiling.snapshotMaxBytes).multipleOf(MiB).optional(),
  snapshotMaxPerPath: z.number().int().min(1).max(ceiling.snapshotMaxPerPath).optional(),
  snapshotMaxTotal: z.number().int().min(1).max(ceiling.snapshotMaxTotal).optional(),
  sharingEnabled: z.boolean().optional(),
  shareMaxExpiryMin: z.number().int().min(60).max(43_200).multipleOf(60).optional(),
  sharePasswordRequired: z.boolean().optional(),
}).strict();

function isAdmin(res: Response): boolean { return res.locals.user?.kind === "admin"; }

export const filesConfigController = {
  effective: asyncHandler(async (req: Request, res: Response) => {
    const data = await filesConfigService.get(getExecutor(req));
    res.json({ ok: true, data });
  }),
  get: asyncHandler(async (req: Request, res: Response) => {
    if (!isAdmin(res)) { res.status(403).json({ ok: false, error: apiModuleMessage(res.locals.locale, "adminOnly") }); return; }
    const data = await filesConfigService.get(getExecutor(req));
    res.json({ ok: true, data: { ...data, ceilings: ceiling } });
  }),
  patch: asyncHandler(async (req: Request, res: Response) => {
    if (!isAdmin(res)) { res.status(403).json({ ok: false, error: apiModuleMessage(res.locals.locale, "adminOnly") }); return; }
    const values = patchSchema.parse(req.body);
    const data = await filesConfigService.patch(getExecutor(req), values);
    res.json({ ok: true, data: { ...data, ceilings: ceiling } });
  }),
  prunePreview: asyncHandler(async (req: Request, res: Response) => {
    if (!isAdmin(res)) { res.status(403).json({ ok: false, error: apiModuleMessage(res.locals.locale, "adminOnly") }); return; }
    res.json({ ok: true, data: await snapshotService.previewPrune(getExecutor(req)) });
  }),
  prune: asyncHandler(async (req: Request, res: Response) => {
    if (!isAdmin(res)) { res.status(403).json({ ok: false, error: apiModuleMessage(res.locals.locale, "adminOnly") }); return; }
    const executor = getExecutor(req);
    const preview = await snapshotService.previewPrune(executor);
    await snapshotService.prune(executor, undefined, true);
    res.json({ ok: true, data: preview });
  }),
};
