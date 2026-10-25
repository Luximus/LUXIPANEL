import { describe, expect, it } from "vitest";
import { fallbackModelIds, isExplicitModelUnavailable, providerModelCatalog, resolveCatalogModel, type ProviderModelCatalog } from "./provider-model-catalog.service.js";
import { defaultAssistantConfig } from "../models/assistant-config.types.js";

const catalog: ProviderModelCatalog = {
  providerId: "codex",
  mode: "api",
  status: "verified",
  source: "provider-api",
  checkedAt: "2026-10-20T00:00:00.000Z",
  models: [
    { id: "gpt-6-luna", label: "GPT-6 Luna", available: true },
    { id: "gpt-6-astra", label: "GPT-6 Astra", available: true },
  ],
};

describe("provider model catalog", () => {
  it("keeps a verified preference or selects an available same-provider model", () => {
    expect(resolveCatalogModel("gpt-6-luna", catalog, "codex")).toEqual({ model: "gpt-6-luna", fallback: false });
    expect(resolveCatalogModel("retired-model", catalog, "codex")).toEqual({ model: "gpt-6-luna", fallback: true });
  });

  it("keeps the preference when catalog availability is unverified", () => {
    expect(resolveCatalogModel("custom-model", { ...catalog, status: "unverified" }, "codex"))
      .toEqual({ model: "custom-model", fallback: false });
  });

  it("offers at most two same-provider retry models and recognizes model rejection errors", () => {
    expect(fallbackModelIds(catalog, "codex", ["gpt-6-luna"])).toEqual(["gpt-6-astra"]);
    expect(isExplicitModelUnavailable("The requested model was not found" )).toBe(true);
    expect(isExplicitModelUnavailable("The request timed out" )).toBe(false);
  });

  it("does not advertise a CLI catalogue until its installed binary is authenticated", async () => {
    const config = defaultAssistantConfig();
    config.providers.codex = {
      ...config.providers.codex,
      mode: "cli",
      cli: { installed: true, loggedIn: false, model: "configured-cli-model" },
    };
    const executor = { target: { id: "provider-catalog-cli-signed-out" } } as any;
    const signedOut = await providerModelCatalog(executor, config, "codex", { refresh: true });
    expect(signedOut.status).toBe("unavailable");
    expect(signedOut.reason).toBe("provider_authorization_failed");
    expect(signedOut.models.every((model) => !model.available)).toBe(true);

    config.providers.codex.cli!.loggedIn = true;
    const signedIn = await providerModelCatalog(executor, config, "codex", { refresh: true });
    expect(signedIn.status).toBe("unverified");
    expect(signedIn.models.some((model) => model.id === "configured-cli-model" && model.available)).toBe(true);
  });
});
