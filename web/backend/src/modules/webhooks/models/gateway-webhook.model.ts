// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Gateway webhooks — the panel-hosted, *inbound* webhook receivers.
 *
 * Unlike the legacy `webhooks` table (outbound HMAC event delivery), a gateway
 * webhook is an endpoint the panel HOSTS and that external systems call to
 * push data IN — modelled after the Make.com "Custom webhook" family.
 *
 * The module is organised into three categories. Only `receive-data` is
 * functional today; `mailhook` and `response` are reserved placeholders whose
 * scanning/criteria are defined in later phases.
 *
 *   • receive-data — HTTP endpoint that accepts incoming requests, optionally
 *                    authenticated with an `x-make-apikey` header, IP-restricted,
 *                    and validated against a data structure. Payloads are stored.
 *   • mailhook     — (placeholder) receives data via a dedicated email address.
 *   • response     — (placeholder) returns a custom response to a caller.
 *
 * These are INSTANCE-level state (panel host), not per-server: the public
 * ingest endpoint has no SSH session/executor, so the store is always read
 * through `localExecutor`. See repositories/gateway-webhook.repository.ts.
 */

export const WEBHOOK_CATEGORIES = ["receive-data", "mailhook", "response"] as const;
export type WebhookCategory = (typeof WEBHOOK_CATEGORIES)[number];

/** Header used to carry the API key, mirroring Make.com's `x-make-apikey`. */
export const API_KEY_HEADER = "x-make-apikey";

/** Field types supported by a data-structure validation spec. */
export const DATA_FIELD_TYPES = [
  "text",
  "number",
  "boolean",
  "date",
  "array",
  "collection",
] as const;
export type DataFieldType = (typeof DATA_FIELD_TYPES)[number];

/** One item of a data-structure specification (see "Add data structure" UI). */
export interface DataStructureField {
  name: string;
  description?: string;
  type: DataFieldType;
  /** Default applied when the field is absent from the incoming payload. */
  defaultValue?: string;
  required: boolean;
  /** Hint only (text fields); does not affect validation. */
  multiline: boolean;
}

/** Optional validation spec for incoming data. Empty => pass-through. */
export interface DataStructure {
  name?: string;
  /** When true, unknown (not-specified) keys are rejected. */
  strict: boolean;
  fields: DataStructureField[];
}

/**
 * An API key accepted by a gateway. The plaintext value is shown to the user
 * once (on creation) and never persisted — only the SHA-256 hash + a short
 * prefix hint are stored, mirroring the panel's existing api-key handling.
 */
export interface GatewayApiKey {
  id: string;
  name: string;
  /** SHA-256(value), hex. */
  keyHash: string;
  /** First chars of the value, for a non-revealing UI hint. */
  keyPrefix: string;
}

/** A stored sample of a received payload, kept as a small ring buffer. */
export interface GatewayPayloadSample {
  id: string;
  receivedAt: string;
  method: string;
  ip: string;
  /** The processed payload (validated/coerced, possibly with headers/method). */
  data: unknown;
}

/** Max payload samples retained per gateway (newest first). */
export const MAX_PAYLOAD_SAMPLES = 25;

export interface GatewayWebhook {
  id: number;
  category: WebhookCategory;
  /** Human-readable name (1..128 chars). */
  name: string;
  /** Opaque URL path token; the public endpoint is /api/hooks/in/<token>. */
  token: string;
  enabled: boolean;
  /** Accepted API keys. Empty => no API-key authentication. */
  apiKeys: GatewayApiKey[];
  /** Comma-separated IP/CIDR allowlist. Empty => no IP restriction. */
  ipRestrictions: string;
  /** Optional incoming-data validation. null => accept any payload. */
  dataStructure: DataStructure | null;
  /** Add request headers to the stored body. */
  getRequestHeaders: boolean;
  /** Add the HTTP method (verb) to the stored body. */
  getRequestHttpMethod: boolean;
  /** Store the JSON payload as a string instead of a parsed object. */
  jsonPassThrough: boolean;
  /** Lifetime count of accepted deliveries. */
  receivedCount: number;
  lastReceivedAt: string | null;
  /** Ring buffer of recent payloads (newest first), capped at MAX_PAYLOAD_SAMPLES. */
  recentPayloads: GatewayPayloadSample[];
  createdAt: string;
  updatedAt: string;
}

/** Shape returned to the UI (never leaks key hashes wholesale beyond hints). */
export type GatewayWebhookPublic = Omit<GatewayWebhook, "apiKeys"> & {
  apiKeys: Array<Pick<GatewayApiKey, "id" | "name" | "keyPrefix">>;
};

/** Strip secrets/bulk for list/detail responses. */
export function toPublic(w: GatewayWebhook): GatewayWebhookPublic {
  return {
    ...w,
    apiKeys: (w.apiKeys ?? []).map((k) => ({ id: k.id, name: k.name, keyPrefix: k.keyPrefix })),
  };
}
