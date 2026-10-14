// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { backupRouter } from "./routes/backup.routes.js";
import { backupSchedulerService } from "./services/scheduler.service.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { backupAgentCapability } from "./agent-capability.js";

const log = createModuleLogger("backup-module");

export function registerBackupModule(app: Express): void {
  backupSchedulerService.start();
  app.use(backupRouter);
  registerModuleOperations("backups", backupRouter);
  agentCapabilityRegistry.register(backupAgentCapability);
  log.info("Backup module registered (scheduler started)");
}
