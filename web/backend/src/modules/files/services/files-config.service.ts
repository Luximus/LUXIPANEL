// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Per-target operational policy. Environment limits remain hard ceilings. */
import { env } from "../../../config/env.js";
import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";

export interface FilesConfig {
  id: string;
  uploadMaxBytes: number;
  snapshotsEnabled: boolean;
  snapshotMaxBytes: number;
  snapshotMaxPerPath: number;
  snapshotMaxTotal: number;
  sharingEnabled: boolean;
  shareMaxExpiryMin: number;
  sharePasswordRequired: boolean;
}

const store = makeKvStore<FilesConfig>({ module: "files", collection: "config" });
const cache = new Map<string, { until: number; value: FilesConfig }>();

function defaults(): FilesConfig {
  return {
    id: "default",
    uploadMaxBytes: env.FILES_UPLOAD_MAX_BYTES,
    snapshotsEnabled: env.FILES_SNAPSHOTS_ENABLED,
    snapshotMaxBytes: env.FILES_SNAPSHOT_MAX_BYTES,
    snapshotMaxPerPath: env.FILES_SNAPSHOT_MAX_PER_PATH,
    snapshotMaxTotal: env.FILES_SNAPSHOT_MAX_TOTAL,
    sharingEnabled: true,
    shareMaxExpiryMin: 43_200,
    sharePasswordRequired: false,
  };
}

function effective(rec: FilesConfig | null): FilesConfig {
  const base = defaults();
  if (!rec) return base;
  const bounded = (value: unknown, max: number) =>
    typeof value === "number" && Number.isInteger(value) && value > 0 ? Math.min(max, value) : max;
  return {
    ...base,
    id: "default",
    uploadMaxBytes: bounded(rec.uploadMaxBytes, base.uploadMaxBytes),
    snapshotsEnabled: base.snapshotsEnabled && rec.snapshotsEnabled !== false,
    snapshotMaxBytes: bounded(rec.snapshotMaxBytes, base.snapshotMaxBytes),
    snapshotMaxPerPath: bounded(rec.snapshotMaxPerPath, base.snapshotMaxPerPath),
    snapshotMaxTotal: bounded(rec.snapshotMaxTotal, base.snapshotMaxTotal),
    sharingEnabled: rec.sharingEnabled !== false,
    shareMaxExpiryMin: bounded(rec.shareMaxExpiryMin, 43_200),
    sharePasswordRequired: rec.sharePasswordRequired === true,
  };
}

export const filesConfigService = {
  ceilings: defaults,
  async get(executor: Executor): Promise<FilesConfig> {
    const key = executor.target.id;
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.value;
    const value = effective(await store(executor).get("default"));
    cache.set(key, { until: Date.now() + 5_000, value });
    return value;
  },
  async patch(executor: Executor, values: Partial<Omit<FilesConfig, "id">>): Promise<FilesConfig> {
    const current = await this.get(executor);
    const next = effective({ ...current, ...values });
    await store(executor).set("default", next);
    cache.delete(executor.target.id);
    return next;
  },
};
