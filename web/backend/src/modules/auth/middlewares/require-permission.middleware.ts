// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { runWithPermissionAction } from "../../../shared/executor/context.js";
import { bindOperationPermission } from "../../../shared/module-operations/permissions.js";
import type { RequestHandler } from "express";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { hasActionPermission, hasViewPermission } from "../services/role-permissions.service.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { actionForHttp, actionRequiresAdmin } from "../../../shared/auth/module-actions.js";

const log = createModuleLogger("perm-mw");

export function requireActionPermission(action: string): RequestHandler {
  return bindOperationPermission(action, (req, res, next) => {
    const user = res.locals.user;
    if (!user) {
      next(new ForbiddenError("Authentication required"));
      return;
    }
    if (!hasActionPermission(user, action)) {
      log.warn({ url: req.originalUrl, action, username: user.username, kind: user.kind, actions: user.permissions?.actions }, "DENY action");
      next(new ForbiddenError(`Missing permission: ${action}`));
      return;
    }
    runWithPermissionAction(action, next);
  });
}

export function requireViewPermission(viewId: string): RequestHandler {
  return (req, res, next) => {
    const user = res.locals.user;
    if (!user) {
      next(new ForbiddenError("Authentication required"));
      return;
    }
    if (!hasViewPermission(user, viewId)) {
      log.warn({ url: req.originalUrl, viewId, username: user.username, kind: user.kind, views: user.permissions?.views }, "DENY view");
      next(new ForbiddenError(`Missing permission: ${viewId}`));
      return;
    }
    const module = viewId.replace(/^panel\./, "");
    const action = actionForHttp(module, req.method, req.originalUrl);
    if (["notifications", "search", "server-switcher"].includes(module) && user.kind !== "admin" && action &&
        (actionRequiresAdmin(action) || !hasActionPermission(user, action))) {
      next(new ForbiddenError(`Missing permission: ${action}`)); return;
    }
    next();
  };
}
