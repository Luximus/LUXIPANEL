import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor, runWithExecutor } from "../../../shared/executor/index.js";
import { settingsRepository } from "../repositories/settings.repository.js";
import { moduleRegistryService } from "../services/module-registry.service.js";
import { providerCredentialsRepository } from "../../backup/repositories/provider-credentials.repository.js";
import { officeConnectorsService } from "../../ai-assistant/services/office-connectors.service.js";
import { assistantIntegrationsService } from "../../ai-assistant/services/integrations.service.js";
import { tolqiaAccountService } from "../../chat/services/tolqia-account.service.js";

export function projectConnectorStatuses(values: Record<string, string>, enabled: Record<string, boolean>) {
  const statuses: Record<string, Record<string, unknown>> = {};
  for (const [module, route, key, field] of [
    ["cloudflare", "/api/cloudflare/config", "cloudflare_api_token", "tokenSet"],
    ["expo", "/api/expo/config", "expo_token", "tokenSet"],
    ["openclaw", "/api/openclaw/config", "openclaw_api_key", "apiKeySet"],
    ["bitninja", "/api/bitninja/config", "bitninja_license_key", "tokenSet"],
    ["admin", "/api/admin/repository-store/config", "repository_store.github_token", "tokenConfigured"],
  ] as const) {
    if (module !== "admin" && !enabled[module]) continue;
    // Presence only. No external verification, raw keys or encrypted blobs.
    statuses[route] = { [field]: Boolean(values[key]?.trim()) };
  }
  return statuses;
}

/** Admin gate is applied before this route; auxiliary module gates are retained. */
export const connectorStatus = asyncHandler(async (req, res) => {
  const executor = getExecutor(req);
  const [settings, enabled] = await Promise.all([
    settingsRepository.getAll(executor),
    runWithExecutor(executor, () => moduleRegistryService.getEnabledMap()),
  ]);
  const statuses = projectConnectorStatuses(Object.fromEntries(settings.map(row => [row.key, row.value])), enabled);
  const extra: Array<[string, () => Promise<unknown>]> = [];
  if (enabled.backups) extra.push(["/api/backups/provider-creds", () => providerCredentialsRepository.listPublic(executor)]);
  if (enabled.assistant) {
    extra.push(["/api/ai/connectors", async () => ({ connectors: await officeConnectorsService.list() })]);
    extra.push(["/api/ai/integrations/elevenlabs", () => assistantIntegrationsService.getElevenLabs(executor)]);
  }
  if (enabled.chat) extra.push(["/api/chat/tolqia/config", () => tolqiaAccountService.getConfig(executor, res.locals.locale)]);
  const results = await Promise.allSettled(extra.map(async ([route, read]) => [route, await read()] as const));
  for (const result of results) if (result.status === "fulfilled") statuses[result.value[0]] = result.value[1] as Record<string, unknown>;
  res.json({ ok: true, data: { enabledModules: Object.keys(enabled).filter(id => enabled[id]), statuses } });
});
