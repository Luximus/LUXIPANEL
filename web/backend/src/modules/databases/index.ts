// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { databasesRouter } from "./routes/databases.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { databasesAgentCapability } from "./agent-capability.js";

const log = createModuleLogger("databases-module");

export function registerDatabasesModule(app: Express): void {
  app.use(databasesRouter);
  registerModuleOperations("databases", databasesRouter);
  agentCapabilityRegistry.register(databasesAgentCapability);
  log.info("Databases module registered");
}
