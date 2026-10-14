// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { bitninjaRouter } from "./routes/bitninja.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { bitninjaAgentCapability } from "./agent-capability.js";

const log = createModuleLogger("bitninja-module");

export function registerBitNinjaModule(app: Express): void {
  app.use(bitninjaRouter);
  registerModuleOperations("bitninja", bitninjaRouter);
  agentCapabilityRegistry.register(bitninjaAgentCapability);
  log.info("BitNinja module registered");
}
