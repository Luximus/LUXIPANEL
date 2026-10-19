/**
 * Obsidian vault registrations — per-server sidecar repository.
 *
 * Sidecar: `${LUXIPANEL_CONFIG_DIR}/obsidian/vaults.json` on the CONNECTED
 * server (managed-mode isolation invariant: no authoritative store on the
 * panel host). Only the registration metadata lives here — the notes stay in
 * the vault directory itself and are reached through the Executor.
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { ObsidianVault } from "../models/index.js";
import { normalizedVaultPath } from "../services/path-util.js";

const MODULE = "obsidian";
const COLLECTION = "vaults";

const store = makeKvStore<ObsidianVault>({
  module: MODULE,
  collection: COLLECTION,
  idStrategy: "uuid",
});

export const vaultsRepository = {
  async update(executor: Executor, id: string, data: Partial<Pick<ObsidianVault, "path" | "name" | "shallow">>) {
    return store(executor).update(id, data);
  },
  async list(executor?: Executor | null): Promise<Array<ObsidianVault & { id: string }>> {
    const all = (await store(executor).list()) as Array<ObsidianVault & { id: string }>;
    return [...all].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  },

  async get(
    executor: Executor | null | undefined,
    id: string,
  ): Promise<(ObsidianVault & { id: string }) | null> {
    return (await store(executor).get(id)) as (ObsidianVault & { id: string }) | null;
  },

  async findByPath(
    executor: Executor | null | undefined,
    path: string,
  ): Promise<(ObsidianVault & { id: string }) | null> {
    const normalized = normalizedVaultPath(path);
    return (await store(executor).find(
      (v) => (v.path || "").replace(/\/+$/, "") === normalized,
    )) as (ObsidianVault & { id: string }) | null;
  },

  /** Create a registration. `createdAt`/`updatedAt` are stamped by dataStore. */
  async create(
    executor: Executor | null | undefined,
    data: Pick<ObsidianVault, "name" | "path" | "shallow">,
  ): Promise<ObsidianVault & { id: string }> {
    return (await store(executor).create({
      name: data.name,
      path: data.path,
      ...(data.shallow ? { shallow: true } : {}),
    })) as ObsidianVault & { id: string };
  },

  /** Deregister a vault. NEVER touches the vault files on disk. */
  async remove(executor: Executor | null | undefined, id: string): Promise<boolean> {
    return store(executor).delete(id);
  },
};
