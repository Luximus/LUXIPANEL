// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { expoRouter } from "./routes/expo.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { expoAgentCapability } from "./agent-capability.js";

import { registerExpoProviderToken } from "../../shared/expo-provider-bridge.js";
import { runWithExecutor } from "../../shared/executor/index.js";
import { expoConfigService } from "./services/expo-config.service.js";

const log = createModuleLogger("expo-module");

export function registerExpoModule(app: Express): void {
  registerExpoProviderToken((executor) => runWithExecutor(executor, () => expoConfigService.getToken()));
  app.use(expoRouter);
  registerModuleOperations("expo", expoRouter);
  agentCapabilityRegistry.register(expoAgentCapability);
  log.info("Expo module registered");
}
