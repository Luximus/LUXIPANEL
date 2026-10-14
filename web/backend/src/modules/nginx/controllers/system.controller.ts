// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * NGINX system controller — status, service control
 * (start/stop/restart/reload/test), global nginx.conf editor, log tail.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { nginxSystemService, nginxTuningService } from "../services/index.js";
import { configWriteSchema, serviceActionSchema, logsQuerySchema, performanceSchema } from "../models/nginx.model.js";
import { getContextUser } from "../../../shared/executor/context.js";
import { isHostingSession } from "../../../shared/tenant/tenant-scope.js";
import { nginxSitesService } from "../services/nginx-sites.service.js";
import { assertNginxAdmin, assertOwnedSite, filterOwnedSites } from "../nginx-access.js";

export const systemController = {
  status: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const data = await nginxSystemService.status(executor);
    if (isHostingSession(getContextUser())) {
      const sites = filterOwnedSites(await nginxSitesService.listSites(executor));
      data.availableSites = sites.length;
      data.enabledSites = sites.filter((site) => site.enabled).length;
      data.configTest.output = "";
    }
    res.json({ ok: true, data });
  }),

  service: asyncHandler(async (req: Request, res: Response) => {
    assertNginxAdmin();
    const { action } = serviceActionSchema.parse(req.body);
    const data = await nginxSystemService.serviceAction(getExecutor(req), action);
    res.json({ ok: data.ok, data });
  }),

  getConfig: asyncHandler(async (req: Request, res: Response) => {
    assertNginxAdmin();
    const executor = getExecutor(req);
    res.json({ ok: true, data: { content: await nginxSystemService.readGlobalConfig(executor) } });
  }),

  putConfig: asyncHandler(async (req: Request, res: Response) => {
    assertNginxAdmin();
    const { content } = configWriteSchema.parse(req.body);
    await nginxSystemService.writeGlobalConfig(getExecutor(req), content);
    res.json({ ok: true });
  }),

  logs: asyncHandler(async (req: Request, res: Response) => {
    const q = logsQuerySchema.parse(req.query);
    const executor = getExecutor(req);
    if (q.site) await assertOwnedSite(executor, q.site);
    else assertNginxAdmin();
    const data = await nginxSystemService.tailLog(executor, q);
    res.json({ ok: true, data });
  }),

  getPerformance: asyncHandler(async (req: Request, res: Response) => {
    assertNginxAdmin();
    res.json({ ok: true, data: await nginxTuningService.get(getExecutor(req)) });
  }),

  putPerformance: asyncHandler(async (req: Request, res: Response) => {
    assertNginxAdmin();
    const cfg = performanceSchema.parse(req.body);
    await nginxTuningService.apply(getExecutor(req), cfg);
    res.json({ ok: true });
  }),
};
