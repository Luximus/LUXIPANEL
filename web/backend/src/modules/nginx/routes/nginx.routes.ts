// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter } from "express";
import {
  sitesController,
  systemController,
  proxyController,
  sslBridgeController,
} from "../controllers/index.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";

const router: ExpressRouter = Router();

router.use("/api/nginx", requireAuth, requireModule("dns"));

// ---- Status / service control / global config / logs ----
router.get("/api/nginx/status", systemController.status);
router.post("/api/nginx/service", csrfProtection, systemController.service);
router.get("/api/nginx/config", systemController.getConfig);
router.put("/api/nginx/config", csrfProtection, systemController.putConfig);
router.get("/api/nginx/logs", systemController.logs);
router.get("/api/nginx/performance", systemController.getPerformance);
router.put("/api/nginx/performance", csrfProtection, systemController.putPerformance);

// ---- Discovered domains (kept for SSL/Mail pickers) ----
router.get("/api/nginx/domains", sitesController.domains);
router.get("/api/nginx/domains/discovered", sitesController.discovered);
router.get("/api/nginx/upstreams", sitesController.upstreams);

// ---- Reverse proxy / upstreams ----
router.post("/api/nginx/proxy/preview", csrfProtection, proxyController.preview);
router.post("/api/nginx/proxy", csrfProtection, proxyController.create);

// ---- Certificate renewal on the connected target ----
router.get("/api/nginx/ssl/renewal", sslBridgeController.renewalStatus);
router.get("/api/nginx/ssl/renewal/sites", sslBridgeController.siteRenewalStatuses);
router.post("/api/nginx/ssl/renewal", csrfProtection, sslBridgeController.configureRenewal);
router.post("/api/nginx/ssl/renewal/dry-run", csrfProtection, sslBridgeController.testRenewal);

// ---- Sites (server blocks) ----
router.get("/api/nginx/sites", sitesController.list);
router.post("/api/nginx/sites", csrfProtection, sitesController.create);
router.post("/api/nginx/sites/preview", csrfProtection, sitesController.preview);
router.get("/api/nginx/sites/:name/raw", sitesController.raw);
router.put("/api/nginx/sites/:name", csrfProtection, sitesController.update);
router.post("/api/nginx/sites/:name/enable", csrfProtection, sitesController.enable);
router.post("/api/nginx/sites/:name/disable", csrfProtection, sitesController.disable);
router.post("/api/nginx/sites/:name/ssl", csrfProtection, sslBridgeController.enable);
router.delete("/api/nginx/sites/:name", csrfProtection, sitesController.remove);

export { router as nginxRouter };
