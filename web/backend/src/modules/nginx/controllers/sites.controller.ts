import { guardHostingResourceMutation } from "../../../shared/quota/resource-creation-lock.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * NGINX sites controller — server block CRUD, enable/disable, raw editor,
 * discovered-domain listing (kept for the SSL & Mail module pickers).
 */

import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { nginxSitesService, serverDomainsService } from "../services/index.js";
import { createSiteSchema, updateSiteSchema, previewSiteSchema, siteNameSchema } from "../models/nginx.model.js";
import { serveCachedDataTable } from "../../../shared/remote-cache/serve-cached-datatable.js";
import { refreshSync } from "../../../shared/remote-cache/refresh.js";
import { CACHE_KEYS } from "../../../shared/cache/cacheable-modules.js";
import { getContextUser } from "../../../shared/executor/context.js";
import {
  isHostingSession,
  getTenantEnvelope,
  assertWithinDomainQuota,
} from "../../../shared/tenant/tenant-scope.js";
import { tenantResourcesService } from "../../../shared/tenant/tenant-resources.service.js";
import { recordActivity } from "../../../shared/worklog/worklog-recorder.service.js";
import { assertHostingFormAllowed, assertNginxAdmin, assertOwnedSite, filterOwnedSites } from "../nginx-access.js";

function fnv1aId(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash & 0x7fffffff;
}

export const sitesController = {
  /** GET /api/nginx/sites — cache-first via collector-nginx.py. */
  list: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const cached = await serveCachedDataTable<Record<string, unknown>>({
      executor, module: CACHE_KEYS.nginx.sites.module, collection: CACHE_KEYS.nginx.sites.collection,
      liveLoader: async () =>
        (await nginxSitesService.listSites(executor)) as unknown as Record<string, unknown>[],
    });
    res.json({ ok: true, data: filterOwnedSites(cached.rows) });
  }),

  raw: asyncHandler(async (req: Request, res: Response) => {
    const name = siteNameSchema.parse(req.params.name);
    const executor = getExecutor(req);
    await assertOwnedSite(executor, name);
    const content = await nginxSitesService.readRaw(executor, name);
    const revision = createHash("sha256").update(content).digest("hex");
    res.json({ ok: true, data: { name, content, revision, editableForm: nginxSitesService.parseManagedForm(content) } });
  }),

  create: asyncHandler(guardHostingResourceMutation("domains", async (req: Request, res: Response) => {
    const body = createSiteSchema.parse(req.body);
    const executor = getExecutor(req);

    // Fase 6 — ADITIVE tenant gate: count domains the tenant owns and reject
    // when the cap is reached. Admin/normal sessions skip this entirely.
    const ctx = getContextUser();
    const hosting = isHostingSession(ctx);
    assertHostingFormAllowed(body);
    if (hosting) {
      const env = getTenantEnvelope(ctx!);
      const tenantCount = await tenantResourcesService.countTenantDomains(env, executor);
      assertWithinDomainQuota(env, tenantCount);
    }

    let name: string;
    if (body.mode === "raw") {
      await nginxSitesService.createSiteRaw(executor, body.name, body.content, body.enabled);
      name = body.name;
    } else {
      name = await nginxSitesService.createSiteForm(executor, body.form, body.enabled);
    }
    await refreshSync(executor, CACHE_KEYS.nginx.sites.module, CACHE_KEYS.nginx.sites.collection);
    if (hosting) {
      const env = getTenantEnvelope(ctx!);
      void recordActivity({
        module: "nginx",
        action: "create_domain",
        category: "web",
        detail: `${body.mode === "form" ? body.form.domain : name} (cupo ${env.maxDomains})`,
        linuxUsername: env.owner,
      });
    }
    res.status(201).json({ ok: true, data: { name } });
  })),

  update: asyncHandler(async (req: Request, res: Response) => {
    const name = siteNameSchema.parse(req.params.name);
    const body = updateSiteSchema.parse(req.body);
    const executor = getExecutor(req);
    await assertOwnedSite(executor, name);
    assertHostingFormAllowed(body);
    if (body.mode === "raw") await nginxSitesService.writeSite(executor, name, body.content, { expectedRevision: body.expectedRevision });
    else await nginxSitesService.updateSiteForm(executor, name, body.form, body.expectedRevision);
    await refreshSync(executor, CACHE_KEYS.nginx.sites.module, CACHE_KEYS.nginx.sites.collection);
    res.json({ ok: true });
  }),

  enable: asyncHandler(async (req: Request, res: Response) => {
    const name = siteNameSchema.parse(req.params.name);
    const executor = getExecutor(req);
    await assertOwnedSite(executor, name);
    await nginxSitesService.setEnabled(executor, name, true);
    await refreshSync(executor, CACHE_KEYS.nginx.sites.module, CACHE_KEYS.nginx.sites.collection);
    res.json({ ok: true });
  }),

  disable: asyncHandler(async (req: Request, res: Response) => {
    const name = siteNameSchema.parse(req.params.name);
    const executor = getExecutor(req);
    await assertOwnedSite(executor, name);
    await nginxSitesService.setEnabled(executor, name, false);
    await refreshSync(executor, CACHE_KEYS.nginx.sites.module, CACHE_KEYS.nginx.sites.collection);
    res.json({ ok: true });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const name = siteNameSchema.parse(req.params.name);
    const executor = getExecutor(req);
    await assertOwnedSite(executor, name);
    await nginxSitesService.deleteSite(executor, name);
    await refreshSync(executor, CACHE_KEYS.nginx.sites.module, CACHE_KEYS.nginx.sites.collection);
    res.json({ ok: true });
  }),

  preview: asyncHandler(async (req: Request, res: Response) => {
    const form = previewSiteSchema.parse(req.body);
    assertHostingFormAllowed({ mode: "form", form });
    res.json({ ok: true, data: { content: nginxSitesService.generateConfig(form) } });
  }),

  /**
   * GET /api/nginx/domains — domains discovered on the target.
   * Shape matches the legacy /api/dns/domains response so the SSL and
   * Mail module pages keep working unchanged.
   *
   * Cache-first via the `nginx/sites` cache: a site's `domains[]` already
   * carries every `server_name` token. We map sites → distinct domains in
   * memory (cheap, ~hundreds of items at most). Fallback to the live
   * Apache/Caddy/Nginx scanner when the cache is unavailable.
   */
  domains: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const cached = await serveCachedDataTable<{
      name: string; domains?: string[]; root?: string | null; file?: string;
    }>({
      executor, module: CACHE_KEYS.nginx.sites.module, collection: CACHE_KEYS.nginx.sites.collection,
      liveLoader: async () => {
        // Only used when the cache is absent — keeps Apache/Caddy coverage.
        const discovered = await serverDomainsService.list(executor);
        return discovered.map((d) => ({
          name: d.name, domains: [d.name],
          root: d.documentRoot, file: d.configPath ?? undefined,
        }));
      },
    });
    // Derive distinct domains from the cached sites (or the live fallback).
    const byName = new Map<string, { documentRoot: string | null; sources: string[] }>();
    for (const site of filterOwnedSites(cached.rows)) {
      const names = Array.isArray(site.domains) && site.domains.length > 0
        ? site.domains
        : [site.name];
      for (const raw of names) {
        const n = String(raw || "").trim().toLowerCase();
        if (!n || n === "_") continue;
        const entry = byName.get(n) ?? { documentRoot: null, sources: [] };
        entry.documentRoot = entry.documentRoot ?? (site.root ?? null);
        if (site.file && !entry.sources.includes(site.file)) entry.sources.push(site.file);
        byName.set(n, entry);
      }
    }
    const data = [...byName.entries()]
      .map(([name, info]) => ({
        id: fnv1aId(name),
        name,
        type: "addon",
        parent: null,
        documentRoot: info.documentRoot,
        sources: info.sources,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ ok: true, data });
  }),

  discovered: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const domains = await serverDomainsService.list(executor);
    const visible = filterOwnedSites(domains.map((domain) => ({ ...domain, root: domain.documentRoot })))
      .map(({ root: _root, ...domain }) => domain);
    res.json({ ok: true, data: visible });
  }),

  upstreams: asyncHandler(async (req: Request, res: Response) => {
    assertNginxAdmin();
    const executor = getExecutor(req);
    res.json({ ok: true, data: await nginxSitesService.listUpstreams(executor) });
  }),
};

