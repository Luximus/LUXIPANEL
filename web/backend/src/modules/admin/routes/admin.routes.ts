import { requirePanelAdministrator } from "../../auth/middlewares/panel-administrator.middleware.js";
import { liveDataController } from "../controllers/live-data.controller.js";
import { uiStatus } from "../services/ui-events.service.js";
import { loadUiBootstrap } from "../services/ui-bootstrap.service.js";
import { getExecutor as bootstrapExecutor } from "../../../shared/executor/index.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import express, { Router, type Router as ExpressRouter } from "express";
import { connectorStatus } from "../controllers/connector-status.controller.js";
import { settingsController } from "../controllers/settings.controller.js";
import { cacheModulesController } from "../controllers/cache-modules.controller.js";
import { toolsController } from "../controllers/tools.controller.js";
import { logsController } from "../controllers/logs.controller.js";
import { systemController } from "../controllers/system.controller.js";
import { syncController } from "../controllers/sync.controller.js";
import { modulesController } from "../controllers/modules.controller.js";
import { brandingController } from "../controllers/branding.controller.js";
import { layoutController } from "../controllers/layout.controller.js";
import { repositoryStoreController } from "../controllers/repository-store.controller.js";
import { releasesController } from "../controllers/releases.controller.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import { requireActionPermission, requireViewPermission } from "../../auth/middlewares/require-permission.middleware.js";
import { requireLpApiKey } from "../../../shared/lp-api-key.js";
import { installationApiKeyController } from "../controllers/installation-api-key.controller.js";

const router: ExpressRouter = Router();

// Scope the admin gate to THIS router's own path prefixes. The router is
// mounted at "/api", so an unscoped `router.use(requireModule("admin"))` would
// run for EVERY /api/* request that enters it and reject non-admins BEFORE the
// request can fall through to its real module router (the cause of blanket
// "Admin privileges required" 403s for non-admin logins). Scoping confines the
// gate to /api/settings* and /api/admin*.
// Sidebar server-switcher behavior (open switched server in a new tab vs the
// same tab). Read by ALL authenticated users (the switcher is not admin-only),
// so it is registered BEFORE the admin gate with its own requireAuth and a path
// that does NOT match the gated /settings|/admin prefixes. Read-only; the value
// is WRITTEN through the admin-gated /settings/bulk autosave (General tab).
router.get("/ui/switch-server-behavior", requireAuth, settingsController.switchServerBehavior);
router.get("/ui/bootstrap", requireAuth, async (req, res, next) => {
  try {
    const bridge = res.locals.bridgedSession as {direct?:boolean;remoteUserId?:number} | undefined;
    const user = {...res.locals.user,...(bridge?.direct ? {direct:true} : {}),...(bridge?.remoteUserId !== undefined ? {remoteUserId:bridge.remoteUserId} : {})};
    res.set("Cache-Control", "no-store");
    res.json({ok:true,data:await loadUiBootstrap(user, bootstrapExecutor(req))});
  }
  catch (error) { next(error); }
});
router.get("/ui/status", requireAuth, async (req, res, next) => {
  try { res.set("Cache-Control", "no-store"); res.json({ok:true,data:await uiStatus(res.locals.user, bootstrapExecutor(req))}); }
  catch (error) { next(error); }
});
router.get("/ui/data/capabilities", requireAuth, liveDataController.capabilities);
router.post("/ui/data/refresh", requireAuth, csrfProtection, liveDataController.refresh);
router.get("/ui/layout", requireAuth, layoutController.read);
router.get("/ui/layout/asset", requireAuth, layoutController.asset);
router.get("/ui/releases", requireAuth, releasesController.status);
router.get("/ui/releases/:tag/details", requireAuth, releasesController.details);
router.post("/ui/releases/:tag/translate", requireAuth, requireModule("assistant"), csrfProtection, releasesController.translate);
router.get("/admin/system/releases/preflight", requireAuth, requirePanelAdministrator, releasesController.preflight);
router.post("/admin/system/releases/install", requireAuth, requirePanelAdministrator, csrfProtection, releasesController.install);

// GitHub catalog is its own module. File operations additionally require the
// Files/Git permissions; token editing remains under the admin gate below.
router.use("/repository-store", requireAuth, requireModule("repository-store"), requireViewPermission("panel.repository-store"));
router.get("/repository-store/state", repositoryStoreController.getState);
router.get("/repository-store/config", repositoryStoreController.getConfig);
router.patch("/repository-store/preferences", csrfProtection, repositoryStoreController.patchPreferences);
router.post("/repository-store/saved", csrfProtection, repositoryStoreController.changeSaved);
router.get("/repository-store/search", repositoryStoreController.search);
router.get("/repository-store/readme", repositoryStoreController.getReadme);
router.get("/repository-store/repos/:owner/:name", repositoryStoreController.getRepo);
const gitGate = [requireModule("files"), requireViewPermission("panel.files"), requireActionPermission("files.git")];
router.post("/repository-store/clones", ...gitGate, csrfProtection, repositoryStoreController.clone);
router.post("/repository-store/clones/link", ...gitGate, csrfProtection, repositoryStoreController.linkClone);
router.delete("/repository-store/clones/:id", ...gitGate, csrfProtection, repositoryStoreController.unlinkClone);
router.post("/repository-store/clones/:id/check", ...gitGate, csrfProtection, repositoryStoreController.checkClone);
router.post("/repository-store/clones/:id/update", ...gitGate, requireLpApiKey, csrfProtection, repositoryStoreController.updateClone);

router.use(["/settings", "/admin"], requireAuth, requireModule("admin"));

router.get("/admin/installation-api-key", installationApiKeyController.status);
router.put("/admin/installation-api-key", csrfProtection, installationApiKeyController.save);

router.put("/admin/cache-modules/live-data", csrfProtection, liveDataController.configure);

// ---- Settings ----
router.get("/settings", settingsController.list);
router.get("/settings/connector-status", connectorStatus);
router.get("/settings/:category", settingsController.listByCategory);
router.put("/settings", csrfProtection, settingsController.set);
router.put("/settings/bulk", csrfProtection, settingsController.setBulk);
router.post("/settings/reset", csrfProtection, settingsController.reset);
router.delete("/settings/:key", csrfProtection, settingsController.remove);

// ---- Ajustes → Módulos (per-target cache-engine schedule + cost panel) ----
router.get("/admin/cache-modules", cacheModulesController.list);
router.get("/admin/cache-modules/health", cacheModulesController.health);
router.put(
  "/admin/cache-modules/:module/:collection",
  csrfProtection,
  cacheModulesController.update,
);

// ---- Tools ----
router.post("/admin/tools/rebuild-maps", csrfProtection, toolsController.rebuildMaps);
router.post("/admin/tools/restart-service", csrfProtection, toolsController.restartService);
router.get("/admin/tools/audit-log", toolsController.auditLog);
router.get("/admin/tools/dns-check/:domain", toolsController.dnsCheck);

// ---- Logs (journalctl) ----
router.get("/admin/logs", logsController.listServices);
router.get("/admin/logs/kernel", logsController.getKernelLogs);
router.get("/admin/logs/:service", logsController.getServiceLogs);

// ---- System info + health ----
router.get("/admin/system/info", systemController.info);
router.get("/admin/system/health", systemController.health);
router.get("/admin/system/env", systemController.env);
router.get("/admin/system/timezone", systemController.getTimezone);
router.put("/admin/system/timezone", csrfProtection, systemController.setTimezone);


// ---- Sync operations ----
router.post("/admin/sync/dovecot", csrfProtection, syncController.syncDovecot);
router.post("/admin/sync/postfix", csrfProtection, syncController.syncPostfix);
router.post("/admin/sync/sieve", csrfProtection, syncController.syncSieve);
router.post("/admin/sync/all", csrfProtection, syncController.syncAll);


// ---- Branding (logos / images for layout) ----
router.get("/admin/branding/images", brandingController.listImages);
router.get("/admin/branding/asset", brandingController.asset);
router.post(
  "/admin/branding/upload",
  csrfProtection,
  // 5 MB — see BRANDING_UPLOAD_MAX_BYTES in shared/constants.ts
  express.raw({ type: ["application/octet-stream", "image/*"], limit: "5mb" }),
  brandingController.upload,
);

// ---- Optional modules (visibility toggle + ordering) ----
router.get("/admin/modules", modulesController.list);
router.put("/admin/modules/order", csrfProtection, modulesController.reorder);
router.patch("/admin/modules/:id", csrfProtection, modulesController.update);

// ---- Repository store (GitHub catalog proxy + token mgmt) ----
router.get("/admin/repository-store/config", repositoryStoreController.getConfig);
router.put("/admin/repository-store/config", csrfProtection, repositoryStoreController.setConfig);
router.delete("/admin/repository-store/config", csrfProtection, repositoryStoreController.clearConfig);
router.get("/admin/repository-store/search", repositoryStoreController.search);
router.get("/admin/repository-store/readme", repositoryStoreController.getReadme);

export { router as adminRouter };
