import { describe, expect, it, vi } from "vitest";
vi.mock("../repositories/settings.repository.js", () => ({ settingsRepository: {} }));
vi.mock("../services/module-registry.service.js", () => ({ moduleRegistryService: {} }));
vi.mock("../../../shared/executor/index.js", () => ({ getExecutor: vi.fn(), runOnPanelHost: vi.fn() }));
vi.mock("../../backup/repositories/provider-credentials.repository.js", () => ({ providerCredentialsRepository: {} }));
vi.mock("../../ai-assistant/services/office-connectors.service.js", () => ({ officeConnectorsService: {} }));
vi.mock("../../ai-assistant/services/integrations.service.js", () => ({ assistantIntegrationsService: {} }));
vi.mock("../../chat/services/tolqia-account.service.js", () => ({ tolqiaAccountService: {} }));
import { projectConnectorStatuses } from "./connector-status.controller.js";
describe("connector status projection", () => {
  it("returns only presence for enabled modules and never probes providers", () => {
    const secret = "never-return-the-provider-secret";
    const result = projectConnectorStatuses({ cloudflare_api_token: secret, expo_token: secret,
      "repository_store.github_token": "encrypted:" + secret, smtp_password: secret }, { cloudflare: true, expo: false });
    expect(result["/api/cloudflare/config"]).toEqual({ tokenSet: true });
    expect(result["/api/admin/repository-store/config"]).toEqual({ tokenConfigured: true });
    expect(result["/api/expo/config"]).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain("smtp");
  });
});
