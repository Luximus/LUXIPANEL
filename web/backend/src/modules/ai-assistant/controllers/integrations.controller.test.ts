// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * ElevenLabs integration — controller + service.
 *
 * Covers: redaction (the key never leaves), PUT/DELETE round-trip, the
 * key-preserving PUT, the `/test` fetch probe (mocked, incl. network failure
 * ⇒ 200 + valid:false), `resolveCallProviderCredentials`, and the admin gate
 * (the routes hang off the same `protectedRouter` as `PUT /api/ai/config`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.JWT_SECRET ??= "x".repeat(40);
process.env.LICENSE_SERVER_URL ??= "http://127.0.0.1:3300";

// The controllers resolve the per-request executor; in unit tests there is no
// bridged session, so hand them a stub (the repository is stubbed too).
vi.mock("../../../shared/executor/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/executor/index.js")>();
  return { ...actual, getExecutor: () => ({ id: "test" }) };
});

import {
  defaultAssistantConfig,
  redactAssistantConfig,
  redactIntegrationsConfig,
  type AssistantConfig,
} from "../models/assistant-config.types.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import {
  assistantIntegrationsService,
  resolveCallProviderCredentials,
} from "../services/integrations.service.js";
import { assistantIntegrationsController } from "./integrations.controller.js";
import type { Executor } from "../../../shared/executor/index.js";

const KEY = "sk_elevenlabs_secret_abcd";

/** In-memory stand-in for the `0600` sidecar the repository normally writes. */
let stored: AssistantConfig;

function installRepoStub() {
  stored = defaultAssistantConfig();
  vi.spyOn(assistantConfigRepository, "load").mockImplementation(async () => stored);
  vi.spyOn(assistantConfigRepository, "save").mockImplementation(async (cfg: AssistantConfig) => {
    stored = cfg;
    return cfg;
  });
  vi.spyOn(assistantConfigRepository, "patch").mockImplementation(async (patch) => {
    stored = {
      ...stored,
      ...patch,
      integrations: {
        ...(stored.integrations ?? {}),
        ...(patch.integrations ?? {}),
      },
    } as AssistantConfig;
    return stored;
  });
}

const executor = { id: "test" } as unknown as Executor;

/**
 * Minimal express double. `asyncHandler` does not return its promise, so the
 * settle happens through `res.json` (resolve) or `next(err)` (reject).
 */
function callHandler(
  handler: (req: never, res: never, next: never) => unknown,
  body?: unknown,
): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const req = { body, params: {}, query: {}, headers: {} } as never;
    const res = { json: (b: unknown) => resolve(b as Record<string, any>) } as never;
    const next = ((err: unknown) => reject(err ?? new Error("next() with no error"))) as never;
    handler(req, res, next);
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  installRepoStub();
});

describe("redactIntegrationsConfig", () => {
  it("never exposes the apiKey, only presence + a ••••abcd preview", () => {
    const red = redactIntegrationsConfig({ elevenlabs: { apiKey: KEY, defaultVoiceId: "v1" } });
    expect(red.elevenlabs.apiKeySet).toBe(true);
    expect(red.elevenlabs.apiKeyPreview).toBe(`••••${KEY.slice(-4)}`);
    expect(red.elevenlabs.defaultVoiceId).toBe("v1");
    expect(JSON.stringify(red)).not.toContain(KEY);
  });

  it("reports the empty state when there is no integration", () => {
    const red = redactIntegrationsConfig(undefined);
    expect(red.elevenlabs).toEqual({ apiKeySet: false, apiKeyPreview: null, defaultVoiceId: null });
  });

  it("is included in the assistant config public view without the key", () => {
    const cfg = defaultAssistantConfig();
    cfg.integrations = { elevenlabs: { apiKey: KEY } };
    const red = redactAssistantConfig(cfg);
    expect(red.integrations.elevenlabs.apiKeySet).toBe(true);
    expect(JSON.stringify(red)).not.toContain(KEY);
  });
});

describe("PUT / GET / DELETE round-trip", () => {
  it("saves the key and returns the redacted shape", async () => {
    const put = await callHandler(assistantIntegrationsController.setElevenLabs as never, {
      apiKey: KEY,
      defaultVoiceId: "voice-9",
    });
    expect(put).toEqual({
      ok: true,
      data: { apiKeySet: true, apiKeyPreview: `••••${KEY.slice(-4)}`, defaultVoiceId: "voice-9" },
    });

    const get = await callHandler(assistantIntegrationsController.getElevenLabs as never);
    expect(get.data).toEqual(put.data);
    expect(JSON.stringify(get)).not.toContain(KEY);
  });

  it("keeps the stored key when PUT omits apiKey (voice-id-only edit)", async () => {
    await assistantIntegrationsService.setElevenLabs({ apiKey: KEY }, executor);
    const out = await assistantIntegrationsService.setElevenLabs({ defaultVoiceId: "vX" }, executor);
    expect(out.apiKeySet).toBe(true);
    expect(out.defaultVoiceId).toBe("vX");
    expect(stored.integrations?.elevenlabs?.apiKey).toBe(KEY);
  });

  it("rejects an apiKey shorter than 8 chars", async () => {
    await expect(
      callHandler(assistantIntegrationsController.setElevenLabs as never, { apiKey: "short" }),
    ).rejects.toThrow();
  });

  it("rejects unknown body fields", async () => {
    await expect(
      callHandler(assistantIntegrationsController.setElevenLabs as never, { nope: 1 }),
    ).rejects.toThrow();
  });

  it("DELETE removes the integration and returns the empty shape", async () => {
    await assistantIntegrationsService.setElevenLabs({ apiKey: KEY }, executor);
    const del = await callHandler(assistantIntegrationsController.clearElevenLabs as never);
    expect(del).toEqual({
      ok: true,
      data: { apiKeySet: false, apiKeyPreview: null, defaultVoiceId: null },
    });
    expect(stored.integrations?.elevenlabs).toBeUndefined();
  });
});

describe("POST /test", () => {
  it("probes api.elevenlabs.io with the xi-api-key header and reports valid", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await callHandler(assistantIntegrationsController.testElevenLabs as never, { apiKey: KEY });
    expect(out.ok).toBe(true);
    expect(out.data.valid).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.elevenlabs.io/v1/user");
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe(KEY);
    vi.unstubAllGlobals();
  });

  it("falls back to the stored key when the body carries none", async () => {
    await assistantIntegrationsService.setElevenLabs({ apiKey: KEY }, executor);
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await callHandler(assistantIntegrationsController.testElevenLabs as never, {});
    expect(out.data.valid).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe(KEY);
    vi.unstubAllGlobals();
  });

  it("reports invalid (not a 5xx) on a 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
    const out = await callHandler(assistantIntegrationsController.testElevenLabs as never, { apiKey: KEY });
    expect(out).toMatchObject({ ok: true, data: { valid: false } });
    expect(typeof out.data.message).toBe("string");
    vi.unstubAllGlobals();
  });

  it("never throws on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const out = await callHandler(assistantIntegrationsController.testElevenLabs as never, { apiKey: KEY });
    expect(out).toMatchObject({ ok: true, data: { valid: false } });
    vi.unstubAllGlobals();
  });

  it("reports invalid without any HTTP call when no key is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await callHandler(assistantIntegrationsController.testElevenLabs as never, {});
    expect(out.data.valid).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("resolveCallProviderCredentials", () => {
  it("returns nothing when no key is configured", async () => {
    expect(await resolveCallProviderCredentials(executor)).toEqual({});
  });

  it("maps codex → openai and the elevenlabs integration (incl. voiceId)", async () => {
    stored.providers.codex.api = { apiKey: "sk-openai-key", model: "gpt-5.6-terra" };
    stored.integrations = { elevenlabs: { apiKey: KEY, defaultVoiceId: "vZ" } };
    expect(await resolveCallProviderCredentials(executor)).toEqual({
      openai: { apiKey: "sk-openai-key" },
      elevenlabs: { apiKey: KEY, voiceId: "vZ" },
    });
  });

  it("omits an empty key and an empty voiceId", async () => {
    stored.providers.codex.api = { apiKey: "   ", model: "m" };
    stored.integrations = { elevenlabs: { apiKey: KEY, defaultVoiceId: "" } };
    expect(await resolveCallProviderCredentials(executor)).toEqual({
      elevenlabs: { apiKey: KEY },
    });
  });
});

describe("admin gating", () => {
  it("mounts the four routes on the same protected router as PUT /api/ai/config", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../routes/ai.routes.ts", import.meta.url), "utf8");
    // `protectedRouter` carries lpPanelCredentialAuth + requireAuth +
    // requireModule("assistant") — the exact gate of `PUT /config`.
    expect(src).toContain('protectedRouter.put("/config", assistantConfigController.patch)');
    for (const line of [
      'protectedRouter.get("/integrations/elevenlabs", assistantIntegrationsController.getElevenLabs)',
      'protectedRouter.put("/integrations/elevenlabs", assistantIntegrationsController.setElevenLabs)',
      'protectedRouter.delete("/integrations/elevenlabs", assistantIntegrationsController.clearElevenLabs)',
      'protectedRouter.post("/integrations/elevenlabs/test", assistantIntegrationsController.testElevenLabs)',
    ]) {
      expect(src).toContain(line);
    }
    // And never on the unauthenticated `router`.
    expect(src).not.toContain('router.get("/api/ai/integrations');
  });
});
