// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { filesRouter } from "./routes/files.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { filesAgentCapability } from "./agent-capability.js";
import { registerLogsGithub } from "./services/logs-github-adapter.js";

const log = createModuleLogger("files-module");

export function registerFilesModule(app: Express): void {
  registerLogsGithub();
  app.use(filesRouter);
  registerModuleOperations("files", filesRouter);
  agentCapabilityRegistry.register(filesAgentCapability);
  log.info("Files module registered");
}
