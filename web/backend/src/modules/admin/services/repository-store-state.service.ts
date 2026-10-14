// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** GitHub catalogue state on the connected server. Bookmarks and preferences
 * belong to a user; clone registrations describe real directories on this server. */
import { randomUUID } from "node:crypto";
import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";

export interface RepositoryPreferences {
  defaultTab: "all" | "saved" | "cloned" | "update";
  sort: "relevance" | "stars_desc" | "stars_asc" | "updated_desc" | "name_asc";
  pageSize: 24 | 36 | 60;
  showArchived: boolean;
  cloneParent: string;
  transport: "https" | "ssh";
}
interface UserState { id: string; saved: string[]; preferences: RepositoryPreferences }
export interface RegisteredClone {
  id: string;
  fullName: string;
  path: string;
  branch: string;
  createdAt: string;
  checkedAt?: string;
  ahead?: number;
  behind?: number;
  dirty?: boolean;
  statusError?: string;
}
const users = makeKvStore<UserState>({ module: "repository-store", collection: "users" });
const clones = makeKvStore<RegisteredClone>({ module: "repository-store", collection: "clones", idStrategy: "uuid" });
export const DEFAULT_REPOSITORY_PREFERENCES: RepositoryPreferences = {
  defaultTab: "all", sort: "relevance", pageSize: 36, showArchived: false,
  cloneParent: "/var/www", transport: "https",
};

export const repositoryStoreState = {
  async user(executor: Executor, userId: number): Promise<UserState> {
    const id = String(userId);
    const current = await users(executor).get(id);
    return { id, saved: current?.saved ?? [], preferences: { ...DEFAULT_REPOSITORY_PREFERENCES, ...current?.preferences } };
  },
  async patchUser(executor: Executor, userId: number, change: { saved?: string[]; preferences?: Partial<RepositoryPreferences> }): Promise<UserState> {
    const id = String(userId);
    return users(executor).transaction(async (all) => {
      const previous = all[id];
      const next: UserState = {
        id,
        saved: change.saved ?? previous?.saved ?? [],
        preferences: { ...DEFAULT_REPOSITORY_PREFERENCES, ...previous?.preferences, ...change.preferences },
      };
      return { next: { ...all, [id]: next }, result: next };
    });
  },
  async changeSaved(executor: Executor, userId: number, fullNames: string[], add: boolean): Promise<UserState> {
    const id = String(userId);
    return users(executor).transaction(async (all) => {
      const previous = all[id];
      const saved = new Set((previous?.saved ?? []).map((name) => name.toLowerCase()));
      for (const name of fullNames) add ? saved.add(name.toLowerCase()) : saved.delete(name.toLowerCase());
      const next: UserState = {
        id, saved: [...saved].slice(-500),
        preferences: { ...DEFAULT_REPOSITORY_PREFERENCES, ...previous?.preferences },
      };
      return { next: { ...all, [id]: next }, result: next };
    });
  },
  async listClones(executor: Executor): Promise<RegisteredClone[]> { return clones(executor).list(); },
  async clone(executor: Executor, id: string): Promise<RegisteredClone | null> { return clones(executor).get(id); },
  async register(executor: Executor, input: Omit<RegisteredClone, "id" | "createdAt">): Promise<RegisteredClone> {
    const record = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    return clones(executor).transaction(async (current) => {
      if (Object.values(current).some((existing) => existing.path === input.path)) throw new ValidationError("La carpeta ya está registrada");
      return { next: { ...current, [record.id]: record }, result: record };
    });
  },
  async updateClone(executor: Executor, record: RegisteredClone): Promise<void> { await clones(executor).set(record.id, record); },
  async unlink(executor: Executor, id: string): Promise<boolean> { return clones(executor).delete(id); },
};
