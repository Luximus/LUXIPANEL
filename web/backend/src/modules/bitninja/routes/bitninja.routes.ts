// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter } from "express";
import { bitninjaController } from "../controllers/index.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";

const router: ExpressRouter = Router();

// Path-scoped so a disabled `bitninja` module doesn't 404 unrelated requests
// passing through this router on their way to later registrations.
router.use("/api/bitninja", requireAuth, requireModule("bitninja"));

router.get("/api/bitninja/status", bitninjaController.getStatus);
router.get("/api/bitninja/logs", bitninjaController.getLogs);
// License key storage (managed from Settings → Credentials).
router.get("/api/bitninja/config", bitninjaController.getConfig);
router.put("/api/bitninja/config", csrfProtection, bitninjaController.saveConfig);
router.delete("/api/bitninja/config", csrfProtection, bitninjaController.clearConfig);
// `packages` (instead of `install`/`setup`) avoids Cloudflare WAF
// false-positives that flag URLs containing "install"/"setup".
router.post("/api/bitninja/packages", csrfProtection, bitninjaController.install);
router.post("/api/bitninja/license", csrfProtection, bitninjaController.setLicense);
router.post("/api/bitninja/service", csrfProtection, bitninjaController.setService);
router.post("/api/bitninja/components", csrfProtection, bitninjaController.setComponent);

export { router as bitninjaRouter };
