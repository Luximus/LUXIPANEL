// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter, type RequestHandler } from "express";
import { webhooksController } from "../controllers/webhooks.controller.js";
import { apiKeysController } from "../controllers/api-keys.controller.js";
import { discoveryController } from "../controllers/discovery.controller.js";
import { gatewayWebhookController } from "../controllers/gateway-webhook.controller.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import { ForbiddenError } from "../../../shared/errors/index.js";

const router: ExpressRouter = Router();

const requireAdmin: RequestHandler = (_req, res, next) => {
  if (res.locals["user"]?.kind !== "admin") return next(new ForbiddenError("Webhooks requiere administración del panel"));
  next();
};
router.use(["/api/webhooks", "/api/api-keys"], requireAuth, requireModule("webhooks"), requireAdmin);

// ---- Webhooks ----
router.get("/api/webhooks/events", webhooksController.events);
// ---- Categories + Gateway (receive-data, inbound) webhooks ----
router.get("/api/webhooks/categories", gatewayWebhookController.categories);
router.get("/api/webhooks/gateways", gatewayWebhookController.list);
router.get("/api/webhooks/gateways/:id", gatewayWebhookController.get);
router.post("/api/webhooks/gateways", csrfProtection, gatewayWebhookController.create);
router.put("/api/webhooks/gateways/:id", csrfProtection, gatewayWebhookController.update);
router.delete("/api/webhooks/gateways/:id", csrfProtection, gatewayWebhookController.remove);
// ---- Discovery (webhooks detected on the server) ----
router.get("/api/webhooks/discovered", discoveryController.list);
router.post("/api/webhooks/discovered/scan", csrfProtection, discoveryController.scan);
router.post("/api/webhooks/discovered/action", csrfProtection, discoveryController.action);
router.get("/api/webhooks", webhooksController.list);
router.get("/api/webhooks/:id/deliveries", webhooksController.deliveries);
router.post("/api/webhooks/:id/test", csrfProtection, webhooksController.test);
router.post("/api/webhooks", csrfProtection, webhooksController.create);
router.put("/api/webhooks/:id", csrfProtection, webhooksController.update);
router.post("/api/webhooks/:id/regenerate-secret", csrfProtection, webhooksController.regenerateSecret);
router.delete("/api/webhooks/:id", csrfProtection, webhooksController.remove);

// ---- API Keys ----
router.get("/api/api-keys", apiKeysController.list);
router.post("/api/api-keys", csrfProtection, apiKeysController.create);
router.delete("/api/api-keys/:id", csrfProtection, apiKeysController.revoke);

export { router as webhooksRouter };
