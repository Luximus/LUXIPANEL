// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cron logs controller — per-execution `.log` files (start/during/end) for
 * both classic script jobs and scheduled AI-agent jobs.
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { cronLogService } from "../services/cron-log.service.js";
import { cronParserService } from "../services/cron-parser.service.js";
import { resolveCronOwner, cronUserLogsRoot } from "../services/cron-owner.service.js";
import { NotFoundError } from "../../../shared/errors/index.js";

async function authorizedLogRoot(req: Request, res: Response, id: string) {
  const executor = getExecutor(req);
  const owner = await resolveCronOwner(res.locals.user, executor, req.query.user);
  const jobs = await cronParserService.listWithExecutor(owner.username, executor, owner);
  const job = jobs.find((item) => item.id === id && item.managed);
  if (!job) throw new NotFoundError("Cron job");
  const privateLogs = Boolean(job.wrapperPath?.includes("/.local/libexec/luxipanel/"));
  return { executor, root: privateLogs ? cronUserLogsRoot(owner) : undefined, runAs: privateLogs && !owner.direct ? owner.username : undefined };
}

export const logsController = {
  /** GET /api/cron/jobs/:id/logs — list recent executions of a job. */
  list: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
    const { executor, root, runAs } = await authorizedLogRoot(req, res, id);
    const data = await cronLogService.list(id, executor, limit, root, runAs);
    res.json({ ok: true, data });
  }),

  /** GET /api/cron/jobs/:id/logs/:file — read one execution log (tail). */
  read: asyncHandler(async (req: Request, res: Response) => {
    const { id, file } = z
      .object({ id: z.string(), file: z.string() })
      .parse({ id: req.params.id, file: req.params.file });
    const { executor, root, runAs } = await authorizedLogRoot(req, res, id);
    const content = await cronLogService.read(id, file, executor, 200_000, root, runAs);
    res.json({ ok: true, data: { file, content } });
  }),
};
