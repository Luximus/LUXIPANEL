// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../ai-assistant/services/translation/ai-translator.js", () => ({ aiComplete: vi.fn() }));

import { aiComplete } from "../../ai-assistant/services/translation/ai-translator.js";
import { searchIntentService, NoAiProviderError, extractJsonObject, buildSystemPrompt } from "./search-intent.service.js";

const config = {} as never;
const candidates = [
  { id: "users.tab.roles", label: "Roles", path: "Usuarios", keywords: ["roles", "permisos"] },
  { id: "mail.action.new-account", label: "Nueva cuenta de correo", path: "Correo", keywords: ["crear cuenta de correo"] },
];

describe("searchIntentService.resolve", () => {
  beforeEach(() => {
    // Braces matter: a hook RETURNING the mock fn would be treated by vitest as a
    // cleanup callback and called after the test (running the throwing impl).
    vi.mocked(aiComplete).mockReset();
  });

  it("returns the candidate chosen by the model with a clamped confidence", async () => {
    vi.mocked(aiComplete).mockResolvedValue({ text: '```json\n{"id":"users.tab.roles","confidence":1.7}\n```', inputTokens: 1, outputTokens: 1 } as never);
    const out = await searchIntentService.resolve(config, { query: "quiero editar roles", locale: "es", candidates });
    expect(out).toEqual({ id: "users.tab.roles", confidence: 1 });
    const call = vi.mocked(aiComplete).mock.calls[0]![1];
    expect(call.system).toContain("users.tab.roles: Roles (Usuarios)");
    expect(call.user).toContain("quiero editar roles");
  });

  it("rejects ids that are not in the candidate list", async () => {
    vi.mocked(aiComplete).mockResolvedValue({ text: '{"id":"made.up","confidence":0.9}', inputTokens: 0, outputTokens: 0 } as never);
    const out = await searchIntentService.resolve(config, { query: "x", locale: "es", candidates });
    expect(out).toEqual({ id: null, confidence: 0 });
  });

  it("returns null on unparsable output", async () => {
    vi.mocked(aiComplete).mockResolvedValue({ text: "no json here", inputTokens: 0, outputTokens: 0 } as never);
    const out = await searchIntentService.resolve(config, { query: "x", locale: "es", candidates });
    expect(out).toEqual({ id: null, confidence: 0 });
  });

  it("throws NoAiProviderError when no API provider is configured", async () => {
    vi.mocked(aiComplete).mockImplementation(async () => { throw new Error('El proveedor "claude" no tiene API key configurada'); });
    await expect(searchIntentService.resolve(config, { query: "x", locale: "es", candidates })).rejects.toBeInstanceOf(NoAiProviderError);
  });

  it("is fail-open on other provider errors", async () => {
    vi.mocked(aiComplete).mockImplementation(async () => { throw new Error("network down"); });
    const out = await searchIntentService.resolve(config, { query: "x", locale: "es", candidates });
    expect(out).toEqual({ id: null, confidence: 0 });
  });
});

describe("helpers", () => {
  it("extractJsonObject tolerates fences and prose", () => {
    expect(extractJsonObject('Claro: ```json {"id":"a"} ``` fin')).toEqual({ id: "a" });
    expect(extractJsonObject("[1,2]")).toBeNull();
  });
  it("buildSystemPrompt lists every candidate", () => {
    const p = buildSystemPrompt("en", candidates);
    expect(p).toContain("mail.action.new-account");
    expect(p).toContain("Idioma del usuario: en");
  });
});
