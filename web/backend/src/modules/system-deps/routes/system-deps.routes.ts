// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type RequestHandler, type Router as ExpressRouter } from "express";
import { moduleParam, systemDepsController } from "../controllers/system-deps.controller.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import { isKnownDepsModule } from "../../../shared/system/module-deps.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";

const router: ExpressRouter = Router();

/**
 * `requireModule(name)` is a factory with a STATIC module name; here the
 * module comes from the URL, so we wrap it: validate the param against the
 * dependency registry first (404 on unknown — never feed arbitrary user
 * input into the entitlement checks), then delegate to the real middleware
 * so registry/entitlement/license/module-access rules apply unchanged.
 */
/**
 * Some dependency-registry ids don't match the entitlement slug used by the
 * module registry / permissions: the web-server module is entitled as `dns`
 * (legacy slug, see nginx.routes.ts) and backups as `backups`
 * (backup.routes.ts). Map them before delegating to `requireModule`.
 */
const ENTITLEMENT_SLUG: Record<string, string> = {
  nginx: "dns",
  backup: "backups",
};

const requireParamModule: RequestHandler = (req, res, next) => {
  const moduleId = moduleParam(req);
  if (!isKnownDepsModule(moduleId)) {
    res.status(404).json({ ok: false, error: ErrorCodes.UNKNOWN_MODULE });
    return;
  }
  requireModule(ENTITLEMENT_SLUG[moduleId] ?? moduleId)(req, res, next);
};

router.get(
  "/api/system-deps/:module",
  requireAuth,
  requireParamModule,
  systemDepsController.status,
);
router.post(
  "/api/system-deps/:module/install",
  requireAuth,
  requireParamModule,
  csrfProtection,
  systemDepsController.install,
);

export { router as systemDepsRouter };
