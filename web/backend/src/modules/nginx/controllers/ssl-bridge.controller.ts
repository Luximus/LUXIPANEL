// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * NGINX ↔ SSL bridge — issues a Let's Encrypt certificate via the nginx
 * module's own `certbotService` and wires the resulting cert into the site's
 * server block. SSL is part of NGINX now (the standalone SSL module was
 * removed); certbot handling lives under nginx/services.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { AppError } from "../../../shared/errors/index.js";
import { certbotService } from "../services/index.js";
import { nginxSitesService } from "../services/index.js";
import { enableSslSchema, siteNameSchema } from "../models/nginx.model.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { firstServerNameTokens } from "../../../shared/nginx/server-name.js";
import { refreshSync } from "../../../shared/remote-cache/refresh.js";
import { CACHE_KEYS } from "../../../shared/cache/cacheable-modules.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { assertNginxAdmin, assertOwnedSite, filterOwnedSites } from "../nginx-access.js";

const log = createModuleLogger("nginx-ssl-bridge");

export const sslBridgeController = {
  /** GET /api/nginx/ssl/renewal — actual scheduler + reload-hook state. */
  renewalStatus: asyncHandler(async (req: Request, res: Response) => {
    res.json({ ok: true, data: await certbotService.renewalStatusWithExecutor(getExecutor(req)) });
  }),

  /** GET /api/nginx/ssl/renewal/sites — per-site Certbot coverage, tenant-scoped. */
  siteRenewalStatuses: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const sites = filterOwnedSites(await nginxSitesService.listSitesWithContent(executor));
    res.json({ ok: true, data: await certbotService.siteRenewalStatusesWithExecutor(executor, sites) });
  }),

  /** POST /api/nginx/ssl/renewal — idempotent setup for existing certificates. */
  configureRenewal: asyncHandler(async (req: Request, res: Response) => {
    assertNginxAdmin();
    res.json({ ok: true, data: await certbotService.ensureAutoRenewalWithExecutor(getExecutor(req)) });
  }),

  /** POST /api/nginx/ssl/renewal/dry-run — staging validation, admin only. */
  testRenewal: asyncHandler(async (req: Request, res: Response) => {
    assertNginxAdmin();
    res.json({ ok: true, data: await certbotService.dryRunRenewalWithExecutor(getExecutor(req)) });
  }),

  /** POST /api/nginx/sites/:name/ssl — issue cert + inject TLS directives. */
  enable: asyncHandler(async (req: Request, res: Response) => {
    const name = siteNameSchema.parse(req.params.name);
    const { email } = enableSslSchema.parse(req.body);
    const executor = getExecutor(req);
    await assertOwnedSite(executor, name);

    // Resolve the primary domain from the site config.
    const content = await nginxSitesService.readRaw(executor, name);
    const sn = firstServerNameTokens(content)[0];
    const domain = sn && sn !== "_" ? sn : name;

    const result = await certbotService.issueWithExecutor(domain, email, executor);
    if (!result.success || !result.certPath || !result.keyPath) {
      throw new AppError(result.error ?? "No se pudo emitir el certificado", 502, "CERTBOT_FAILED");
    }

    await nginxSitesService.applySslToSite(executor, name, result.certPath, result.keyPath);
    let renewal: { automatic: boolean; scheduler?: string | null; error?: string };
    try {
      const status = await certbotService.ensureAutoRenewalWithExecutor(executor);
      renewal = { automatic: status.automatic, scheduler: status.scheduler };
    } catch (error) {
      renewal = { automatic: false, error: (error as Error).message };
      log.warn({ name, domain, target: executor.target.id, error: renewal.error }, "HTTPS enabled but automatic renewal needs attention");
    }
    log.info({ name, domain, target: executor.target.id }, "HTTPS enabled for site");
    eventBus.emit(Events.SSL_ISSUED, { domain, site: name, target: executor.target.id });
    // Cert issued + site's TLS state changed: refresh the NGINX sites cache so
    // the DataTable reflects the new TLS state without waiting for a tick.
    await refreshSync(executor, CACHE_KEYS.nginx.sites.module, CACHE_KEYS.nginx.sites.collection);
    res.json({ ok: true, data: { domain, certPath: result.certPath, renewal } });
  }),
};
