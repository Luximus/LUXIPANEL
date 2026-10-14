// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Integration / characterization tests — webhooks module HTTP contract.
 *
 * Locks:
 *   - the public ingest endpoint `/api/hooks/in/:token` (any method, JSON
 *     status pass-through, and the SECURITY regression that a service failure
 *     surfaces as a TYPED error via the shared errorHandler — never a raw
 *     `res.status(500).json(...)` leaking a stack).
 *   - the authenticated webhooks router rejects requests with no session (401).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.helper.js";

// ── Mocks ────────────────────────────────────────────────────────────────

// Ingest controller → service seam. Control the ingest outcome per-test.
vi.mock("../../modules/webhooks/services/gateway-webhook.service.js", () => ({
  gatewayWebhookService: { ingest: vi.fn() },
  API_KEY_HEADER: "x-make-apikey",
}));

// requireAuth needs the auth config + user repo; mirror the mail integration test.
vi.mock("../../config/auth.js", () => ({
  authConfig: {
    jwt: { secret: "test-secret-key-at-least-32-characters-long!!", expiresIn: "1h", rememberExpiresIn: "7d" },
    cookie: {
      sessionName: "luxipanel_session",
      csrfName: "luxipanel_csrf",
      secure: false,
      sameSite: "lax" as const,
      domain: "",
      legacyDomains: [],
    },
  },
}));

vi.mock("../../modules/auth/repositories/index.js", () => ({
  panelUserRepository: { findAllWithRoles: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  auditRepository: { append: vi.fn().mockResolvedValue(undefined) },
}));

import { webhookIngestPublicRouter } from "../../modules/webhooks/routes/ingest.routes.js";
import { webhooksRouter } from "../../modules/webhooks/routes/webhooks.routes.js";
import { gatewayWebhookService } from "../../modules/webhooks/services/gateway-webhook.service.js";

const app = buildTestApp([
  (a) => a.use(webhookIngestPublicRouter),
  (a) => a.use(webhooksRouter),
]);

beforeEach(() => vi.clearAllMocks());

describe("public ingest — /api/hooks/in/:token", () => {
  it("passes the service status + body straight through (200)", async () => {
    vi.mocked(gatewayWebhookService.ingest).mockResolvedValue({ status: 200, body: { ok: true, accepted: true } });
    const res = await request(app).post("/api/hooks/in/tok123").send({ a: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, accepted: true });
  });

  it("passes non-2xx service outcomes through (404 unknown token)", async () => {
    vi.mocked(gatewayWebhookService.ingest).mockResolvedValue({ status: 404, body: { ok: false, error: "Webhook not found" } });
    const res = await request(app).post("/api/hooks/in/nope").send({});
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  it("accepts any HTTP method (GET/PUT), like a Make.com custom webhook", async () => {
    vi.mocked(gatewayWebhookService.ingest).mockResolvedValue({ status: 200, body: { ok: true } });
    expect((await request(app).get("/api/hooks/in/tok")).status).toBe(200);
    expect((await request(app).put("/api/hooks/in/tok").send({})).status).toBe(200);
    expect(gatewayWebhookService.ingest).toHaveBeenCalledTimes(2);
  });

  it("SECURITY: a service failure becomes a typed error (no leaked stack)", async () => {
    vi.mocked(gatewayWebhookService.ingest).mockRejectedValue(new Error("kaboom internal detail"));
    const res = await request(app).post("/api/hooks/in/tok").send({});
    expect(res.status).toBe(500);
    // Typed error shape from the shared errorHandler; never the raw Error message.
    expect(res.body.ok).toBe(false);
    expect(res.body.code).toBe("INGEST_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("kaboom internal detail");
  });
});

describe("authenticated webhooks router", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).get("/api/webhooks/events");
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });
});
