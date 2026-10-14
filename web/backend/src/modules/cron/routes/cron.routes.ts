// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter, type RequestHandler } from "express";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { jobsController } from "../controllers/jobs.controller.js";
import { logsController } from "../controllers/logs.controller.js";
import { cronStatusController } from "../controllers/status.controller.js";
import { aiJobsController } from "../controllers/ai-jobs.controller.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import { rememberPanelOrigin } from "../../../shared/panel-url/index.js";

const router: ExpressRouter = Router();
const requireAdmin: RequestHandler = (_req, res, next) => res.locals.user?.kind === "admin"
  ? next() : next(new ForbiddenError("Solo un administrador puede controlar el servicio Cron."));

router.use("/api/cron", requireAuth, requireModule("cron"), (req, _res, next) => {
  // Learn this panel's PUBLIC origin from authenticated traffic — used by the
  // scheduler to build absolute approval URLs (per-panel subdomain, no .env).
  rememberPanelOrigin(req);
  next();
});

// ---- Daemon install / service control (firewall-style) ----
router.get("/api/cron/status", cronStatusController.overview);
router.post("/api/cron/install", csrfProtection, requireAdmin, cronStatusController.install);
router.post("/api/cron/service/enable", csrfProtection, requireAdmin, cronStatusController.enableService);
router.post("/api/cron/service/disable", csrfProtection, requireAdmin, cronStatusController.disableService);

// ---- Classic script jobs ----
router.get("/api/cron/users", requireAdmin, jobsController.users);
router.get("/api/cron/jobs", jobsController.list);
router.post("/api/cron/jobs", csrfProtection, jobsController.add);
router.put("/api/cron/jobs/:id", csrfProtection, jobsController.update);
router.post("/api/cron/jobs/:id/toggle", csrfProtection, jobsController.toggle);
router.delete("/api/cron/jobs/:id", csrfProtection, jobsController.remove);
router.get("/api/cron/jobs/:id/logs", logsController.list);
router.get("/api/cron/jobs/:id/logs/:file", logsController.read);
router.post("/api/cron/validate", jobsController.validate);

// ---- Scheduled AI-agent jobs ----
router.get("/api/cron/agent-presets", aiJobsController.getPresets);
router.put("/api/cron/agent-presets", csrfProtection, aiJobsController.savePresets);
router.get("/api/cron/ai-jobs", aiJobsController.list);
router.post("/api/cron/ai-jobs", csrfProtection, aiJobsController.create);
router.post("/api/cron/ai-jobs/bulk", csrfProtection, aiJobsController.bulk);
router.put("/api/cron/ai-jobs/:id", csrfProtection, aiJobsController.update);
router.post("/api/cron/ai-jobs/:id/toggle", csrfProtection, aiJobsController.toggle);
router.post("/api/cron/ai-jobs/:id/run", csrfProtection, aiJobsController.run);
router.delete("/api/cron/ai-jobs/:id", csrfProtection, aiJobsController.remove);
router.get("/api/cron/ai-jobs/:id/logs", aiJobsController.logs);
router.get("/api/cron/ai-jobs/:id/logs/:file", aiJobsController.readLog);

// Human-approval PUBLIC routes live in `cron-approvals-public.routes.ts`,
// mounted in createApp's public zone (other module routers apply a global
// requireAuth that would intercept them here).

export { router as cronRouter };
