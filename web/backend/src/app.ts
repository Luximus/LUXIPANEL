// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerManagementCapabilities } from "./shared/module-operations/catalog.js";
/**
 * Express application factory.
 *
 * Creates the Express app with all global middlewares applied.
 * Module routes are registered separately via `registerModules()`.
 */

import { tableWindow } from "./shared/middleware/table-window.js";
import { responseFreshness } from "./shared/remote-cache/response-freshness.js";
import { normalizeProxyHeaders } from "./shared/middleware/trusted-proxy.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import yaml from "js-yaml";

import { env } from "./config/env.js";
import { serverConfig } from "./config/server.js";
import { APP_VERSION } from "./config/version.js";
import { INSTANCE_ID } from "./config/instance.js";
import { requestId, requestLogger, localeDetector } from "./shared/middleware/index.js";
import { errorHandler } from "./shared/errors/index.js";
import { ErrorCodes } from "./shared/errors/codes.js";
import { ONE_DAY_SECONDS, NO_CACHE_HEADER, CSRF_HEADER_NAME } from "./shared/constants.js";
import { createModuleLogger } from "./shared/logger/index.js";
import { generateSpec } from "./shared/openapi/index.js";
import type { ModuleRegistrar } from "./shared/types/index.js";
import { HEALTH_PATH } from "./shared/constants.js";
import { moduleRegistryService } from "./modules/admin/services/module-registry.service.js";
import { globalRateLimiter } from "./modules/auth/middlewares/rate-limiter.middleware.js";
import { requireAuth } from "./modules/auth/middlewares/session.middleware.js";
import { settingsRepository } from "./modules/admin/repositories/settings.repository.js";
import { getExecutor, runWithExecutor, runOnPanelHost } from "./shared/executor/index.js";
import { telemetryRouter } from "./shared/diagnostics/telemetry.routes.js";
import { brandingAssetService } from "./modules/license/branding-asset.service.js";
import { cronApprovalsPublicRouter } from "./modules/cron/routes/cron-approvals-public.routes.js";
import { webhookIngestPublicRouter } from "./modules/webhooks/routes/ingest.routes.js";
import { chatCallsPublicRouter } from "./modules/chat/routes/call-webhook.routes.js";
import { providerRouter } from "./modules/hosting/routes/provider.routes.js";
import { deploymentProviderRouter } from "./modules/hosting/routes/deployment-provider.routes.js";
import { apiErrorMessage } from "./shared/i18n/errors.js";

const log = createModuleLogger("app");

export function createApp(modules: ModuleRegistrar[] = []): express.Application {
  const app = express();
  // Single 404 body (matches the NOT_FOUND contract in shared/errors). Used by
  // the bot-probe block and the terminal fallback so they can't drift.
  const notFoundBody = (locale: unknown) => ({ ok: false, error: apiErrorMessage(locale, "notFound"), code: ErrorCodes.NOT_FOUND } as const);

  // ---- Trust proxy (behind Nginx / Docker) ----
  app.set("trust proxy", "loopback");
  app.use(normalizeProxyHeaders);

  // ---- Global middlewares ----
  app.use(requestId);
  app.use(requestLogger);

  app.use("/api/telemetry/errors", express.json({ limit: "64kb" }));
  app.use(
    helmet({
      contentSecurityPolicy: false, // CSP handled by frontend/Nginx
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(
    cors({
      origin: serverConfig.cors.origin,
      credentials: serverConfig.cors.credentials,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", CSRF_HEADER_NAME, "X-Request-Id"],
      exposedHeaders: ["X-Request-Id"],
      maxAge: ONE_DAY_SECONDS,
    }),
  );

  // NUNCA comprimir Server-Sent Events: `compression` retiene la salida gzip/br
  // hasta `flush()`, así que un cliente que anuncie `accept-encoding` (el fetch
  // del proxy Astro lo añade solo) nunca recibía ni el saludo → el EventSource
  // se quedaba en "Conectando…" (2026-08-25). Se decide por la petición
  // (Accept) y por la ruta (`/stream`), porque el Content-Type se fija después.
  app.use(
    compression({
      filter: (req, res) => {
        const accept = String(req.headers.accept ?? "").toLowerCase();
        if (accept.includes("text/event-stream")) return false;
        if (/\/stream(?:\?|$)/.test(req.originalUrl ?? req.url ?? "")) return false;
        const ct = String(res.getHeader("Content-Type") ?? "").toLowerCase();
        if (ct.includes("text/event-stream")) return false;
        return compression.filter(req, res);
      },
    }),
  );
  // 30mb so chat attachments (base64 images/PDF) fit in the agent POST body.
  // `verify` captures the exact raw bytes so signature checks (e.g. the secret
  // rotation HMAC webhook) validate against what was received on the wire, not
  // a V8 re-serialization of the parsed object.
  app.use(
    express.json({
      limit: "30mb",
      verify: (req, _res, buf) => {
        if (buf && buf.length) {
          (req as unknown as { rawBody?: string }).rawBody = buf.toString("utf8");
        }
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: "30mb" }));
  app.use(cookieParser());
  app.use(localeDetector);
  app.use(telemetryRouter);

  // ---- Anti-indexing headers (global) ----
  app.use((_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex");
    next();
  });

  // ---- Block known bot probe paths before auth/modules ----
  app.use((req, res, next) => {
    if (req.path === "/manager" || req.path.startsWith("/manager/")) {
      res.setHeader("Cache-Control", "no-store");
      res.status(404).json(notFoundBody(res.locals.locale));
      return;
    }
    next();
  });

  // ---- Disable browser/proxy caching for API responses ----
  // The frontend assets are versioned separately; API responses should always revalidate.
  app.use((req, res, next) => {
    if (env.DISABLE_HTTP_CACHE && req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", NO_CACHE_HEADER);
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
    next();
  });

  // ---- Global rate limiting (shared Redis store, authenticated ingress IP) ----
  app.use(globalRateLimiter);
  app.use(responseFreshness);
  app.use(tableWindow);

  // ---- OpenAPI / Swagger UI (development only) ----
  if (serverConfig.isDev) {
    const spec = generateSpec({ serverUrl: `http://localhost:${serverConfig.port}` });

    // Swagger UI at /api/docs
    app.use(
      "/api/docs",
      swaggerUi.serve,
      swaggerUi.setup(spec, {
        customSiteTitle: "LUXIPANEL API Docs",
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          filter: true,
          tryItOutEnabled: true,
        },
      }),
    );

    // Raw JSON spec
    app.get("/api/docs/openapi.json", (_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.json(spec);
    });

    // Raw YAML spec
    app.get("/api/docs/openapi.yaml", (_req, res) => {
      res.setHeader("Content-Type", "text/yaml; charset=utf-8");
      res.send(yaml.dump(spec, { lineWidth: 120 }));
    });

    log.info("Swagger UI available at /api/docs");
  }

  // ---- Health check (no auth required) ----
  app.get(HEALTH_PATH, (_req, res) => {
    res.json({
      ok: true,
      service: "luxipanel",
      version: APP_VERSION,
      // Identidad de ESTE proceso. La usa la sonda de co-localización
      // (`cross-channel-origin.ts`): si un target hace curl a su propio
      // 127.0.0.1:<PORT>/api/health y recibe este mismo id, es que el backend
      // corre en esa misma máquina → el canal MCP del agente puede ir por
      // loopback en vez de dar la vuelta por el dominio público.
      instanceId: INSTANCE_ID,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  });

  // ---- Public API routes (no auth required) ----

  // Human-approval pages for cron AI-agent runs (capability-token URLs from
  // report emails). Mounted here so no module-level global requireAuth can
  // intercept them.
  app.use(cronApprovalsPublicRouter);

  // Live ingest endpoint for receive-data gateway webhooks. Public by design:
  // the gateway authenticates inbound calls with its own api-key + IP rules.
  // Mounted here (before module routers) so no global `requireAuth` shadows it.
  app.use(webhookIngestPublicRouter);

  // Tolqia call webhooks (F3). Public by design: authenticated by an HMAC over
  // the raw body, not by a session. Mounted here for the same reason as the two
  // routers above — a module router's pathless `requireAuth` would 401 it.
  app.use(chatCallsPublicRouter);

  // HOSTING's machine Bearer API must precede module routers with pathless
  // session gates. Its administrative paths enforce admin session and CSRF.
  app.use(providerRouter);
  app.use(deploymentProviderRouter);

  //
  // No Redis cache here: module enable/disable is user-mutable and we want
  // the sidebar to reflect toggles immediately. The handler itself is cheap
  // (settings lookup + in-memory catalog), so per-request reads are fine.
  app.get("/api/modules/installed", requireAuth, async (req, res) => {
    // The authenticated request resolves the server selected in this tab.
    const modules = await runWithExecutor(getExecutor(req), async () => {
      const enabledMap = await moduleRegistryService.getEnabledMap();
      const order = await moduleRegistryService.getOrder();
      const displayMap = await moduleRegistryService.getDisplayMap();
      const byId = new Map(moduleRegistryService.getAll().map((m) => [m.id, m] as const));
      const enabled = order
        .map((id) => byId.get(id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m && enabledMap[m.id]));
      // Self-hosted: no LP entitlement gate — every enabled module is usable
      // and none is in the LP-only 'development' state.
      return enabled.map((m) => ({
        id: m.id,
        name: m.name,
        enabled: true,
        development: false,
        // Flags de display por módulo — el sidebar los consulta para decidir
        // si renderiza el link y los FABs para decidir si se muestran.
        showInSidebar: displayMap[m.id]?.showInSidebar ?? false,
        showFloatingButton: displayMap[m.id]?.showFloatingButton ?? false,
        supportsFloatingButton: Boolean(m.supportsFloatingButton),
      }));
    });
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, data: modules });
  });

  // Public branding endpoint consumed by /login SSR. Self-hosted: branding
  // lives in the panel's own local settings sidecar; always report the (single)
  // host as a matched, configured panel so /login renders the form.
  app.get("/api/public/layout", async (_req, res) => {
    res.set("Cache-Control", NO_CACHE_HEADER);
    const rows = await runOnPanelHost(() => settingsRepository.getByCategory("layout"));
    const data = rows.reduce<Record<string, string>>((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    // Single-logo model: the favicon falls back to the same URL as the logo.
    if (!data.layout_favicon) {
      data.layout_favicon =
        data.layout_logo ||
        data.layout_logo_primary ||
        data.layout_logo_login ||
        data.layout_logo_sidebar ||
        data.layout_logo_footer ||
        "";
    }
    res.json({ ok: true, matched: true, configured: true, source: "local", data });
  });

  // ---- Branding asset proxy ----
  // External logo URLs (returned by LP-LS) are rewritten to /api/branding/asset/<hash>.
  // This endpoint serves the cached bytes from Redis so the browser doesn't hit
  // the customer's CDN on every login page view.
  app.get("/api/branding/asset/:hash", async (req, res) => {
    const hash = String(req.params.hash ?? "");
    const asset = await brandingAssetService.serve(hash);
    if (!asset) {
      res.status(404).json(notFoundBody(res.locals.locale));
      return;
    }
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    res.set("Content-Type", asset.mime);
    res.set("Content-Length", String(asset.bytes.length));
    res.end(asset.bytes);
  });

  // NOTE: `/api/files/allowed-bases` is intentionally NOT registered here.
  // It is served by the authenticated files module router
  // (browserController.allowedBases) so the response is PER-USER (allowAll +
  // allowPaths + defaultPath) instead of a globally-cached static base list.
  // A public, statically-cached route here would shadow it and break the
  // per-group default-path / allowed-paths behaviour.

  // NOTE: `GET /api/files/tree` is intentionally NOT registered here.
  // The previous anonymous version read the PANEL HOST filesystem
  // (filesystemService.listDir, ALLOWED_BASES=["/"]) with no auth — a full
  // host disclosure. It is now served by the authenticated files module router
  // (browserController.tree) so the listing is PER-SERVER (via the request's
  // Executor) and gated by requireAuth + the files view/path permissions.

  // ---- Register modules ----
  for (const register of modules) {
    register(app);
  }
  registerManagementCapabilities();

  log.info(`Registered ${modules.length} modules`);

  // ---- 404 fallback ----
  app.use((_req, res) => {
    res.status(404).json(notFoundBody(res.locals.locale));
  });

  // ---- Centralized error handler (must be last) ----
  app.use(errorHandler);

  return app;
}
