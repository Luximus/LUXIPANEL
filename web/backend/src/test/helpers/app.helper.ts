// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Integration test helper — creates a lightweight Express app instance
 * without real DB/Redis connections.
 *
 * Usage:
 *   const { app, getToken } = createTestApp();
 *   const res = await request(app).get("/api/health");
 */

import express, { type Express } from "express";
import { vi } from "vitest";
// These API fixtures stub the external identity server, just as they stub
// SSH and repositories. Live identity changes are covered by their own tests.
vi.mock("../../modules/auth/services/live-authorization.service.js", () => ({ resolveLiveAuthorization: async (user: unknown) => user }));
import cookieParser from "cookie-parser";
import { errorHandler } from "../../shared/errors/index.js";
import { requestId } from "../../shared/middleware/index.js";
import type { ModuleRegistrar } from "../../shared/types/index.js";
import { HEALTH_PATH } from "../../shared/constants.js";

/**
 * Build a minimal Express app with only the essential middleware.
 * Rate limiting and Pino HTTP logger are omitted for test speed.
 */
export function buildTestApp(modules: ModuleRegistrar[] = []): Express {
  const app = express();
  const noCacheHeader = "no-store, no-cache, must-revalidate, max-age=0";

  app.set("trust proxy", 1);
  app.use(requestId);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use((req, res, next) => {
    const disableHttpCache = process.env.DISABLE_HTTP_CACHE
      ? !["false", "0"].includes(process.env.DISABLE_HTTP_CACHE.toLowerCase())
      : true;

    if (disableHttpCache && req.path.startsWith("/api/")) {
      res.set("Cache-Control", noCacheHeader);
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
    }
    next();
  });

  // Health check
  app.get(HEALTH_PATH, (_req, res) => {
    res.json({ ok: true, service: "luxipanel", version: "2.0.0" });
  });

  for (const register of modules) {
    register(app);
  }

  // 404
  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: "Not found", code: "NOT_FOUND" });
  });

  app.use(errorHandler);

  return app;
}

/**
 * Parse cookies from a supertest response header.
 * Returns a cookie string suitable for use in subsequent requests.
 */
export function parseCookies(headers: Record<string, string | string[]>): string {
  const raw = headers["set-cookie"];
  if (!raw) return "";
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .map((c) => c.split(";")[0]!)
    .join("; ");
}

/**
 * Extract a specific cookie value by name from set-cookie headers.
 */
export function getCookieValue(
  headers: Record<string, string | string[]>,
  name: string,
): string | null {
  const raw = headers["set-cookie"];
  if (!raw) return null;
  const arr = Array.isArray(raw) ? raw : [raw];
  for (const cookie of arr) {
    const [kv] = cookie.split(";");
    if (kv?.startsWith(`${name}=`)) {
      return kv.slice(name.length + 1);
    }
  }
  return null;
}
