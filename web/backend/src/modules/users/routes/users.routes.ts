import { getExecutorAsync } from "../../../shared/executor/factory.js";
import { PrivilegeDropExecutor } from "../../../shared/executor/privilege-drop-executor.js";
import { runWithExecutor } from "../../../shared/executor/context.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Users routes.
 */

import { Router, type Router as ExpressRouter } from "express";
import { usersController } from "../controllers/users.controller.js";
import { rolesController } from "../controllers/roles.controller.js";
import { preferencesController } from "../controllers/preferences.controller.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import { requireActionPermission, requireViewPermission } from "../../auth/middlewares/require-permission.middleware.js";
import type { RequestHandler } from "express";
import { isHostingSession } from "../../../shared/tenant/tenant-scope.js";

const router: ExpressRouter = Router();

// Mounted at root; unrelated modules establish their own identity context.
router.use(["/api/users", "/api/roles", "/api/preferences"], requireAuth);

/**
 * Fase 3 gate for /api/users + /api/roles: admin as before, OR a hosting tenant
 * session that the reseller granted the "users" module (the per-route
 * requireView/requireAction checks then enforce the granular envelope from the
 * hosting token's `permissions`). For any other session this delegates to the
 * legacy `requireModule("admin")` so admin/normal behaviour is byte-identical.
 */
const requireUsersAccess: RequestHandler = (req, res, next) => {
  const user = res.locals.user;
  if (isHostingSession(user) && user.modules.includes("users")) {
    void getExecutorAsync(req).then(executor => {
      const service = executor instanceof PrivilegeDropExecutor ? executor.trustedServiceExecutorFor(user.owner ?? "") : null;
      if (!service) throw new ForbiddenError("Tenant identity service unavailable");
      res.locals.tenantControlExecutor = service;
      runWithExecutor(service, next, user.userId, user);
    }).catch(next);
    return;
  }
  return requireModule("admin")(req, res, next);
};

// ---- Preferences (any authenticated user, no module restriction) ----
router.get("/api/preferences", preferencesController.get);
router.get("/api/preferences/ui", preferencesController.getUiPreferences);
router.get("/api/preferences/chat", preferencesController.getChatPreferences);
router.get("/api/preferences/audit-log", preferencesController.auditLog);
router.put("/api/preferences", csrfProtection, preferencesController.update);
router.put("/api/preferences/password", csrfProtection, preferencesController.changePassword);
router.put("/api/preferences/ui", csrfProtection, preferencesController.updateUiPreferences);
router.put("/api/preferences/chat", csrfProtection, preferencesController.updateChatPreferences);

// ---- Admin-only: require admin privileges (scoped to avoid intercepting other routers) ----
router.use(["/api/users", "/api/roles"], requireUsersAccess);

// ---- Users CRUD ----
router.get("/api/users", requireViewPermission("panel.users"), requireActionPermission("users.view"), usersController.list);
router.get("/api/users/sessions", requireViewPermission("panel.users"), requireActionPermission("users.view"), usersController.sessions);
router.post("/api/users", requireViewPermission("panel.users"), requireActionPermission("users.create"), csrfProtection, usersController.create);
router.put("/api/users/:id", requireViewPermission("panel.users"), requireActionPermission("users.edit"), csrfProtection, usersController.update);
router.delete("/api/users/:id", requireViewPermission("panel.users"), requireActionPermission("users.delete"), csrfProtection, usersController.remove);
router.put("/api/users/:id/password", requireViewPermission("panel.users"), requireActionPermission("users.edit"), csrfProtection, usersController.changePassword);

// ---- Per-user SSH authorized_keys (managing keys is an edit-level action) ----
router.post("/api/users/:id/login-key", requireViewPermission("panel.users"), requireActionPermission("users.edit"), csrfProtection, usersController.generateLoginKey);
router.get("/api/users/:id/ssh-keys", requireViewPermission("panel.users"), requireActionPermission("users.edit"), usersController.listSshKeys);
router.post("/api/users/:id/ssh-keys", requireViewPermission("panel.users"), requireActionPermission("users.edit"), csrfProtection, usersController.addSshKey);
router.delete("/api/users/:id/ssh-keys", requireViewPermission("panel.users"), requireActionPermission("users.edit"), csrfProtection, usersController.removeSshKey);

// ---- Groups CRUD (real Linux groups + optional permission record), keyed by name ----
router.get("/api/roles", requireViewPermission("panel.users"), requireActionPermission("roles.view"), rolesController.list);
router.get("/api/roles/permission-catalog", requireViewPermission("panel.users"), requireActionPermission("roles.view"), rolesController.catalog);
router.post("/api/roles", requireViewPermission("panel.users"), requireActionPermission("roles.create"), csrfProtection, rolesController.create);
router.put("/api/roles/:name", requireViewPermission("panel.users"), requireActionPermission("roles.edit"), csrfProtection, rolesController.update);
router.delete("/api/roles/:name", requireViewPermission("panel.users"), requireActionPermission("roles.delete"), csrfProtection, rolesController.remove);

export { router as usersRouter };
