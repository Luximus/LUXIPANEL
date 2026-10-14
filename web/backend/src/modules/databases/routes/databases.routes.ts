// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter } from "express";
import { databasesController } from "../controllers/index.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";

const router: ExpressRouter = Router();

router.use("/api/databases", requireAuth, requireModule("databases"));

// ── Discovery & browsing (read-only) ──
router.get("/api/databases/engines", databasesController.engines);
router.get("/api/databases/list", databasesController.databases);
router.post("/api/databases/databases", csrfProtection, databasesController.createDatabase);
router.get("/api/databases/tables", databasesController.tables);
router.get("/api/databases/columns", databasesController.columns);
router.get("/api/databases/rows", databasesController.rows);

// ── SQL console (POST: carries the statement in the body; CSRF-guarded) ──
router.post("/api/databases/query", csrfProtection, databasesController.query);

// ── Record CRUD (CSRF-guarded; primary-key scoped on the service) ──
router.post("/api/databases/records", csrfProtection, databasesController.insertRecord);
router.patch("/api/databases/records", csrfProtection, databasesController.updateRecord);
router.delete("/api/databases/records", csrfProtection, databasesController.deleteRecord);

// ── Export (POST: streams a .sql attachment) ──
router.post("/api/databases/export", csrfProtection, databasesController.export);

// ── Engine installation (CSRF-guarded; sudo via the shared install flow) ──
router.post("/api/databases/install", csrfProtection, databasesController.install);

export { router as databasesRouter };
