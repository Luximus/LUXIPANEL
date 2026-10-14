// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — the tolqia.com ACCOUNT link (token per server).
 *
 * Three things are worth pinning down:
 *
 *  1. the credential never sits in the sidecar in the clear, and a payload we
 *     cannot decrypt degrades to "not linked" instead of throwing on every call;
 *  2. `PUT` refuses both a malformed token and one Tolqia rejects — we never
 *     store a credential we could not use;
 *  3. `plan` (the endpoint EVERY user may call) leaks neither token nor preview.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../config/env.js", () => ({
  env: {
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    TOLQIA_URL: "http://127.0.0.1:4500",
    // 64 hex → the explicit vault key path (no JWT-derived fallback warning).
    CREDENTIAL_VAULT_KEY: "a".repeat(64),
  },
}));

vi.mock("../../../config/auth.js", () => ({
  authConfig: { jwt: { secret: "test-jwt-secret" } },
}));

// In-memory stand-in for the per-server sidecar. `raw` is what would actually
// be written to `chat/tolqia-credential.json`, so the tests can assert on it.
const { raw } = vi.hoisted(() => ({ raw: new Map<string, Record<string, unknown>>() }));

vi.mock("../../../shared/kv-store/index.js", () => ({
  kv: () => ({
    module: () => ({
      collection: () => ({
        async get(id: string) {
          const doc = raw.get(id);
          return doc ? { ...doc, id } : null;
        },
        async set(id: string, value: Record<string, unknown>) {
          raw.set(id, value);
          return { ...value, id };
        },
        async delete(id: string) {
          return raw.delete(id);
        },
      }),
    }),
  }),
}));

import {
  tolqiaCredentialRepository,
  previewOf,
  TOLQIA_TOKEN_RE,
} from "../repositories/tolqia-credential.repository.js";
import {
  tolqiaAccountService,
  parseAccount,
  summarize,
  __resetTolqiaAccountCache,
} from "./tolqia-account.service.js";
import type { Executor } from "../../../shared/executor/index.js";

const executor = { target: { id: "t1", name: "t1" } } as unknown as Executor;

const TOKEN = `tq_live_${"b".repeat(40)}`;
const OTHER_TOKEN = `tq_live_${"c".repeat(40)}`;

/** The body `GET /v1/calls/account` answers with. */
function accountBody(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    data: {
      user: { id: "u1", displayName: "Example User" },
      plan: "plus",
      status: "active",
      limits: { translationParticipants: 4, maxGroups: 10, maxMembers: 25 },
      usage: { minutes: 12 },
      credentials: { elevenlabs: true, openai: false },
      ...overrides,
    },
  };
}

let responses: Array<{ status: number; body: unknown }>;
let requests: Array<{ url: string; init: RequestInit }>;

beforeEach(() => {
  raw.clear();
  responses = [];
  requests = [];
  __resetTolqiaAccountCache();
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown, init: RequestInit) => {
      requests.push({ url: String(input), init });
      const next = responses.shift() ?? { status: 500, body: { error: "no canned response" } };
      return Promise.resolve({
        ok: next.status >= 200 && next.status < 300,
        status: next.status,
        json: async () => next.body,
      } as Response);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("formato del token", () => {
  it("acepta tq_live_ + 40 y rechaza todo lo demás", () => {
    expect(TOLQIA_TOKEN_RE.test(TOKEN)).toBe(true);
    expect(TOLQIA_TOKEN_RE.test(`tq_live_${"b".repeat(39)}`)).toBe(false);
    expect(TOLQIA_TOKEN_RE.test(`tq_test_${"b".repeat(40)}`)).toBe(false);
    expect(TOLQIA_TOKEN_RE.test(`tq_live_${"b".repeat(39)}-`)).toBe(false);
  });

  it("la vista previa son 12 caracteres y nunca el token entero", () => {
    expect(previewOf(TOKEN)).toBe("tq_live_bbbb");
    expect(TOKEN.startsWith(previewOf(TOKEN))).toBe(true);
    expect(previewOf(TOKEN).length).toBeLessThan(TOKEN.length);
  });
});

describe("repositorio (cifrado en reposo)", () => {
  it("guarda cifrado y devuelve el claro solo por token()", async () => {
    await tolqiaCredentialRepository.save(executor, TOKEN, "operator");

    const stored = raw.get("token") as { token: string };
    expect(stored.token.startsWith("v2:")).toBe(true);
    // Lo que acaba en el sidecar NO contiene el secreto.
    expect(stored.token).not.toContain(TOKEN);
    expect(JSON.stringify(stored)).not.toContain(TOKEN);

    expect(await tolqiaCredentialRepository.token(executor)).toBe(TOKEN);
  });

  it("redacted() expone presencia y prefijo, nunca el token", async () => {
    expect(await tolqiaCredentialRepository.redacted(executor)).toMatchObject({ tokenSet: false });
    await tolqiaCredentialRepository.save(executor, TOKEN);
    const view = await tolqiaCredentialRepository.redacted(executor);
    expect(view).toMatchObject({ tokenSet: true, tokenPreview: "tq_live_bbbb" });
    expect(JSON.stringify(view)).not.toContain(TOKEN);
  });

  it("un payload que no descifra se comporta como 'sin token' (no revienta)", async () => {
    await tolqiaCredentialRepository.save(executor, TOKEN);
    const stored = raw.get("token") as { token: string };
    // Simula una rotación de clave / un byte manipulado en el tag.
    raw.set("token", { ...stored, token: `${stored.token.slice(0, -2)}ff` });
    expect(await tolqiaCredentialRepository.token(executor)).toBeNull();
    expect(await tolqiaCredentialRepository.redacted(executor)).toMatchObject({ tokenSet: false });
  });

  it("clear() desenlaza y es idempotente", async () => {
    await tolqiaCredentialRepository.save(executor, TOKEN);
    expect(await tolqiaCredentialRepository.clear(executor)).toEqual({ tokenSet: false, tokenPreview: "" });
    expect(await tolqiaCredentialRepository.clear(executor)).toEqual({ tokenSet: false, tokenPreview: "" });
    expect(await tolqiaCredentialRepository.token(executor)).toBeNull();
  });
});

describe("parseAccount / summarize", () => {
  it("lee el sobre {ok,data} y también un data pelado", () => {
    expect(parseAccount(accountBody())).toMatchObject({ plan: "plus", status: "active" });
    expect(parseAccount({ plan: "premium", status: "past_due" })).toMatchObject({
      plan: "premium",
      status: "past_due",
    });
  });

  it("un límite ausente es 'sin límite' (null), no un 0", () => {
    const parsed = parseAccount({ plan: "premium" })!;
    expect(parsed.limits).toEqual({
      translationParticipants: null,
      maxGroups: null,
      maxMembers: null,
    });
    expect(summarize(parsed)).toContain("sin límite");
  });

  it("sin plan no hay cuenta", () => {
    expect(parseAccount({ ok: true, data: {} })).toBeNull();
    expect(parseAccount(null)).toBeNull();
  });

  it("resume plan, estado y límites en una línea", () => {
    const parsed = parseAccount(accountBody())!;
    const line = summarize(parsed);
    expect(line).toContain("Plan Plus");
    expect(line).toContain("activo");
    expect(line).toContain("hasta 4 participantes");
  });
});

describe("setToken", () => {
  it("rechaza un formato inválido sin llamar a Tolqia", async () => {
    await expect(tolqiaAccountService.setToken(executor, "nope")).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(requests).toHaveLength(0);
    expect(raw.size).toBe(0);
  });

  it("valida contra GET /v1/calls/account antes de guardar", async () => {
    responses = [{ status: 200, body: accountBody() }];
    const saved = await tolqiaAccountService.setToken(executor, TOKEN, "operator");

    expect(requests[0]!.url).toBe("http://127.0.0.1:4500/v1/calls/account");
    expect(String(requests[0]!.init.headers?.["authorization" as never])).toBe(`Bearer ${TOKEN}`);
    expect(saved).toMatchObject({ tokenSet: true, tokenPreview: "tq_live_bbbb" });
    expect(saved.account).toMatchObject({ plan: "plus" });
    expect(saved.accountSummary).toContain("Plan Plus");
  });

  it("un token que Tolqia rechaza es un 400 y NO se guarda", async () => {
    responses = [{ status: 401, body: { ok: false } }];
    await expect(tolqiaAccountService.setToken(executor, TOKEN)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(raw.size).toBe(0);
  });

  it("un plan que Tolqia no acepta tampoco se guarda", async () => {
    responses = [{ status: 403, body: { ok: false } }];
    await expect(tolqiaAccountService.setToken(executor, TOKEN)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(raw.size).toBe(0);
  });
});

describe("getConfig (caché de 5 min)", () => {
  it("no vuelve a preguntar a Tolqia dentro de la ventana", async () => {
    responses = [{ status: 200, body: accountBody() }];
    await tolqiaAccountService.setToken(executor, TOKEN);
    const calls = requests.length;

    const cfg = await tolqiaAccountService.getConfig(executor);
    expect(cfg.account).toMatchObject({ plan: "plus" });
    expect(requests).toHaveLength(calls); // sin nueva llamada
  });

  it("un token distinto invalida la entrada cacheada", async () => {
    responses = [{ status: 200, body: accountBody() }];
    await tolqiaAccountService.setToken(executor, TOKEN);
    responses = [{ status: 200, body: accountBody({ plan: "premium" }) }];
    await tolqiaAccountService.setToken(executor, OTHER_TOKEN);

    const cfg = await tolqiaAccountService.getConfig(executor);
    expect(cfg.account).toMatchObject({ plan: "premium" });
  });

  it("sin token no consulta nada", async () => {
    const cfg = await tolqiaAccountService.getConfig(executor);
    expect(cfg).toEqual({ tokenSet: false, tokenPreview: "" });
    expect(requests).toHaveLength(0);
  });
});

describe("test()", () => {
  it("sin token configurado responde valid:false con mensaje (nunca lanza)", async () => {
    await expect(tolqiaAccountService.test(executor)).resolves.toMatchObject({
      valid: false,
      plan: null,
      limits: null,
    });
  });

  it("devuelve plan y límites de la cuenta", async () => {
    responses = [{ status: 200, body: accountBody() }];
    const result = await tolqiaAccountService.test(executor, TOKEN);
    expect(result).toMatchObject({
      valid: true,
      plan: "plus",
      limits: { translationParticipants: 4, maxGroups: 10, maxMembers: 25 },
    });
  });

  it("Tolqia caído es valid:false, no una excepción", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))));
    await expect(tolqiaAccountService.test(executor, TOKEN)).resolves.toMatchObject({ valid: false });
  });
});

describe("plan() — lo que ve CUALQUIER usuario", () => {
  it("sin enlace: no configurado y sin traducción", async () => {
    await expect(tolqiaAccountService.plan(executor)).resolves.toEqual({
      configured: false,
      plan: null,
      status: null,
      limits: null,
      translationAvailable: false,
    });
  });

  it("con plan activo hay traducción, y la respuesta no lleva token ni prefijo", async () => {
    responses = [{ status: 200, body: accountBody() }];
    await tolqiaAccountService.setToken(executor, TOKEN);
    const view = await tolqiaAccountService.plan(executor);
    expect(view).toMatchObject({ configured: true, plan: "plus", translationAvailable: true });
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).not.toContain("tq_live_");
    expect(serialized).not.toContain("Example User");
  });

  it("con la suscripción impagada el enlace existe pero no hay traducción", async () => {
    responses = [{ status: 200, body: accountBody({ status: "past_due" }) }];
    await tolqiaAccountService.setToken(executor, TOKEN);
    await expect(tolqiaAccountService.plan(executor)).resolves.toMatchObject({
      configured: true,
      status: "past_due",
      translationAvailable: false,
    });
  });
});
