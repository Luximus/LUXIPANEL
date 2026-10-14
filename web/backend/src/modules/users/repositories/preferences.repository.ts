// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Preferences repository — file-backed via dataStore.
 * `${LUXIPANEL_CONFIG_DIR}/users/preferences.json`, doc keyed by userId.
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { UserPreference, UserPreferencesData } from "../models/preferences.model.js";
import { getContextExecutor, getContextUser } from "../../../shared/executor/context.js";
import { PrivilegeDropExecutor } from "../../../shared/executor/privilege-drop-executor.js";
import { ForbiddenError } from "../../../shared/errors/index.js";

const MODULE = "users";
const COLLECTION = "preferences";

interface StoredPref {
  userId: number;
  data: UserPreferencesData;
  createdAt: string;
  updatedAt: string;
}

function fromStored(d: StoredPref): UserPreference {
  return {
    id: d.userId,
    userId: d.userId,
    data: d.data,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  } as unknown as UserPreference;
}

const store = makeKvStore<StoredPref>({ module: MODULE, collection: COLLECTION });
function ownPreferencesExecutor(userId: number, explicit?: Executor | null): Executor | null | undefined {
  const user = getContextUser(), executor = explicit ?? getContextExecutor();
  if (user && user.kind !== "admin" && user.userId !== userId) throw new ForbiddenError("Preferences belong to another user");
  if (executor instanceof PrivilegeDropExecutor && user) {
    const service = executor.trustedServiceExecutorFor(user.owner ?? "");
    if (!service) throw new ForbiddenError("Invalid preferences account");
    return service;
  }
  return executor;
}

export const preferencesRepository = {
  async findByUserId(userId: number, executor?: Executor | null): Promise<UserPreference | undefined> {
    executor = ownPreferencesExecutor(userId, executor);
    const doc = await store(executor).get(userId);
    return doc ? fromStored(doc as unknown as StoredPref) : undefined;
  },

  async upsert(userId: number, patch: UserPreferencesData, executor?: Executor | null): Promise<UserPreference> {
    executor = ownPreferencesExecutor(userId, executor);
    const existing = await store(executor).get(userId);
    if (existing) {
      const merged = { ...((existing as unknown as StoredPref).data ?? {}), ...patch };
      const updated = await store(executor).update(userId, { data: merged });
      return fromStored(updated as unknown as StoredPref);
    }
    const created = await store(executor).create({
      id: userId,
      userId,
      data: patch,
      createdAt: "",
      updatedAt: "",
    } as StoredPref & { id?: string | number });
    return fromStored(created as unknown as StoredPref);
  },
};
