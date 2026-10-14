// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Logs controller — view system service logs via journalctl.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { logViewerService, LOGGABLE_SERVICES } from "../services/log-viewer.service.js";

const querySchema = z.object({
  lines: z.coerce.number().int().min(1).max(500).default(100),
  since: z.string().optional(),
  until: z.string().optional(),
  priority: z
    .enum(["emerg", "alert", "crit", "err", "warning", "notice", "info", "debug"])
    .optional(),
  grep: z.string().max(256).optional(),
});

export const logsController = {
  /** GET /api/admin/logs — list loggable services. */
  listServices: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ ok: true, data: [...LOGGABLE_SERVICES] });
  }),

  /** GET /api/admin/logs/:service — fetch logs for a service. */
  getServiceLogs: asyncHandler(async (req: Request, res: Response) => {
    const service = String(req.params["service"]);
    const query = querySchema.parse(req.query);

    const entries = await logViewerService.getServiceLogs(getExecutor(req), service, {
      lines: query.lines,
      since: query.since,
      until: query.until,
      priority: query.priority,
      grep: query.grep,
    });

    res.json({ ok: true, service, data: entries });
  }),

  /** GET /api/admin/logs/kernel — recent kernel (dmesg) messages. */
  getKernelLogs: asyncHandler(async (req: Request, res: Response) => {
    const lines = Math.min(parseInt(String(req.query["lines"] || "50"), 10), 200);
    const data = await logViewerService.getKernelLogs(getExecutor(req), lines);
    res.json({ ok: true, data });
  }),
};
