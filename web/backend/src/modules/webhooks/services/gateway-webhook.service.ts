// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Gateway webhook service — business logic for inbound (receive-data) webhooks:
 * key hashing, token generation, and the ingest pipeline (auth → IP → data
 * structure validation → payload storage).
 *
 * Pure-ish: no Express types. Controllers adapt the request/response.
 */

import { randomUUID } from "node:crypto";
import { randomBase64url, sha256, safeEqual } from "../../../shared/utils/crypto.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { gatewayWebhookRepository } from "../repositories/gateway-webhook.repository.js";
import {
  API_KEY_HEADER,
  MAX_PAYLOAD_SAMPLES,
  type GatewayApiKey,
  type GatewayPayloadSample,
  type GatewayWebhook,
} from "../models/gateway-webhook.model.js";
import { validateDataStructure } from "./data-structure-validator.js";
import { ipAllowed } from "./ip-allowlist.js";

const log = createModuleLogger("gateway-webhooks");

// ── Per-token ingest rate limit ─────────────────────────────────────────────
// `/api/hooks/in/:token` is public and by default requires no API key/IP, and
// every accepted delivery rewrites the gateway sidecar. Cap deliveries per
// token per window so a hostile emitter can't drive continuous rewrites.
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_BUCKET_CAP = 5_000;
const _rateBuckets = new Map<string, { count: number; resetAt: number }>();

function ingestRateLimited(token: string): boolean {
  const now = Date.now();
  let bucket = _rateBuckets.get(token);
  if (!bucket || bucket.resetAt <= now) {
    if (_rateBuckets.size >= RATE_BUCKET_CAP && !_rateBuckets.has(token)) {
      const oldest = _rateBuckets.keys().next().value;
      if (oldest !== undefined) _rateBuckets.delete(oldest);
    }
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    _rateBuckets.set(token, bucket);
  }
  bucket.count++;
  return bucket.count > RATE_LIMIT_MAX;
}

/** Build a stored API key record from a plaintext value (value is discarded). */
export function buildApiKey(name: string, value: string): GatewayApiKey {
  return {
    id: randomUUID(),
    name: name.trim() || "API key",
    keyHash: sha256(value),
    keyPrefix: value.slice(0, 4),
  };
}

/** Generate a fresh, URL-safe ingest token. */
export function newToken(): string {
  return randomBase64url(18);
}

export interface IngestInput {
  method: string;
  ip: string;
  apiKeyHeader: string | undefined;
  headers: Record<string, unknown>;
  query: Record<string, unknown>;
  body: unknown;
  rawBody: string | undefined;
}

export interface IngestResult {
  status: number;
  body: Record<string, unknown>;
}

export const gatewayWebhookService = {
  /**
   * Process an inbound delivery for the gateway identified by `token`.
   * Returns the HTTP status + JSON body the public endpoint should reply with.
   */
  async ingest(token: string, input: IngestInput): Promise<IngestResult> {
    const gw = await gatewayWebhookRepository.findByToken(token);
    if (!gw) return { status: 404, body: { ok: false, error: "Webhook not found" } };
    if (!gw.enabled) return { status: 403, body: { ok: false, error: "Webhook disabled" } };

    // ── 0. Per-token rate limit (public endpoint, guards the write path) ──
    if (ingestRateLimited(token)) {
      log.warn({ id: gw.id, ip: input.ip }, "gateway ingest rate-limited");
      return { status: 429, body: { ok: false, error: "Too many requests" } };
    }

    // ── 1. IP restriction ──
    if (!ipAllowed(gw.ipRestrictions ?? "", input.ip)) {
      log.warn({ id: gw.id, ip: input.ip }, "gateway ingest blocked by IP allowlist");
      return { status: 403, body: { ok: false, error: "IP not allowed" } };
    }

    // ── 2. API key authentication (if any key configured, one must match) ──
    if ((gw.apiKeys ?? []).length > 0) {
      const provided = (input.apiKeyHeader ?? "").trim();
      const providedHash = provided ? sha256(provided) : "";
      const granted =
        provided.length > 0 &&
        gw.apiKeys.some((k) => safeEqual(k.keyHash, providedHash));
      if (!granted) {
        log.warn({ id: gw.id, ip: input.ip }, "gateway ingest rejected: bad/missing API key");
        return { status: 401, body: { ok: false, error: "Invalid API key" } };
      }
    }

    // ── 3. Assemble the incoming data (query string merged with JSON body) ──
    const bodyObj =
      input.body && typeof input.body === "object" && !Array.isArray(input.body)
        ? (input.body as Record<string, unknown>)
        : {};
    const merged: Record<string, unknown> = { ...input.query, ...bodyObj };

    // ── 4. Data-structure validation ──
    const validation = validateDataStructure(gw.dataStructure, merged);
    if (!validation.ok) {
      return {
        status: 400,
        body: { ok: false, error: "Payload validation failed", details: validation.errors },
      };
    }

    // ── 5. Build the payload to store, honouring the advanced toggles ──
    let stored: unknown;
    if (gw.jsonPassThrough) {
      stored = input.rawBody ?? JSON.stringify(validation.value);
    } else {
      const obj: Record<string, unknown> = { ...validation.value };
      if (gw.getRequestHeaders) obj.__headers = input.headers;
      if (gw.getRequestHttpMethod) obj.__method = input.method;
      stored = obj;
    }

    const sample: GatewayPayloadSample = {
      id: randomUUID(),
      receivedAt: new Date().toISOString(),
      method: input.method,
      ip: input.ip,
      data: stored,
    };

    // ── 6. Persist (ring buffer + counters) — atomic, race-safe ──
    await gatewayWebhookRepository.recordDelivery(gw.id, sample, MAX_PAYLOAD_SAMPLES);

    return { status: 200, body: { ok: true, accepted: true } };
  },
};

/** Apply create/update form input onto a gateway field set. Shared by the
 *  controller for both POST (create) and PUT (update) so the mapping lives in
 *  one place. Returns the persisted-shape patch. */
export function mergeApiKeys(
  existing: GatewayApiKey[],
  incoming: Array<{ id?: string; name: string; value?: string }>,
): GatewayApiKey[] {
  const byId = new Map(existing.map((k) => [k.id, k]));
  const out: GatewayApiKey[] = [];
  for (const item of incoming) {
    if (item.value && item.value.trim()) {
      // New value provided → (re)hash.
      const built = buildApiKey(item.name, item.value.trim());
      out.push(item.id ? { ...built, id: item.id } : built);
    } else if (item.id && byId.has(item.id)) {
      // Keep existing hash, allow rename.
      const cur = byId.get(item.id)!;
      out.push({ ...cur, name: item.name.trim() || cur.name });
    }
    // else: incomplete row (no value, no existing id) → skip.
  }
  return out;
}

export { API_KEY_HEADER };
export type { GatewayWebhook };
