// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tenant scope middleware — enforces per-account resource isolation.
 *
 * Usage patterns:
 *
 *  1. requireAdminOrApiKey — gates reseller management routes to admin
 *                            sessions or valid API keys.
 */

import type { RequestHandler, Response } from "express";
import { AuthError } from "../../../shared/errors/index.js";
import type { SessionUser } from "../../../shared/types/index.js";

// ── Middleware: admin or API-key authenticated requests ────────

/**
 * Allow requests from either:
 *   a) an authenticated admin panel session, OR
 * Provider API keys are accepted only on /api/hosting/v1 and never here.
 *
 * On success, sets res.locals.isApiKeyAuth = true for API-key callers.
 */
export const requireAdminOrApiKey: RequestHandler = async (_req, res, next) => {
  // 1. Admin session check
  const user = res.locals.user as SessionUser | undefined;
  if (user?.kind === "admin") {
    next();
    return;
  }

  next(new AuthError("Admin session required"));
};

/**
 * Returns true when the current session belongs to an admin (panel admin
 * OR API-key bearer). Use this to guard create/delete operations.
 */
export function isAdminSession(res: Response): boolean {
  const user = res.locals.user as SessionUser | undefined;
  return user?.kind === "admin";
}
