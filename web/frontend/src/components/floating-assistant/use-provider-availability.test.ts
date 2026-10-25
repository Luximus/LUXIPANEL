import { describe, expect, it } from "vitest";
import { isProviderOperational } from "./use-provider-availability";
import type { AssistantProviderState, ProviderModelCatalog } from "./assistant-api";

const cliCatalog: ProviderModelCatalog = {
  providerId: "codex", mode: "cli", status: "unverified", source: "curated", checkedAt: "2026-10-25T00:00:00.000Z",
  models: [{ id: "gpt-cli", label: "GPT CLI", available: true }],
};

describe("provider availability", () => {
  it("accepts a verified API catalogue with available models", () => {
    const provider = { mode: "api", api: { hasApiKey: true }, cli: { installed: false, loggedIn: false } } as AssistantProviderState;
    const catalog: ProviderModelCatalog = { ...cliCatalog, mode: "api", status: "verified", source: "provider-api" };
    expect(isProviderOperational(provider, catalog)).toBe(true);
  });

  it("requires both installation and login for a CLI catalogue", () => {
    const ready = { mode: "cli", api: { hasApiKey: false }, cli: { installed: true, loggedIn: true } } as AssistantProviderState;
    const signedOut = { ...ready, cli: { installed: true, loggedIn: false } } as AssistantProviderState;
    expect(isProviderOperational(ready, cliCatalog)).toBe(true);
    expect(isProviderOperational(signedOut, cliCatalog)).toBe(false);
  });

  it("never treats an unverified API inventory as usable", () => {
    const provider = { mode: "api", api: { hasApiKey: true }, cli: { installed: false, loggedIn: false } } as AssistantProviderState;
    const catalog: ProviderModelCatalog = { ...cliCatalog, mode: "api", status: "unverified", source: "curated" };
    expect(isProviderOperational(provider, catalog)).toBe(false);
  });
});
