// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Role repository — file-backed (kvStore). Stores roles at
 * `${LUXIPANEL_CONFIG_DIR}/users/roles.json`.
 */

import { randomInt } from "node:crypto";
import { kv } from "../../../shared/kv-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { Role, NewRole } from "../../auth/models/roles.model.js";

const MODULE = "users";
const COLLECTION = "roles";

interface StoredRole {
  id: number;
  name: string;
  description: string | null;
  modules: string[];
  permissions: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function fromStored(r: StoredRole): Role {
  return {
    // kv-store strips the `id` FIELD on write and re-injects the map KEY as a
    // STRING on list()/find(); normalize to the numeric id consumers expect
    // (e.g. findAllWithRoles joins byId.get(u.roleId) with a numeric roleId).
    id: Number(r.id),
    name: r.name,
    description: r.description,
    modules: r.modules ?? [],
    permissions: r.permissions ?? {},
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
  } as unknown as Role;
}

function store(executor?: Executor | null) {
  return kv(executor).module(MODULE).collection<StoredRole>(COLLECTION);
}

async function nextId(executor?: Executor | null): Promise<number> {
  // `roles.id` is a numeric FK (joined as `byId.get(u.roleId)`), so the id must
  // stay an integer — a UUID would break the join. The old `max + 1` collided
  // under concurrency: two simultaneous creates both read the same snapshot,
  // computed the same id and the second `set()` overwrote the first (lost role).
  // Use a time-ordered id (monotonic + sortable high bits) with a random low
  // part, then bump past any id already present in the snapshot. Date.now()*1e3
  // stays well under Number.MAX_SAFE_INTEGER (safe until year ~2255).
  // list() injects ids as strings — coerce with Number() before comparing.
  const all = await store(executor).list();
  const used = new Set(all.map((r) => Number(r.id) || 0));
  let candidate = Date.now() * 1000 + randomInt(1000);
  while (used.has(candidate)) candidate += 1;
  return candidate;
}

export const roleRepository = {
  async findAll(executor?: Executor | null): Promise<Role[]> {
    const all = await store(executor).list();
    return all.map((r) => fromStored(r as unknown as StoredRole)).sort((a, b) => a.name.localeCompare(b.name));
  },

  async findByName(name: string, executor?: Executor | null): Promise<Role | undefined> {
    const found = await store(executor).find((r) => r.name === name);
    return found ? fromStored(found as unknown as StoredRole) : undefined;
  },

  async create(data: Omit<NewRole, "id" | "createdAt" | "updatedAt">, executor?: Executor | null): Promise<Role> {
    const id = await nextId(executor);
    const now = new Date().toISOString();
    const stored: StoredRole = {
      id,
      name: data.name,
      description: data.description ?? null,
      modules: (data.modules as unknown as string[]) ?? [],
      permissions: (data.permissions as unknown as Record<string, unknown>) ?? {},
      createdAt: now,
      updatedAt: now,
    };
    await store(executor).set(String(id), stored);
    return fromStored(stored);
  },

  async update(id: number, data: Partial<Omit<NewRole, "id" | "createdAt">>, executor?: Executor | null): Promise<Role | undefined> {
    const docId = String(id);
    const existing = await store(executor).get(docId);
    if (!existing) return undefined;
    const next: StoredRole = {
      ...existing,
      ...(data as Partial<StoredRole>),
      id,
      updatedAt: new Date().toISOString(),
    };
    await store(executor).set(docId, next);
    return fromStored(next);
  },

  async delete(id: number, executor?: Executor | null): Promise<boolean> {
    return store(executor).delete(String(id));
  },
};
