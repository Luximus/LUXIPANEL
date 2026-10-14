// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Module access middleware — checks if the authenticated user
 * has access to a specific module AND has a valid license.
 *
 * All modules require valid license to access.
 * In development mode without a license key, the license check is bypassed.
 */

import type { RequestHandler } from "express";
import { ForbiddenError, NotFoundError } from "../../../shared/errors/index.js";
import { moduleRegistryService } from "../../admin/services/module-registry.service.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { canUseModule } from "../services/role-permissions.service.js";
import { hasActionPermission, getRolePermissionsCatalog } from "../services/role-permissions.service.js";
import { runWithPermissionAction } from "../../../shared/executor/context.js";
import { actionForHttp, actionRequiresAdmin } from "../../../shared/auth/module-actions.js";

const log = createModuleLogger("module-mw");

/**
 * Factory: creates middleware that requires the user to have
 * access to the given module AND a valid license.
 *
 * All modules require license — no free/premium distinction.
 * Development mode bypass: if NODE_ENV=development and no LICENSE_KEY,
 * the license check is skipped.
 *
 * Usage: `router.use(requireModule("mail"))`
 */
export function requireModule(module: string): RequestHandler {
  return async (req, res, next) => {
    const user = res.locals.user;
    if (!user) {
      next(new ForbiddenError("Authentication required"));
      return;
    }

    // "admin" is a privilege level, not a catalog module. Routes that
    // pass requireModule("admin") really mean "user must be admin" —
    // that's checked against the JWT's `kind` field, not the optional-
    // modules registry.
    if (module === "admin") {
      if (user.kind === "admin") {
        next();
        return;
      }
      next(new ForbiddenError("Admin privileges required"));
      return;
    }

    // requireAuth has already pinned the selected server and authenticated
    // user. Keep that context when reading the server's module activation.
    const enabled = await moduleRegistryService.isEnabled(module);
    if (!enabled) {
      log.warn({ url: req.originalUrl, module, username: user.username }, "DENY module: not enabled in registry");
      next(new NotFoundError("Module"));
      return;
    }

    // Self-hosted: no per-panel LP entitlement/billing gate and no LP-role
    // 'development' gate — enablement is the local module registry only.

    // Admin always has access to all enabled modules
    if (user.kind === "admin") {
      next();
      return;
    }

    // Non-admins: check if user has module access
    if (!canUseModule(user, module)) {
      log.warn({ url: req.originalUrl, module, username: user.username, modules: user.modules }, "DENY module: not in user.modules");
      next(new ForbiddenError(`Access to module "${module}" denied`));
      return;
    }

    const action = actionForHttp(module, req.method ?? "GET", req.originalUrl ?? "/");
    if (action && (actionRequiresAdmin(action) || getRolePermissionsCatalog().actionMetadata[action]?.adminOnly || !hasActionPermission(user, action))) {
      next(new ForbiddenError(`Missing permission: ${action}`));
      return;
    }

    if (action) runWithPermissionAction(action, () => next());
    else next();
  };
}
