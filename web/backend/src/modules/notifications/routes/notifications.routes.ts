// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter } from "express";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { requireViewPermission } from "../../auth/middlewares/require-permission.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { notificationsController } from "../controllers/notifications.controller.js";

const router: ExpressRouter = Router();

// All notification endpoints require an authenticated panel session.
router.use("/api/notifications", requireAuth);
router.use("/api/notifications", requireViewPermission("panel.notifications"));

// Read-side ----------------------------------------------------------------
router.get("/api/notifications", notificationsController.list);
router.get("/api/notifications/unread-count", notificationsController.unreadCount);
router.get("/api/notifications/stream", notificationsController.stream);

// Write-side — CSRF protected so SPA mutations require the panel session
// cookie + CSRF token, matching the rest of the panel API.
router.post("/api/notifications", csrfProtection, notificationsController.create);
router.post("/api/notifications/read-all", csrfProtection, notificationsController.markAllRead);
router.patch("/api/notifications/:id/read", csrfProtection, notificationsController.markRead);
router.delete("/api/notifications/:id", csrfProtection, notificationsController.remove);
router.delete("/api/notifications", csrfProtection, notificationsController.clearAll);

export { router as notificationsRouter };
