// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Hosting routes — mounts the reseller management API and hosting auth.
 *
 * Administrative API (admin browser session):
 *   POST   /api/hosting/accounts
 *   GET    /api/hosting/accounts
 *   GET    /api/hosting/accounts/:id
 *   PUT    /api/hosting/accounts/:id
 *   DELETE /api/hosting/accounts/:id
 *   POST   /api/hosting/accounts/:id/suspend
 *   POST   /api/hosting/accounts/:id/unsuspend
 *   POST   /api/hosting/accounts/:id/change-password
 *   GET    /api/hosting/accounts/:id/stats
 *
 * Public auth:
 *   POST   /api/hosting/auth/login
 *   POST   /api/hosting/auth/logout
 */

import { Router, type Router as ExpressRouter, type RequestHandler } from "express";
import { optionalAuth } from "../../auth/index.js";
import { requireAuthNoExecutor } from "../../auth/middlewares/session.middleware.js";
import { sessionController } from "../../auth/controllers/session.controller.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireAdminOrApiKey } from "../middlewares/tenant-scope.middleware.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { hostingTemplateService } from "../services/hosting-template.service.js";
import { hostingService } from "../services/hosting.service.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { hostingController } from "../controllers/hosting.controller.js";

export const hostingRouter: ExpressRouter = Router();

/**
 * Administrative mutations require CSRF. The provider Bearer API has a
 * separate router; generic Webhooks keys do not authorize these routes.
 */
const csrfUnlessApiKey: RequestHandler = (req, res, next) => {
  if ((res.locals as Record<string, unknown>)["isApiKeyAuth"]) {
    next();
    return;
  }
  return csrfProtection(req, res, next);
};

// ── Hosting account authentication (public) ────────────────────
hostingRouter.post("/api/hosting/auth/login",  hostingController.login);
hostingRouter.post("/api/hosting/auth/logout", requireAuthNoExecutor, sessionController.logout);

// ── Self-service reads (admin OR the owning hosting session) ───
// Registered BEFORE the blanket requireAdminOrApiKey gate below, because that
// gate rejects hosting sessions. These handlers do their OWN scope-check
// (assertCanReadAccount): admin sees any account; a hosting session sees only
// its own account.id. optionalAuth still pins the per-server executor + session.
hostingRouter.get("/api/hosting/accounts/:id/audit", optionalAuth, hostingController.audit);
hostingRouter.get("/api/hosting/accounts/:id/stats", optionalAuth, hostingController.stats);

// ── Administrative hosting management API ─────────────────────
hostingRouter.use("/api/hosting/defaults", optionalAuth, requireAdminOrApiKey);
hostingRouter.get("/api/hosting/defaults", hostingController.getDefaults);
hostingRouter.put("/api/hosting/defaults", csrfUnlessApiKey, hostingController.saveDefaults);
// optionalAuth resolves the selected server for the admin session.
hostingRouter.use("/api/hosting/accounts", optionalAuth, requireAdminOrApiKey);

hostingRouter.get("/api/hosting/accounts",                    hostingController.list);
hostingRouter.post("/api/hosting/accounts",                   csrfUnlessApiKey, hostingController.create);
hostingRouter.get("/api/hosting/accounts/:id",                hostingController.getOne);
hostingRouter.put("/api/hosting/accounts/:id",                csrfUnlessApiKey, hostingController.update);
hostingRouter.delete("/api/hosting/accounts/:id",             csrfUnlessApiKey, hostingController.terminate);
hostingRouter.post("/api/hosting/accounts/:id/suspend",       csrfUnlessApiKey, hostingController.suspend);
hostingRouter.post("/api/hosting/accounts/:id/unsuspend",     csrfUnlessApiKey, hostingController.unsuspend);
hostingRouter.post("/api/hosting/accounts/:id/change-password", csrfUnlessApiKey, hostingController.changePassword);

hostingRouter.post("/api/hosting/accounts/:id/reconcile", csrfUnlessApiKey, asyncHandler(async (req, res) => {
  const executor = getExecutor(req), account = await hostingService.findById(Number(req.params.id), executor);
  if (!account.templateId) throw new ValidationError("Hosting account has no reusable plan");
  await hostingTemplateService.reconcile(executor, account);
  res.json({ ok: true, data: await hostingService.findById(account.id, executor) });
}));
