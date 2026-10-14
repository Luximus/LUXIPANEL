// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Server-side panel settings — persisted as JSON sidecars on the connected
 * server under `${LUXIPANEL_CONFIG_DIR}/settings.json` and in that server's
 * settings repository.
 *
 * Key/value pairs (everything the Settings UI handles) live in a single
 * file so reads are one round-trip. The shared `remoteConfig` helper takes
 * care of mkdir -p + chmod + sudo fallback for read.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { remoteConfig } from "../../../shared/remote-config/index.js";
import { settingsRepository } from "../repositories/settings.repository.js";
import { createTargetTtlCache } from "./target-ttl-cache.js";
const MODULE = "settings";

/**
 * Write the bag to the connected server's sidecar. Managed-only: there is NO
 * authoritative panel-host store — BOTH the `settingsRepository` write and
 * this one land on the *connected* server (via its executor / the ALS
 * context executor). If it fails the value did NOT persist for this server,
 * so we must propagate: silently swallowing made the UI report success while
 * nothing was saved, and looked like "settings don't save per server".
 */
async function mirrorToServer(executor: Executor, bag: ServerSettingsBag): Promise<void> {
  await remoteConfig.write(executor, MODULE, bag);
}

export interface ServerSettingEntry {
  value: string;
  category: string;
}

export type ServerSettingsBag = Record<string, ServerSettingEntry>;

const FALLBACK: ServerSettingsBag = {};

async function readDbBag(executor?: Executor | null): Promise<ServerSettingsBag> {
  const all = await settingsRepository.getAll(executor);
  const bag: ServerSettingsBag = {};
  for (const row of all) {
    bag[row.key] = { value: row.value, category: row.category ?? "general" };
  }
  return bag;
}

// TTL cache por target — readAll hace 1 SFTP por petición. Cada visita
// a /panel/settings dispara /api/settings que llama esto + securitySettings
// + loadLpLsOverlay; sin cache cada entrada al tab pagaba 2-3 round-trips
// SSH (~500ms-2s). Invalidamos en setOne/setBulk/remove.
const BAG_TTL_MS = 15_000;
const bagCache = createTargetTtlCache<ServerSettingsBag>(BAG_TTL_MS);

function invalidateBagCache(targetId: string | null | undefined): void {
  bagCache.invalidate(targetId);
}

export const serverSettingsService = {
  /** Read full settings bag. Server file overrides DB cache. */
  async readAll(executor?: Executor | null): Promise<ServerSettingsBag> {
    const dbBag = await readDbBag(executor);
    if (!executor) return dbBag;
    const key = executor.target.id;
    const cached = bagCache.get(key);
    if (cached !== undefined) return cached;
    try {
      const remote = await remoteConfig.read<ServerSettingsBag>(executor, MODULE, FALLBACK);
      const merged = { ...dbBag, ...remote };
      bagCache.set(key, merged);
      return merged;
    } catch {
      return dbBag;
    }
  },

  async getOne(executor: Executor | null | undefined, key: string): Promise<ServerSettingEntry | null> {
    const bag = await this.readAll(executor);
    return bag[key] ?? null;
  },

  /** Write or update a single key. Mirrors to DB and to the remote file. */
  async setOne(executor: Executor | null | undefined, key: string, value: string, category = "general", description?: string): Promise<void> {
    await settingsRepository.set(key, value, category, description, executor);
    if (!executor) return;
    const current = await this.readAll(executor);
    const next: ServerSettingsBag = { ...current, [key]: { value, category } };
    await mirrorToServer(executor, next);
    invalidateBagCache(executor.target.id);
  },

  /** Bulk write. */
  async setBulk(executor: Executor | null | undefined, entries: Array<{ key: string; value: string; category?: string }>): Promise<void> {
    // Pass `executor` down so the repository can use it directly (no fallback
    // dance through AsyncLocalStorage). The repository still tolerates a
    // null executor by falling back to the request-scoped context — but
    // threading the explicit one makes failures deterministic and lets the
    // controller return a precise error rather than a generic 500.
    await settingsRepository.setBulk(entries, executor);
    if (!executor) return;
    const current = await this.readAll(executor);
    const next: ServerSettingsBag = { ...current };
    for (const e of entries) {
      next[e.key] = { value: e.value, category: e.category ?? "general" };
    }
    await mirrorToServer(executor, next);
    invalidateBagCache(executor.target.id);
  },

  async remove(executor: Executor | null | undefined, key: string): Promise<void> {
    await settingsRepository.delete(key, executor);
    if (!executor) return;
    const current = { ...await this.readAll(executor) };
    delete current[key];
    await mirrorToServer(executor, current);
    invalidateBagCache(executor.target.id);
  },
};
