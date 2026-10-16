// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

process.env.JWT_SECRET ??= "x".repeat(40);
process.env.LICENSE_SERVER_URL ??= "http://127.0.0.1:3300";
const target = vi.hoisted(() => ({ name: "connected-target" }));
vi.mock("../../../shared/executor/index.js", () => ({ getExecutor: () => target }));
vi.mock("../repositories/assistant-config.repository.js", () => ({ assistantConfigRepository: { load: vi.fn(), save: vi.fn() } }));
const { assistantConfigController } = await import("./config.controller.js");
const { assistantConfigRepository } = await import("../repositories/assistant-config.repository.js");
const { defaultAssistantConfig } = await import("../models/assistant-config.types.js");
const { makeOpenAiVoice } = await import("../services/voice/openai-voice.js");
let config = defaultAssistantConfig();
const success = () => Response.json({ object: "list", data: [{ id: "audio-model" }] });
beforeEach(() => {
  config = defaultAssistantConfig();
  config.providers.codex.mode = "cli";
  config.providers.codex.cli!.installed = true;
  config.providers.codex.api!.apiKey = "test-saved-secret";
  vi.mocked(assistantConfigRepository.load).mockReset().mockImplementation(async () => config);
  vi.mocked(assistantConfigRepository.save).mockReset().mockImplementation(async value => value);
});
afterEach(() => vi.unstubAllGlobals());
async function invoke(action: "testProvider" | "setProvider" = "testProvider", body?: unknown) {
  return new Promise<{ data?: any; error?: any }>(resolve => {
    const res = { locals: { locale: "es" }, json: (data: unknown) => resolve({ data }) };
    assistantConfigController[action]({ params: { id: "codex" }, body } as unknown as Request, res as Response, ((error: unknown) => resolve({ error })) as NextFunction);
  });
}
it.each(["cli", "api"] as const)("authenticates the saved OpenAI key even in %s mode", async mode => {
  config.providers.codex.mode = mode;
  const fetchMock = vi.fn(async () => success());
  vi.stubGlobal("fetch", fetchMock);
  const { data } = await invoke();
  expect(data.ok).toBe(true);
  expect(data.detail).toContain("autenticó la clave API guardada");
  expect(assistantConfigRepository.load).toHaveBeenCalledWith(target);
  expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/models", expect.objectContaining({ headers: { Authorization: "Bearer test-saved-secret" }, signal: expect.any(AbortSignal), redirect: "error" }));
  expect(JSON.stringify(data)).not.toContain("test-saved-secret");
});
it("never reports an installed CLI as proof that a rejected API key works", async () => {
  const fetchMock = vi.fn(async () => Response.json({ error: { code: "invalid_api_key", message: "secret upstream test-saved-secret" } }, { status: 401 }));
  vi.stubGlobal("fetch", fetchMock);
  const { data } = await invoke();
  expect(data.ok).toBe(false);
  expect(data.detail).toContain("OpenAI rechazó la clave API guardada");
  expect(data.detail).toContain("Ajustes → Agentes IA → OpenAI");
  expect(JSON.stringify(data)).not.toContain("test-saved-secret");
  await expect(makeOpenAiVoice(config).transcribe("YXVkaW8=", "audio/webm")).rejects.toThrow(data.detail);
  await expect(makeOpenAiVoice(config).speak("hola")).rejects.toThrow(data.detail);
});
it.each([401, 403, 429, 500])("does not report success for HTTP %s", async status => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("sensitive upstream body", { status })));
  const { data } = await invoke();
  expect(data.ok).toBe(false);
  expect(data.detail).not.toContain("sensitive");
});
it("distinguishes a rejected server IP from a rejected key", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "ip_not_authorized" } }, { status: 401 })));
  const { data } = await invoke();
  expect(data.ok).toBe(false);
  expect(data.detail).toContain("no autorizó la IP");
  expect(data.detail).not.toContain("Sustitúyela");
});
it("does not send a request when the key is empty even with Codex installed", async () => {
  config.providers.codex.api!.apiKey = "  ";
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  expect((await invoke()).data.ok).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each(["https://openai.example", "https://openai.example/v1/"])("uses the same key and API base for probe and audio: %s", async baseUrl => {
  config.providers.codex.api!.baseUrl = baseUrl;
  config.providers.codex.api!.apiKey = "  test-saved-secret  ";
  const fetchMock = vi.fn().mockResolvedValueOnce(success()).mockResolvedValueOnce(Response.json({ text: "hola" }));
  vi.stubGlobal("fetch", fetchMock);
  expect((await invoke()).data.ok).toBe(true);
  await makeOpenAiVoice(config).transcribe("YXVkaW8=", "audio/webm");
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["https://openai.example/v1/models", "https://openai.example/v1/audio/transcriptions"]);
  for (const [, options] of fetchMock.mock.calls) expect(options.headers.Authorization).toBe("Bearer test-saved-secret");
});
it.each(["html", "json"])("rejects a misleading HTTP 200 with %s instead of a model list", async type => {
  vi.stubGlobal("fetch", vi.fn(async () => type === "html" ? new Response("<html>login</html>") : Response.json({ ok: true })));
  expect((await invoke()).data.ok).toBe(false);
});
it.each(["TimeoutError", "TypeError"])("does not misclassify %s as an invalid credential", async name => {
  const error = new Error("secret upstream data"); error.name = name;
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
  const { data } = await invoke();
  expect(data.ok).toBe(false);
  expect(data.detail).toContain(name === "TimeoutError" ? "no respondió a tiempo" : "No se pudo conectar");
  expect(data.detail).not.toContain("secret");
});
it("trims a replacement credential before saving it to the connected target", async () => {
  expect((await invoke("setProvider", { api: { apiKey: "  replacement  " } })).error).toBeUndefined();
  expect(assistantConfigRepository.save).toHaveBeenCalledWith(expect.objectContaining({ providers: expect.objectContaining({ codex: expect.objectContaining({ api: expect.objectContaining({ apiKey: "replacement" }) }) }) }), target);
});
