// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Panel user repository — file-backed (kvStore) replacement of the former
 * Drizzle/Postgres implementation. Stores users at
 * `${LUXIPANEL_CONFIG_DIR}/auth/users.json`.
 *
 * The numeric `id` field is preserved (it's used as FK by terminal snippets
 * and others). Lookups by username/email use the in-memory map and a
 * predicate scan — collections are tiny (one panel = a handful of users)
 * so linear scans are fine.
 */

import { kv } from "../../../shared/kv-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { PanelUser, NewPanelUser } from "../models/index.js";
import { roleRepository } from "../../users/repositories/role.repository.js";

const MODULE = "auth";
const COLLECTION = "users";

interface StoredUser {
  id: number;
  username: string;
  email: string | null;
  displayName: string | null;
  passwordHash: string;
  authProvider: "system" | "local";
  systemUid: number | null;
  systemGid: number | null;
  homeDir: string | null;
  shell: string | null;
  managedBySystem: boolean;
  syncedAt: string | null;
  roleId: number | null;
  modules: string | null;
  groups: string[];
  enabled: boolean;
  phoneE164: string | null;
  createdAt: string;
  updatedAt: string;
}

function fromStored(u: StoredUser): PanelUser {
  return {
    // kv-store strips the `id` FIELD on write and re-injects the map KEY as a
    // STRING on list()/find(); normalize to the numeric id consumers expect.
    id: Number(u.id),
    username: u.username,
    email: u.email,
    displayName: u.displayName,
    passwordHash: u.passwordHash,
    authProvider: u.authProvider,
    systemUid: u.systemUid,
    systemGid: u.systemGid,
    homeDir: u.homeDir,
    shell: u.shell,
    managedBySystem: u.managedBySystem,
    syncedAt: u.syncedAt ? new Date(u.syncedAt) : null,
    roleId: u.roleId,
    modules: u.modules,
    groups: Array.isArray(u.groups) ? u.groups : [],
    enabled: u.enabled,
    phoneE164: u.phoneE164,
    createdAt: new Date(u.createdAt),
    updatedAt: new Date(u.updatedAt),
  } as PanelUser;
}

function store(executor?: Executor | null) {
  return kv(executor).module(MODULE).collection<StoredUser>(COLLECTION);
}

function nowIso(): string {
  return new Date().toISOString();
}

async function nextId(executor?: Executor | null): Promise<number> {
  // list() injects ids as strings — compare numerically or `max + 1` becomes
  // string concatenation ("1" + 1 = "11"), which already polluted stores.
  const all = await store(executor).list();
  const maxId = all.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0);
  return maxId + 1;
}

export const panelUserRepository = {
  async findById(id: number, executor?: Executor | null): Promise<PanelUser | undefined> {
    // Docs are keyed by String(id); get() returns the doc WITHOUT the key, so
    // re-inject it. (A predicate scan on `u.id === id` never matches: the
    // stored field is stripped on write and the key comes back as a string.)
    const found = await store(executor).get(String(id));
    return found ? fromStored({ ...(found as StoredUser), id }) : undefined;
  },

  async upsertBridged(input: { id: number; username: string; displayName?: string | null }, executor?: Executor | null): Promise<void> {
    const usernameSafe = (input.username || `user-${input.id}`).toLowerCase().slice(0, 64);
    const docId = String(input.id);
    const existing = await store(executor).get(docId);
    const now = nowIso();
    const next: StoredUser = {
      id: input.id,
      username: existing?.username ?? usernameSafe,
      email: existing?.email ?? null,
      displayName: input.displayName ?? existing?.displayName ?? null,
      passwordHash: existing?.passwordHash ?? "",
      authProvider: "system",
      systemUid: existing?.systemUid ?? null,
      systemGid: existing?.systemGid ?? null,
      homeDir: existing?.homeDir ?? null,
      shell: existing?.shell ?? null,
      managedBySystem: true,
      syncedAt: existing?.syncedAt ?? null,
      roleId: existing?.roleId ?? null,
      modules: existing?.modules ?? null,
      groups: existing?.groups ?? [],
      enabled: existing?.enabled ?? true,
      phoneE164: existing?.phoneE164 ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await store(executor).set(docId, next);
  },

  async findByUsername(username: string, executor?: Executor | null): Promise<PanelUser | undefined> {
    const lower = username.toLowerCase();
    const found = await store(executor).find((u) => u.username === lower);
    return found ? fromStored(found as unknown as StoredUser) : undefined;
  },

  async findByEmail(email: string, executor?: Executor | null): Promise<PanelUser | undefined> {
    const lower = email.toLowerCase();
    const found = await store(executor).find((u) => u.email === lower);
    return found ? fromStored(found as unknown as StoredUser) : undefined;
  },

  /** Resolve by Linux UID (the DataTable rows for system users carry the UID). */
  async findBySystemUid(uid: number, executor?: Executor | null): Promise<PanelUser | undefined> {
    const found = await store(executor).find((u) => u.systemUid === uid);
    return found ? fromStored(found as unknown as StoredUser) : undefined;
  },

  async findAll(executor?: Executor | null): Promise<PanelUser[]> {
    const all = await store(executor).list();
    return all
      .map((u) => fromStored(u as unknown as StoredUser))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  /**
   * Join users with their role (per-target kv-store). Returns role name,
   * role modules (array) and role permissions so token building and the
   * users UI can resolve effective access. Falls back to nulls if the role
   * lookup fails so login never hard-crashes on a missing role.
   */
  async findAllWithRoles(executor?: Executor | null) {
    const users = await this.findAll(executor);
    let byId = new Map<number, { name: string; modules: string[]; permissions: Record<string, unknown> }>();
    try {
      const roles = await roleRepository.findAll(executor);
      byId = new Map(
        roles.map((r) => [
          r.id,
          {
            name: r.name,
            modules: Array.isArray(r.modules) ? (r.modules as unknown as string[]) : [],
            permissions: (r.permissions ?? {}) as Record<string, unknown>,
          },
        ]),
      );
    } catch {
      /* role store unreachable — degrade to user-level modules only */
    }
    return users.map((u) => {
      const role = u.roleId != null ? byId.get(u.roleId) : undefined;
      return {
        ...u,
        roleName: role?.name ?? null,
        roleModules: (role?.modules ?? null) as string[] | null,
        rolePermissions: (role?.permissions ?? null) as Record<string, unknown> | null,
      };
    });
  },

  async create(data: NewPanelUser, executor?: Executor | null): Promise<PanelUser> {
    const id = (data as { id?: number }).id ?? (await nextId(executor));
    const now = nowIso();
    const stored: StoredUser = {
      id,
      username: data.username.toLowerCase(),
      email: (data.email ?? null)?.toLowerCase() ?? null,
      displayName: data.displayName ?? null,
      passwordHash: data.passwordHash ?? "",
      authProvider: data.authProvider ?? "system",
      systemUid: data.systemUid ?? null,
      systemGid: data.systemGid ?? null,
      homeDir: data.homeDir ?? null,
      shell: data.shell ?? null,
      managedBySystem: data.managedBySystem ?? true,
      syncedAt: data.syncedAt ? new Date(data.syncedAt as unknown as string).toISOString() : null,
      roleId: data.roleId ?? null,
      modules: data.modules ?? null,
      groups: (data as { groups?: string[] }).groups ?? [],
      enabled: data.enabled ?? true,
      phoneE164: data.phoneE164 ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await store(executor).set(String(id), stored);
    return fromStored(stored);
  },

  async update(id: number, data: Partial<Omit<NewPanelUser, "id">>, executor?: Executor | null): Promise<PanelUser | undefined> {
    const docId = String(id);
    const existing = await store(executor).get(docId);
    if (!existing) return undefined;
    // `syncedAt` may arrive as a Date (timestamp column) but is stored as ISO.
    const patch: Record<string, unknown> = { ...data, updatedAt: nowIso() };
    if (patch.syncedAt instanceof Date) patch.syncedAt = patch.syncedAt.toISOString();
    const merged = { ...existing, ...patch, id } as StoredUser;
    await store(executor).set(docId, merged);
    return fromStored(merged);
  },

  async delete(id: number, executor?: Executor | null): Promise<boolean> {
    return store(executor).delete(String(id));
  },

  async updatePassword(id: number, passwordHash: string, executor?: Executor | null): Promise<boolean> {
    const docId = String(id);
    const existing = await store(executor).get(docId);
    if (!existing) return false;
    await store(executor).set(docId, { ...existing, passwordHash, updatedAt: nowIso() });
    return true;
  },

  async setEnabled(id: number, enabled: boolean, executor?: Executor | null): Promise<boolean> {
    const docId = String(id);
    const existing = await store(executor).get(docId);
    if (!existing) return false;
    await store(executor).set(docId, { ...existing, enabled, updatedAt: nowIso() });
    return true;
  },

  async count(executor?: Executor | null): Promise<number> {
    return store(executor).count();
  },
};
