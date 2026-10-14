// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cron status controller — daemon install / service control, mirroring the
 * firewall module's install methodology (packageInstaller + sudo prompt).
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { cronDaemonService } from "../services/cron-daemon.service.js";

export const cronStatusController = {
  /** GET /api/cron/status — installed? service active? wrapper present? */
  overview: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const data = await cronDaemonService.overview(executor);
    res.json({ ok: true, data });
  }),

  /** POST /api/cron/install — install cron package + service + log wrapper. */
  install: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { sudoPassword?: string };
    const executor = getExecutor(req);
    const sudoPassword = typeof body.sudoPassword === "string" ? body.sudoPassword : undefined;
    const result = await cronDaemonService.install(executor, { sudoPassword });
    // Surface code/output inside `data` for the shared install-modal helper.
    res.json({ ok: result.ok, code: result.code, data: { ...result, code: result.code, output: result.output } });
  }),

  /** POST /api/cron/service/enable — start + enable the cron service. */
  enableService: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { sudoPassword?: string };
    const executor = getExecutor(req);
    const result = await cronDaemonService.enableService(executor, { sudoPassword: body.sudoPassword });
    res.json({ ok: result.ok, code: result.code, data: { code: result.code, output: result.output } });
  }),

  /** POST /api/cron/service/disable — stop + disable the cron service. */
  disableService: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { sudoPassword?: string };
    const executor = getExecutor(req);
    const result = await cronDaemonService.disableService(executor, { sudoPassword: body.sudoPassword });
    res.json({ ok: result.ok, code: result.code, data: { code: result.code, output: result.output } });
  }),
};
