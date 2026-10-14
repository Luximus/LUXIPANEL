import { registerModuleOperations } from "../../shared/module-operations/registry.js";
import type { Express } from "express";
import { cloudflareRouter } from "./routes/cloudflare.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { cloudflareAgentCapability } from "./agent-capability.js";
import { wireCloudflareSslSuggestion } from "./services/ssl-suggestion.service.js";

const log = createModuleLogger("cloudflare-module");

export function registerCloudflareModule(app: Express): void {
  app.use(cloudflareRouter);
  registerModuleOperations("cloudflare", cloudflareRouter);
  agentCapabilityRegistry.register(cloudflareAgentCapability);
  wireCloudflareSslSuggestion();
  log.info("Cloudflare module registered");
}
