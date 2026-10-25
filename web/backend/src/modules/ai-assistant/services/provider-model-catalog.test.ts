import { describe, expect, it, vi } from "vitest";
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

  it("does not resolve a model when availability is unverified", () => {
    expect(resolveCatalogModel("custom-model", { ...catalog, status: "unverified" }, "codex"))
      .toEqual({ model: undefined, fallback: false });
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
    const executor = {
      target: { id: "provider-catalog-cli-signed-out" },
      exec: vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({ ok: true, models: [
          { id: "gpt-5.6-terra", model: "gpt-5.6-terra", displayName: "GPT-5.6 Terra", isDefault: true, hidden: false, supportedReasoningEfforts: [{ reasoningEffort: "max" }] },
          { id: "gpt-5.6-luna", model: "gpt-5.6-luna", displayName: "GPT-5.6 Luna", hidden: false, supportedReasoningEfforts: [{ reasoningEffort: "high" }] },
          { id: "gpt-6-astra", model: "gpt-6-astra", displayName: "GPT-6 Astra", hidden: true },
        ] }),
      }),
    } as any;
    const signedOut = await providerModelCatalog(executor, config, "codex", { refresh: true });
    expect(signedOut.status).toBe("unavailable");
    expect(signedOut.reason).toBe("provider_authorization_failed");
    expect(signedOut.models.every((model) => !model.available)).toBe(true);

    config.providers.codex.cli!.loggedIn = true;
    const signedIn = await providerModelCatalog(executor, config, "codex", { refresh: true });
    expect(signedIn.status).toBe("verified");
    expect(signedIn.source).toBe("cli");
    expect(signedIn.models).toEqual([
      expect.objectContaining({ id: "gpt-5.6-terra", available: true, isDefault: true, reasoningEfforts: ["max"] }),
      expect.objectContaining({ id: "gpt-5.6-luna", available: true, reasoningEfforts: ["high"] }),
    ]);
    expect(signedIn.models.some((model) => model.id === "gpt-6-astra")).toBe(false);
    expect(resolveCatalogModel("gpt-6-astra", signedIn, "codex"))
      .toEqual({ model: "gpt-5.6-terra", fallback: true });
  });

  it("does not advertise a CLI whose native inventory cannot be read", async () => {
    const config = defaultAssistantConfig();
    config.providers.codex = {
      ...config.providers.codex,
      mode: "cli",
      cli: { installed: true, loggedIn: true, model: "gpt-5.6-terra" },
    };
    const catalog = await providerModelCatalog({
      target: { id: "provider-catalog-cli-unavailable" },
      exec: vi.fn().mockResolvedValue({ exitCode: 1, stdout: "" }),
    } as any, config, "codex", { refresh: true });
    expect(catalog).toMatchObject({ status: "unavailable", source: "cli", reason: "provider_unavailable", models: [] });
  });
});
