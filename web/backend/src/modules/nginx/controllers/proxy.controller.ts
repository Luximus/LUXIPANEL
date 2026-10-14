// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * NGINX reverse-proxy / upstreams controller — generate and deploy proxy
 * server blocks (optionally backed by an `upstream {}` pool).
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { nginxSitesService } from "../services/index.js";
import { proxySchema } from "../models/nginx.model.js";
import { refreshSync } from "../../../shared/remote-cache/refresh.js";
import { CACHE_KEYS } from "../../../shared/cache/cacheable-modules.js";
import { assertNginxAdmin } from "../nginx-access.js";

export const proxyController = {
  preview: asyncHandler(async (req: Request, res: Response) => {
    assertNginxAdmin();
    const cfg = proxySchema.parse(req.body);
    res.json({ ok: true, data: { content: nginxSitesService.generateProxyConfig(cfg) } });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    assertNginxAdmin();
    const cfg = proxySchema.parse(req.body);
    const executor = getExecutor(req);
    const content = nginxSitesService.generateProxyConfig(cfg);
    await nginxSitesService.createSiteRaw(executor, cfg.domain, content, cfg.enabled);
    await refreshSync(executor, CACHE_KEYS.nginx.sites.module, CACHE_KEYS.nginx.sites.collection);
    res.status(201).json({ ok: true, data: { name: cfg.domain } });
  }),
};
