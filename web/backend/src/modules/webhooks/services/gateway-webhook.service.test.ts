// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization tests — webhooks/services/gateway-webhook.service.ts
 *
 * Locks the observable contract of the inbound (receive-data) ingest pipeline
 * and the pure helpers (buildApiKey / newToken / mergeApiKeys). The ingest
 * pipeline's status codes and stored-payload shape are a public contract that
 * external callers (Make.com-style webhooks) depend on.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the repository BEFORE importing the service under test.
vi.mock("../repositories/gateway-webhook.repository.js", () => ({
  gatewayWebhookRepository: {
    findByToken: vi.fn(),
    update: vi.fn(async () => undefined),
    recordDelivery: vi.fn(async () => undefined),
  },
}));

import {
  gatewayWebhookService,
  buildApiKey,
  newToken,
  mergeApiKeys,
} from "./gateway-webhook.service.js";
import { gatewayWebhookRepository } from "../repositories/gateway-webhook.repository.js";
import { sha256 } from "../../../shared/utils/crypto.js";
import type { GatewayWebhook, GatewayApiKey } from "../models/gateway-webhook.model.js";

function makeGateway(partial: Partial<GatewayWebhook> = {}): GatewayWebhook {
  return {
    id: 1,
    category: "receive-data",
    name: "GW",
    token: "tok",
    enabled: true,
    apiKeys: [],
    ipRestrictions: "",
    dataStructure: null,
    getRequestHeaders: false,
    getRequestHttpMethod: false,
    jsonPassThrough: false,
    receivedCount: 0,
    lastReceivedAt: null,
    recentPayloads: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function baseInput() {
  return {
    method: "POST",
    ip: "1.2.3.4",
    apiKeyHeader: undefined as string | undefined,
    headers: { "content-type": "application/json" } as Record<string, unknown>,
    query: {} as Record<string, unknown>,
    body: {} as unknown,
    rawBody: undefined as string | undefined,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(gatewayWebhookRepository.update).mockResolvedValue(undefined as never);
});

describe("gatewayWebhookService.ingest — gating", () => {
  it("404 when token is unknown", async () => {
    vi.mocked(gatewayWebhookRepository.findByToken).mockResolvedValue(undefined);
    const r = await gatewayWebhookService.ingest("nope", baseInput());
    expect(r.status).toBe(404);
    expect(r.body.ok).toBe(false);
  });

  it("403 when gateway is disabled", async () => {
    vi.mocked(gatewayWebhookRepository.findByToken).mockResolvedValue(makeGateway({ enabled: false }));
    const r = await gatewayWebhookService.ingest("tok", baseInput());
    expect(r.status).toBe(403);
  });

  it("403 when the client IP is not in the allowlist", async () => {
    vi.mocked(gatewayWebhookRepository.findByToken).mockResolvedValue(
      makeGateway({ ipRestrictions: "9.9.9.9" }),
    );
    const r = await gatewayWebhookService.ingest("tok", { ...baseInput(), ip: "1.2.3.4" });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("IP not allowed");
  });

  it("401 when an API key is required but missing/wrong", async () => {
    const key = buildApiKey("k", "secret-value");
    vi.mocked(gatewayWebhookRepository.findByToken).mockResolvedValue(
      makeGateway({ apiKeys: [key] }),
    );
    const missing = await gatewayWebhookService.ingest("tok", baseInput());
    expect(missing.status).toBe(401);

    const wrong = await gatewayWebhookService.ingest("tok", {
      ...baseInput(),
      apiKeyHeader: "wrong",
    });
    expect(wrong.status).toBe(401);
  });

  it("200 when the correct API key is supplied", async () => {
    const key = buildApiKey("k", "secret-value");
    vi.mocked(gatewayWebhookRepository.findByToken).mockResolvedValue(
      makeGateway({ apiKeys: [key] }),
    );
    const r = await gatewayWebhookService.ingest("tok", {
      ...baseInput(),
      apiKeyHeader: "secret-value",
    });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, accepted: true });
  });
});

describe("gatewayWebhookService.ingest — validation + storage", () => {
  it("400 when the payload fails data-structure validation", async () => {
    vi.mocked(gatewayWebhookRepository.findByToken).mockResolvedValue(
      makeGateway({
        dataStructure: {
          name: "",
          strict: false,
          fields: [{ name: "email", description: "", type: "text", required: true, multiline: false }],
        },
      }),
    );
    const r = await gatewayWebhookService.ingest("tok", baseInput());
    expect(r.status).toBe(400);
    expect(Array.isArray((r.body as { details?: unknown }).details)).toBe(true);
    expect(gatewayWebhookRepository.update).not.toHaveBeenCalled();
  });

  it("merges query + body and records a delivery sample (ring buffer + counters in the repo)", async () => {
    const gw = makeGateway({ receivedCount: 2 });
    vi.mocked(gatewayWebhookRepository.findByToken).mockResolvedValue(gw);
    const r = await gatewayWebhookService.ingest("tok", {
      ...baseInput(),
      query: { q: "1" },
      body: { b: "2" },
    });
    expect(r.status).toBe(200);
    // The ring-buffer append + counter bump is now atomic inside the repository
    // (`recordDelivery`); the service just assembles the sample and delegates,
    // passing the cap so the repo can trim.
    expect(gatewayWebhookRepository.recordDelivery).toHaveBeenCalledTimes(1);
    const [id, sample, cap] = vi.mocked(gatewayWebhookRepository.recordDelivery).mock.calls[0]!;
    expect(id).toBe(gw.id);
    expect(cap).toBe(25); // MAX_PAYLOAD_SAMPLES
    expect(sample.data).toMatchObject({ q: "1", b: "2" });
  });

  it("delegates the ring-buffer cap (MAX_PAYLOAD_SAMPLES) to recordDelivery", async () => {
    vi.mocked(gatewayWebhookRepository.findByToken).mockResolvedValue(makeGateway());
    await gatewayWebhookService.ingest("tok", { ...baseInput(), body: { fresh: true } });
    const [, sample, cap] = vi.mocked(gatewayWebhookRepository.recordDelivery).mock.calls[0]!;
    expect(cap).toBe(25);
    expect(sample.data).toEqual({ fresh: true });
  });

  it("getRequestHeaders / getRequestHttpMethod add __headers / __method", async () => {
    vi.mocked(gatewayWebhookRepository.findByToken).mockResolvedValue(
      makeGateway({ getRequestHeaders: true, getRequestHttpMethod: true }),
    );
    await gatewayWebhookService.ingest("tok", { ...baseInput(), body: { a: 1 } });
    const [, sample] = vi.mocked(gatewayWebhookRepository.recordDelivery).mock.calls[0]!;
    const data = sample.data as Record<string, unknown>;
    expect(data.__method).toBe("POST");
    expect(data.__headers).toMatchObject({ "content-type": "application/json" });
  });

  it("jsonPassThrough stores the raw body string", async () => {
    vi.mocked(gatewayWebhookRepository.findByToken).mockResolvedValue(
      makeGateway({ jsonPassThrough: true }),
    );
    await gatewayWebhookService.ingest("tok", {
      ...baseInput(),
      body: { a: 1 },
      rawBody: '{"a":1}',
    });
    const [, sample] = vi.mocked(gatewayWebhookRepository.recordDelivery).mock.calls[0]!;
    expect(sample.data).toBe('{"a":1}');
  });
});

describe("gateway pure helpers", () => {
  it("buildApiKey hashes the value and keeps only a 4-char prefix", () => {
    const k = buildApiKey("My Key", "supersecret");
    expect(k.keyHash).toBe(sha256("supersecret"));
    expect(k.keyPrefix).toBe("supe");
    expect(k.name).toBe("My Key");
    expect(k.id).toMatch(/[0-9a-f-]{36}/);
  });

  it("newToken returns a URL-safe token", () => {
    const t = newToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThan(10);
  });

  it("mergeApiKeys rehashes a new value, preserves existing hash on rename, skips incomplete rows", () => {
    const existing: GatewayApiKey[] = [{ id: "keep", name: "old", keyHash: "H", keyPrefix: "abcd" }];
    const out = mergeApiKeys(existing, [
      { id: "keep", name: "renamed" }, // keep hash, rename
      { name: "brand-new", value: "new-value" }, // rehash
      { name: "incomplete" }, // no value, no id → skip
    ]);
    expect(out).toHaveLength(2);
    const kept = out.find((k) => k.id === "keep")!;
    expect(kept.keyHash).toBe("H");
    expect(kept.name).toBe("renamed");
    const fresh = out.find((k) => k.name === "brand-new")!;
    expect(fresh.keyHash).toBe(sha256("new-value"));
  });
});
