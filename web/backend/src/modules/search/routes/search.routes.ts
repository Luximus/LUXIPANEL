// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { requireViewPermission } from "../../auth/middlewares/require-permission.middleware.js";
import { clientIpKey } from "../../auth/middlewares/rate-limiter.middleware.js";
import { searchController } from "../controllers/search.controller.js";
import { apiErrorMessage } from "../../../shared/i18n/errors.js";

const router: ExpressRouter = Router();

// Una completion IA por consulta: acotar por IP (además del limiter global).
const intentRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: clientIpKey,
  handler: (_req, res) => res.status(429).json({ ok: false, error: apiErrorMessage(res.locals.locale, "rateLimit"), code: "RATE_LIMIT" }),
});

router.use("/api/search", requireAuth, requireViewPermission("panel.search"));
router.post("/api/search/intent", intentRateLimiter, searchController.intent);

export { router as searchRouter };
