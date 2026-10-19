// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Context-container index — per-server sidecar mapping a "source" (a GitHub
 * repo, an assistant project, or a loose chat) to the Obsidian vault that
 * holds its summarized context, decisions, commands, errors and rules.
 *
 * Sidecar: `${LUXIPANEL_CONFIG_DIR}/obsidian/containers.json` on the CONNECTED
 * server (managed-mode isolation invariant). The vault directory + its notes
 * live on the client server and are reached through the Executor; this index
 * only records the link so creation stays idempotent (one container per
 * source) and the assistant can resolve "the vault for X".
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";

export type ContainerKind = "repo" | "project" | "chat";

export interface ContextContainer {
  id?: string;
  kind: ContainerKind;
  /**
   * Stable reference key, unique per source:
   *   repo:<absolute repo path> | project:<projectId> | chat:<conversationId>
   * Idempotency is keyed on this, so renames/title changes never duplicate.
   */
  refKey: string;
  /** Human label, also the registered Obsidian vault name. */
  name: string;
  /** Absolute vault directory on the client server. */
  path: string;
  /** Registered Obsidian vault id (vaults.json). */
  vaultId: string;
  /** For repos: the repository's absolute path (CLI-pointer target). */
  repoPath?: string;
  createdAt?: string;
  updatedAt?: string;
}

type Registered = ContextContainer & { id: string };

const MODULE = "obsidian";
const COLLECTION = "containers";

const store = makeKvStore<ContextContainer>({
  module: MODULE,
  collection: COLLECTION,
  idStrategy: "uuid",
});

export const containersRepository = {
  async update(executor: Executor, id: string, data: Partial<Pick<ContextContainer, "path" | "vaultId">>) {
    return store(executor).update(id, data);
  },
  async list(executor?: Executor | null): Promise<Registered[]> {
    return (await store(executor).list()) as Registered[];
  },

  async findByRefKey(
    executor: Executor | null | undefined,
    refKey: string,
  ): Promise<Registered | null> {
    return (await store(executor).find((c) => c.refKey === refKey)) as Registered | null;
  },

  async create(
    executor: Executor | null | undefined,
    data: Omit<ContextContainer, "id" | "createdAt" | "updatedAt">,
  ): Promise<Registered> {
    return (await store(executor).create(data)) as Registered;
  },
};
