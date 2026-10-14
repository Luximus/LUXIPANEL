import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { obsidianRouter } from "./routes/obsidian.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { obsidianAgentCapability } from "./agent-capability.js";
import { registerObsidianListeners } from "./listeners.js";

const log = createModuleLogger("obsidian-module");

export function registerObsidianModule(app: Express): void {
  app.use(obsidianRouter);
  registerModuleOperations("obsidian", obsidianRouter);
  agentCapabilityRegistry.register(obsidianAgentCapability);
  registerObsidianListeners();
  log.info("Obsidian module registered");
}
