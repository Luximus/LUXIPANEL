// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Storage-targets repository — cloud backup destinations (S3 / Cloudflare R2)
 * with their credentials. File-backed via dataStore:
 *   ${LUXIPANEL_CONFIG_DIR}/backup/storages.json  (0600 sidecar on the target)
 *
 * The `secretAccessKey` is write-only across the API: it is persisted here but
 * NEVER returned to the client (see {@link toPublic}).
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import { providerCredentialsRepository, r2Endpoint } from "./provider-credentials.repository.js";

const MODULE = "backup";
const COLLECTION = "storages";

export type StorageProvider = "s3" | "r2";

export interface StoredStorage {
  id: number;
  name: string;
  provider: StorageProvider;
  bucket: string;
  /** Custom endpoint (R2: https://<account>.r2.cloudflarestorage.com). */
  endpoint: string;
  /** AWS region (S3 only). */
  region: string;
  /** Key prefix (folder inside the bucket). */
  prefix: string;
  accessKeyId: string;
  /** Secret — persisted, never returned by the API. */
  secretAccessKey: string;
  createdAt: string;
  updatedAt: string;
}

/** Storage row safe to return to the client (no secret). */
export interface PublicStorage {
  id: number;
  name: string;
  provider: StorageProvider;
  bucket: string;
  endpoint: string;
  region: string;
  prefix: string;
  accessKeyId: string;
  hasSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

const store = makeKvStore<StoredStorage>({ module: MODULE, collection: COLLECTION });

function toPublic(d: StoredStorage): PublicStorage {
  const { secretAccessKey, ...rest } = d;
  return { ...rest, hasSecret: Boolean(secretAccessKey) };
}

export const storageRepository = {
  async list(executor?: Executor | null): Promise<PublicStorage[]> {
    const items = await store(executor).list();
    return items
      .map((d) => toPublic(d as unknown as StoredStorage))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async getRaw(id: number, executor?: Executor | null): Promise<StoredStorage | null> {
    const doc = await store(executor).get(id);
    return doc ? (doc as unknown as StoredStorage) : null;
  },

  async create(
    data: Omit<StoredStorage, "id" | "createdAt" | "updatedAt">,
    executor?: Executor | null,
  ): Promise<PublicStorage> {
    const created = await store(executor).create({
      ...data,
      createdAt: "",
      updatedAt: "",
    } as StoredStorage & { id?: number });
    return toPublic(created as unknown as StoredStorage);
  },

  async update(
    id: number,
    patch: Partial<Omit<StoredStorage, "id" | "createdAt">>,
    executor?: Executor | null,
  ): Promise<PublicStorage | null> {
    const updated = await store(executor).update(id, patch);
    return updated ? toPublic(updated as unknown as StoredStorage) : null;
  },

  async remove(id: number, executor?: Executor | null): Promise<boolean> {
    return store(executor).delete(id);
  },

  /**
   * Resolve a storage selection to an upload config. `storageId` is either the
   * literal `"local"` (or empty) → local provider, or a numeric storage id →
   * the stored S3/R2 target with its secret.
   */
  async resolve(
    storageId: string | number | undefined | null,
    executor?: Executor | null,
  ): Promise<
    | { provider: "local" }
    | {
        provider: StorageProvider;
        config: { bucket: string; endpoint?: string; region?: string; prefix?: string; accessKeyId: string; secretAccessKey: string };
      }
    | null
  > {
    if (storageId === undefined || storageId === null || storageId === "" || storageId === "local") {
      return { provider: "local" };
    }
    const id = typeof storageId === "number" ? storageId : Number.parseInt(String(storageId), 10);
    if (!Number.isFinite(id)) return { provider: "local" };
    const target = await this.getRaw(id, executor);
    if (!target) return null;

    // A target may carry its own keys (legacy/per-target) OR inherit the
    // account-level provider credential configured in Settings → Credentials.
    let accessKeyId = target.accessKeyId;
    let secretAccessKey = target.secretAccessKey;
    let endpoint = target.endpoint;
    let region = target.region;
    if (!accessKeyId || !secretAccessKey) {
      const central = await providerCredentialsRepository.getRaw(target.provider, executor);
      if (central) {
        accessKeyId = accessKeyId || central.accessKeyId;
        secretAccessKey = secretAccessKey || central.secretAccessKey;
        if (!endpoint) {
          endpoint = target.provider === "r2" ? r2Endpoint(central.accountId ?? "") : (central.endpoint ?? "");
        }
        if (!region) region = central.region ?? "";
      }
    }

    // Fail-closed: un target S3/R2 sin credencial usable (ni propia ni central)
    // NO debe intentar subir con llaves vacías (error opaco de la CLI). Devolver
    // null hace que el controlador lance "Destino de backup no encontrado".
    if (!accessKeyId || !secretAccessKey) return null;

    return {
      provider: target.provider,
      config: {
        bucket: target.bucket,
        endpoint: endpoint || undefined,
        region: region || undefined,
        prefix: target.prefix || undefined,
        accessKeyId,
        secretAccessKey,
      },
    };
  },
};
