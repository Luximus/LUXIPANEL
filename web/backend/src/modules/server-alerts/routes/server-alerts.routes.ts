// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter } from "express";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import { serverAlertsController } from "../controllers/server-alerts.controller.js";

const router: ExpressRouter = Router();

// Path-scoped guards: only enforce auth + module gate on the server-alerts URL
// space, so a disabled module never eats downstream routes (cloudflare pattern).
router.use("/api/server-alerts", requireAuth, requireModule("server-alerts"));

// ── Preferences ──
router.get("/api/server-alerts/prefs", serverAlertsController.getPrefs);
router.put("/api/server-alerts/prefs", csrfProtection, serverAlertsController.setPrefs);
router.get("/api/server-alerts/me/preferences", serverAlertsController.ownPreferences);
router.put("/api/server-alerts/me/preferences", csrfProtection, serverAlertsController.updateOwnPreferences);
router.get("/api/server-alerts/channels", serverAlertsController.channels);
router.post("/api/server-alerts/devices/web", csrfProtection, serverAlertsController.registerWeb);
router.post("/api/server-alerts/devices/mobile", csrfProtection, serverAlertsController.registerMobile);
router.delete("/api/server-alerts/devices/:channel", csrfProtection, serverAlertsController.removeDevice);
router.get("/api/server-alerts/history", serverAlertsController.history);
router.post("/api/server-alerts/test", csrfProtection, serverAlertsController.test);

// ── Immediate send ──
router.post("/api/server-alerts/send", csrfProtection, serverAlertsController.send);

// ── Scheduled notifications ──
router.get("/api/server-alerts/scheduled", serverAlertsController.listScheduled);
router.post("/api/server-alerts/scheduled", csrfProtection, serverAlertsController.createScheduled);
router.put("/api/server-alerts/scheduled/:id", csrfProtection, serverAlertsController.updateScheduled);
router.delete("/api/server-alerts/scheduled/:id", csrfProtection, serverAlertsController.deleteScheduled);

// ── Metric rules ──
router.get("/api/server-alerts/rules", serverAlertsController.listRules);
router.post("/api/server-alerts/rules", csrfProtection, serverAlertsController.createRule);
router.put("/api/server-alerts/rules/:id", csrfProtection, serverAlertsController.updateRule);
router.delete("/api/server-alerts/rules/:id", csrfProtection, serverAlertsController.deleteRule);

export { router as serverAlertsRouter };
