// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter } from "express";
import { backupsController } from "../controllers/backups.controller.js";
import { schedulesController } from "../controllers/schedules.controller.js";
import { storagesController } from "../controllers/storages.controller.js";
import { providerCredsController } from "../controllers/provider-creds.controller.js";
import { backupConfigController } from "../controllers/backup-config.controller.js";
import { backupDatabasesController } from "../controllers/backup-databases.controller.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";

const router: ExpressRouter = Router();

router.use("/api/backups", requireAuth, requireModule("backups"));

router.get("/api/backups/config", backupConfigController.get);
router.put("/api/backups/config", csrfProtection, backupConfigController.update);
router.post("/api/backups/config/directory/preview", csrfProtection, backupConfigController.previewDirectory);
router.post("/api/backups/config/directory", csrfProtection, backupConfigController.changeDirectory);
// Names only, for the backup source picker. Access follows Backups, not the
// separate Databases module's SQL-console permission.
router.get("/api/backups/databases", backupDatabasesController.list);

// ---- Backup schedules (must come before /:id to avoid route shadowing) ----
router.get("/api/backups/schedules", schedulesController.list);
router.post("/api/backups/schedules", csrfProtection, schedulesController.create);
router.put("/api/backups/schedules/:id", csrfProtection, schedulesController.update);
router.delete("/api/backups/schedules/:id", csrfProtection, schedulesController.remove);

// ---- Account-level provider credentials (R2 / S3), reused across targets ----
// Configured from Settings → Credentials; targets then only pick a bucket.
router.get("/api/backups/provider-creds", providerCredsController.list);
router.put("/api/backups/provider-creds/:provider", csrfProtection, providerCredsController.save);
router.delete("/api/backups/provider-creds/:provider", csrfProtection, providerCredsController.remove);

// ---- Cloud storage targets (S3 / R2 credentials) ----
router.get("/api/backups/storages", storagesController.list);
router.post("/api/backups/storages", csrfProtection, storagesController.create);
router.put("/api/backups/storages/:id", csrfProtection, storagesController.update);
router.delete("/api/backups/storages/:id", csrfProtection, storagesController.remove);

// ---- Backup jobs ----
router.get("/api/backups", backupsController.list);
router.post("/api/backups", csrfProtection, backupsController.trigger);
router.get("/api/backups/:id/download", backupsController.download);
router.get("/api/backups/:id", backupsController.get);
router.delete("/api/backups/:id", csrfProtection, backupsController.remove);

export { router as backupRouter };
