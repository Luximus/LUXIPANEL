// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter } from "express";
import { dashboardController } from "../controllers/dashboard.controller.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";

// The overview endpoint is intentionally NOT gated by requireModule(...): it
// is a read-only server summary available to every authenticated user
// regardless of the admin/user split (non-admins simply see whatever data the
// executor can return for them). The former /panel landing page consumed it;
// it now backs the AI agent capability `dashboard.overview` and stays as a
// public read API.
const router: ExpressRouter = Router();

router.use("/api/dashboard", requireAuth);

router.get("/api/dashboard/overview", dashboardController.overview);

export { router as dashboardRouter };
