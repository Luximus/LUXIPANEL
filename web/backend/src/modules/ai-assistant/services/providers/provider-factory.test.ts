// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantConfig } from "../../models/assistant-config.types.js";

vi.mock("./cli-bridge.provider.js", () => ({ makeCliBridgeProvider: vi.fn(() => ({ id: "codex", mode: "cli" })) }));
vi.mock("./openai-responses.provider.js", () => ({ makeOpenAiResponsesProvider: vi.fn(() => ({ id: "codex", mode: "api" })) }));
import { makeCliBridgeProvider } from "./cli-bridge.provider.js";
import { makeOpenAiResponsesProvider } from "./openai-responses.provider.js";
import { buildProvider } from "./provider-factory.js";

function config(mode: "cli" | "api", installed = true): AssistantConfig {
  return { activeProvider: "codex", providers: { codex: {
    mode, cli: { installed, model: "gpt-6-astra" }, api: { apiKey: "fixture-api-key", model: "gpt-6-astra" },
  } } } as AssistantConfig;
}
beforeEach(() => vi.clearAllMocks());
describe("Codex transport and credential selection", () => {
  it("keeps CLI credentials independent of the saved API key", () => {
    expect(buildProvider(config("cli")).mode).toBe("cli");
    expect(makeCliBridgeProvider).toHaveBeenCalledWith(expect.objectContaining({ id: "codex", apiKey: undefined }));
    expect(makeOpenAiResponsesProvider).not.toHaveBeenCalled();
  });
  it("uses the saved key only when API mode is selected", () => {
    expect(buildProvider(config("api")).mode).toBe("api");
    expect(makeOpenAiResponsesProvider).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "fixture-api-key" }));
    expect(makeCliBridgeProvider).not.toHaveBeenCalled();
  });
  it("does not fall back to API when CLI is unavailable", () => {
    expect(() => buildProvider(config("cli", false))).toThrow("no instalado");
    expect(makeOpenAiResponsesProvider).not.toHaveBeenCalled();
  });
});
