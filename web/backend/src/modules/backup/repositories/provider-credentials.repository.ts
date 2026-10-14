// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Provider-credentials repository — ACCOUNT-LEVEL cloud storage credentials
 * (Cloudflare R2, generic S3), reusable across many backup targets.
 *
 * Unlike per-target `storages` (which bundle a bucket + keys), these hold a
 * single reusable credential per provider so the user configures the keys ONCE
 * (from Settings → Credentials) and backup targets only pick a bucket.
 *
 * Keyed by provider id ("r2" | "s3") in:
 *   ${LUXIPANEL_CONFIG_DIR}/backup/provider-creds.json  (0600 sidecar)
 *
 * `secretAccessKey` is write-only across the API: persisted here, NEVER
 * returned (see {@link toPublic}).
 */

import { kv } from "../../../shared/kv-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { StorageProvider } from "./storage.repository.js";

const MODULE = "backup";
const COLLECTION = "provider-creds";

export interface ProviderCredential {
  /** R2: Cloudflare account id (the endpoint derives from it). */
  accountId?: string;
  /** S3: custom endpoint (optional; AWS infers from region). */
  endpoint?: string;
  /** S3: AWS region. */
  region?: string;
  accessKeyId: string;
  /** Secret — persisted, never returned by the API. */
  secretAccessKey: string;
  updatedAt: string;
}

export interface PublicProviderCredential {
  provider: StorageProvider;
  configured: boolean;
  accountId: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  hasSecret: boolean;
  updatedAt: string;
}

function col(executor?: Executor | null) {
  return kv(executor).module(MODULE).collection<ProviderCredential>(COLLECTION);
}

/** Cloudflare R2 endpoint derived from the account id. */
export function r2Endpoint(accountId: string): string {
  const id = (accountId || "").trim();
  return id ? `https://${id}.r2.cloudflarestorage.com` : "";
}

function toPublic(provider: StorageProvider, c: ProviderCredential | null): PublicProviderCredential {
  return {
    provider,
    configured: Boolean(c?.accessKeyId && c?.secretAccessKey),
    accountId: c?.accountId ?? "",
    endpoint: provider === "r2" ? r2Endpoint(c?.accountId ?? "") : (c?.endpoint ?? ""),
    region: c?.region ?? "",
    accessKeyId: c?.accessKeyId ?? "",
    hasSecret: Boolean(c?.secretAccessKey),
    updatedAt: c?.updatedAt ?? "",
  };
}

export const providerCredentialsRepository = {
  async getRaw(provider: StorageProvider, executor?: Executor | null): Promise<ProviderCredential | null> {
    return col(executor).get(provider);
  },

  async getPublic(provider: StorageProvider, executor?: Executor | null): Promise<PublicProviderCredential> {
    return toPublic(provider, await col(executor).get(provider));
  },

  async listPublic(executor?: Executor | null): Promise<PublicProviderCredential[]> {
    const providers: StorageProvider[] = ["r2", "s3"];
    // Both provider credentials live in the SAME `provider-creds.json`
    // collection, so read it ONCE (`list()` = one round-trip) instead of a
    // per-provider `get()` (each of which re-reads the whole file).
    const all = await col(executor).list();
    const byId = new Map(all.map((c) => [(c as ProviderCredential & { id: string }).id, c]));
    return providers.map((p) => toPublic(p, byId.get(p) ?? null));
  },

  /** Upsert; an empty secret keeps the stored one (write-only). */
  async save(
    provider: StorageProvider,
    data: { accountId?: string; endpoint?: string; region?: string; accessKeyId: string; secretAccessKey?: string },
    executor?: Executor | null,
  ): Promise<PublicProviderCredential> {
    const store = col(executor);
    const existing = await store.get(provider);
    const next: ProviderCredential = {
      accountId: (data.accountId ?? existing?.accountId ?? "").trim(),
      endpoint: (data.endpoint ?? existing?.endpoint ?? "").trim(),
      region: (data.region ?? existing?.region ?? "").trim(),
      accessKeyId: data.accessKeyId.trim(),
      secretAccessKey: data.secretAccessKey?.trim() || existing?.secretAccessKey || "",
      updatedAt: new Date().toISOString(),
    };
    await store.set(provider, next);
    return toPublic(provider, next);
  },

  async remove(provider: StorageProvider, executor?: Executor | null): Promise<boolean> {
    return col(executor).delete(provider);
  },
};
