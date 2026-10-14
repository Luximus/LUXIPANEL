// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter } from "express";
import { openclawController } from "../controllers/index.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";

const router: ExpressRouter = Router();

// Path-scoped guards: only enforce auth + module gate on the openclaw URL
// space, not on every request that falls through this router. Otherwise, when
// `openclaw` is disabled, downstream routers (terminal, mcp, notifications…)
// never get the request because Express runs router-level `use()` for any
// path entering the router.
router.use("/api/openclaw", requireAuth, requireModule("openclaw"));

router.get("/api/openclaw/config", openclawController.getConfig);
router.put("/api/openclaw/config", csrfProtection, openclawController.saveConfig);
router.delete("/api/openclaw/api-key", csrfProtection, openclawController.clearApiKey);
router.post("/api/openclaw/test", csrfProtection, openclawController.testConnection);

export { router as openclawRouter };
