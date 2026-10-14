// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { setModuleCatalogProvider } from "../../shared/module-state/index.js";
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { adminRouter } from "./routes/admin.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { setEnabledMapProvider } from "../../shared/module-state/index.js";
import { setPanelSettingsWriter } from "../../shared/panel-settings/index.js";
import { moduleRegistryService } from "./services/module-registry.service.js";
import { settingsRepository } from "./repositories/settings.repository.js";
import { adminAgentCapability } from "./agent-capability.js";

const log = createModuleLogger("admin-module");

export function registerAdminModule(app: Express): void {
  setModuleCatalogProvider(() => moduleRegistryService.getAll());
  app.use("/api", adminRouter);
  registerModuleOperations("admin", adminRouter, { prefix: "/api", include: path => !path.includes("repository-store") });
  registerModuleOperations("repository-store", adminRouter, { prefix: "/api", include: path => path.includes("repository-store") });
  agentCapabilityRegistry.register(adminAgentCapability);
  // Shared bridges: expose the module enable-map and the settings writer so
  // other modules consume them without importing admin directly.
  setEnabledMapProvider(() => moduleRegistryService.getEnabledMap());
  setPanelSettingsWriter((key, value, category, description) =>
    settingsRepository.set(key, value, category, description),
  );
  log.info("Admin module registered");
}
