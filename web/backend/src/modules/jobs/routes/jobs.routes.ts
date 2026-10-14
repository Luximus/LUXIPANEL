// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter } from "express";
import { jobsController } from "../controllers/jobs.controller.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";

const router: ExpressRouter = Router();

router.use("/api/jobs", requireAuth);

// Read-only status poll for an enqueued mutation. No per-module gate: a job id
// is an opaque uuid scoped to the caller's connected server, and the status
// payload carries no tenant data beyond the job's own state.
router.get("/api/jobs/:id", jobsController.get);

export { router as jobsRouter };
