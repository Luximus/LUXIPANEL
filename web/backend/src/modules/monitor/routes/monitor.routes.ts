// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter, type RequestHandler } from "express";
import { monitorController } from "../controllers/monitor.controller.js";
import { alertsController } from "../controllers/alerts.controller.js";
import { watchdogController } from "../controllers/watchdog.controller.js";
import { assistantAdmissionController } from "../controllers/assistant-admission.controller.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import { ForbiddenError } from "../../../shared/errors/index.js";

const router: ExpressRouter = Router();

router.use("/api/monitor", requireAuth, requireModule("monitor"));

// Installing packages (`apt-get install`) and enabling systemd units are
// privileged, root-level operations — require admin (matches the watchdog gate),
// not merely the `monitor` module grant.
const requireAdmin: RequestHandler = (_req, res, next) => {
  if ((res.locals.user as { kind?: string } | undefined)?.kind !== "admin") {
    next(new ForbiddenError("Solo un administrador puede realizar esta acción"));
    return;
  }
  next();
};

// ---- System metrics ----
router.get("/api/monitor/system", monitorController.system);
router.get("/api/monitor/time", monitorController.time);
router.get("/api/monitor/stats", monitorController.stats);
router.get("/api/monitor/snapshot", monitorController.snapshot);
router.get("/api/monitor/history", monitorController.history);
router.get("/api/monitor/services", monitorController.services);
router.post("/api/monitor/services/:name/start", csrfProtection, requireAdmin, monitorController.startService);
router.post("/api/monitor/services/:name/install", csrfProtection, requireAdmin, monitorController.installService);
router.get("/api/monitor/processes", monitorController.processes);
router.post("/api/monitor/processes/:pid/kill", csrfProtection, monitorController.killProcess);

// ---- Resource watchdog (auto-reboot on sustained CPU/RAM pressure) ----
router.get("/api/monitor/watchdog", watchdogController.get);
router.put("/api/monitor/watchdog", csrfProtection, watchdogController.update);
router.get("/api/monitor/assistant-admission", assistantAdmissionController.get);
router.put("/api/monitor/assistant-admission", csrfProtection, requireAdmin, assistantAdmissionController.update);

// ---- WebSocket client count (informational) ----
router.get("/api/monitor/ws/clients", alertsController.streamClients);

// ---- Alert rules ----
router.get("/api/monitor/alerts/rules", alertsController.listRules);
router.post("/api/monitor/alerts/rules", csrfProtection, alertsController.createRule);
router.put("/api/monitor/alerts/rules/:id", csrfProtection, alertsController.updateRule);
router.delete("/api/monitor/alerts/rules/:id", csrfProtection, alertsController.deleteRule);

// ---- Alert events ----
router.get("/api/monitor/alerts/events", alertsController.listEvents);
router.get("/api/monitor/alerts/firing", alertsController.listFiring);

export { router as monitorRouter };
