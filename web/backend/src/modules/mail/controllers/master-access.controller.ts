// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Master-access controller — the panel's Dovecot master user on the connected
 * mail server (see `services/mail-master.service`). The credential itself is
 * never returned; only its status. Provisioning is otherwise lazy (first inbox
 * open), these endpoints let an operator inspect, force, rotate or remove it.
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../../shared/types/index.js";
import { requireExecutor } from "../../../shared/executor/index.js";
import { mailMasterService } from "../services/mail-master.service.js";

const ensureSchema = z.object({
  rotate: z.boolean().optional(),
});

export const masterAccessController = {
  /** GET /api/mail/master-access — status on the connected server. */
  status: asyncHandler(async (_req: Request, res: Response) => {
    const executor = requireExecutor();
    res.json({ ok: true, data: await mailMasterService.status(executor) });
  }),

  /** POST /api/mail/master-access — provision (or `{rotate:true}` re-key). */
  ensure: asyncHandler(async (req: Request, res: Response) => {
    const executor = requireExecutor();
    const { rotate } = ensureSchema.parse(req.body ?? {});
    await mailMasterService.ensure(executor, { rotate: rotate === true });
    res.json({ ok: true, data: await mailMasterService.status(executor) });
  }),

  /** DELETE /api/mail/master-access — remove the master user from the server. */
  disable: asyncHandler(async (_req: Request, res: Response) => {
    const executor = requireExecutor();
    await mailMasterService.disable(executor);
    res.json({ ok: true, data: await mailMasterService.status(executor) });
  }),
};
