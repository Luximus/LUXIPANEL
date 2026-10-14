/**
 * Rutas del módulo module-dev. Contrato §2 del flujo marketplace:
 * requireAuth + requireModule("module-dev") + admin-only (v1) en TODAS.
 */

import { Router, type RequestHandler, type Router as ExpressRouter } from "express";
import { moduleDevController } from "../controllers/index.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { logsController } from "../controllers/logs.controller.js";
import { requirePanelAdministrator } from "../../auth/middlewares/panel-administrator.middleware.js";
import { requireLpApiKey } from "../../../shared/lp-api-key.js";

/** v1: el ciclo de dev se opera con la identidad del customer dueño del panel. */
const requireAdmin: RequestHandler = (_req, res, next) => {
  const user = res.locals.user as { kind?: string } | undefined;
  if (user?.kind === "admin") {
    next();
    return;
  }
  next(new ForbiddenError("Solo administradores pueden gestionar módulos del marketplace (v1)"));
};

const router: ExpressRouter = Router();
router.get("/api/ui/community", requireAuth, logsController.community);
router.post("/api/ui/community/:id/read", requireAuth, csrfProtection, logsController.communityRead);

router.use("/api/module-dev", requireAuth);
router.use("/api/module-dev/logs", requirePanelAdministrator);

router.get("/api/module-dev/logs", logsController.list);
router.get("/api/module-dev/logs/status", logsController.status);
router.get("/api/module-dev/logs/config", logsController.config);
router.put("/api/module-dev/logs/config", csrfProtection, logsController.saveConfig);
router.get("/api/module-dev/logs/incidents/:id", logsController.detail);
router.post("/api/module-dev/logs/incidents/:id/report", csrfProtection, logsController.report);
router.get("/api/module-dev/logs/repairs", logsController.jobs);
router.post("/api/module-dev/logs/repairs", csrfProtection, logsController.create);
router.get("/api/module-dev/logs/repairs/:id", logsController.job);
router.post("/api/module-dev/logs/repairs/:id/cancel", csrfProtection, logsController.cancel);
router.post("/api/module-dev/logs/repairs/:id/retry", csrfProtection, logsController.retry);
router.post("/api/module-dev/logs/repairs/:id/approval", csrfProtection, logsController.approve);

router.use("/api/module-dev", requireModule("module-dev"), requireAdmin, requireLpApiKey);

// ── Explorador de solo lectura del checkout de esta instalación ──
router.get("/api/module-dev/project/tree", moduleDevController.listProjectFiles);
router.get("/api/module-dev/project/search", moduleDevController.searchProjectFiles);
router.get("/api/module-dev/project/file", moduleDevController.readProjectFile);
router.post("/api/module-dev/project/refresh", csrfProtection, moduleDevController.refreshProjectFiles);

// ── Ciclo de vida contra LP ──
router.get("/api/module-dev/modules", moduleDevController.listModules);
router.get("/api/module-dev/modules/:code/reviews", moduleDevController.getReviews);
router.post("/api/module-dev/modules/submit", csrfProtection, moduleDevController.submit);
router.post("/api/module-dev/modules/:code/resubmit", csrfProtection, moduleDevController.resubmit);
router.post("/api/module-dev/modules/:code/unpublish", csrfProtection, moduleDevController.unpublish);
router.post("/api/module-dev/modules/:code/republish", csrfProtection, moduleDevController.republish);

// ── Validación y pruebas ──
router.post("/api/module-dev/manifest/validate", csrfProtection, moduleDevController.validateManifest);
router.post("/api/module-dev/checks/run", csrfProtection, moduleDevController.runChecks);
router.post("/api/module-dev/tests/run", csrfProtection, moduleDevController.runTests);

// ── Vínculos proyecto↔módulo ──
router.get("/api/module-dev/links", moduleDevController.listLinks);

// ── Preview Modo B ──
router.get("/api/module-dev/preview", moduleDevController.listPreviews);
router.post("/api/module-dev/preview/install", csrfProtection, moduleDevController.previewInstall);
router.post("/api/module-dev/preview/uninstall", csrfProtection, moduleDevController.previewUninstall);
router.post(
  "/api/module-dev/preview/:moduleId/tool/:name",
  csrfProtection,
  moduleDevController.previewTool,
);

export { router as moduleDevRouter };
