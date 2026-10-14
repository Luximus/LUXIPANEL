// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Dashboard controller — server overview (stats + disk + services + top
 * processes). The old /panel landing page that rendered it was replaced by the
 * Agentes IA home; the endpoint remains as a read API and backs the
 * `dashboard.overview` agent capability.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { dashboardOverviewService } from "../services/dashboard-overview.service.js";

export const dashboardController = {
  /** GET /api/dashboard/overview — stats + disk + services + top processes. */
  overview: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const overview = await dashboardOverviewService.collect(executor);
    res.json({ ok: true, data: overview });
  }),
};
