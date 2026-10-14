// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Hosting account repository — file-backed via dataStore (NO database).
 *   ${LUXIPANEL_CONFIG_DIR}/hosting/accounts.json
 *
 * dataStore assigns the numeric id and the createdAt/updatedAt ISO strings
 * automatically, so callers pass the account body only.
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { HostingAccount, NewHostingAccount } from "../models/hosting-account.model.js";

const MODULE = "hosting";
const COLLECTION = "accounts";

const store = makeKvStore<HostingAccount>({ module: MODULE, collection: COLLECTION });

export const hostingAccountRepository = {
  async findAll(
    opts?: { search?: string; status?: string; username?: string; plan?: string; sortBy?: string; sortDir?: string; limit?: number; offset?: number },
    executor?: Executor | null,
  ): Promise<{ rows: HostingAccount[]; total: number; counts: Record<string, number> }> {
    let rows = await store(executor).list();

    if (opts?.username) rows = rows.filter(a => a.username.toLowerCase().includes(opts.username!.toLowerCase()));
    if (opts?.plan) rows = rows.filter(a => a.plan === opts.plan);
    if (opts?.status) rows = rows.filter((a) => a.status === opts.status);
    if (opts?.search) {
      const term = opts.search.toLowerCase();
      rows = rows.filter(
        (a) =>
          a.username.toLowerCase().includes(term) ||
          (a.displayName ?? "").toLowerCase().includes(term) ||
          (a.email ?? "").toLowerCase().includes(term),
      );
    }

    const sortBy = ["username", "plan", "status", "tenantGroup", "createdAt", "updatedAt"].includes(opts?.sortBy ?? "") ? opts!.sortBy as keyof HostingAccount : "createdAt";
    const direction = opts?.sortDir === "desc" ? -1 : 1;
    rows.sort((a, b) => direction * String(a[sortBy] ?? "").localeCompare(String(b[sortBy] ?? "")) || a.id - b.id);
    const counts: Record<string, number> = { active: 0, suspended: 0, terminated: 0 };
    for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
    const total = rows.length;
    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? 50;
    return { rows: rows.slice(offset, offset + limit), total, counts };
  },

  async findById(id: number, executor?: Executor | null): Promise<HostingAccount | undefined> {
    return (await store(executor).get(id)) ?? undefined;
  },

  async findByUsername(username: string, executor?: Executor | null): Promise<HostingAccount | undefined> {
    return (await store(executor).find((d) => d.username === username)) ?? undefined;
  },

  async create(data: NewHostingAccount, executor?: Executor | null): Promise<HostingAccount> {
    // id + createdAt/updatedAt are filled by dataStore. `jailEnabled` defaults to
    // false so accounts created before the field existed (and any caller that
    // omits it) stay on the normal owner shell.
    const withDefaults = { ...data, jailEnabled: data.jailEnabled ?? false } as unknown as HostingAccount;
    return store(executor).create(withDefaults);
  },

  async update(
    id: number,
    patch: Partial<NewHostingAccount>,
    executor?: Executor | null,
  ): Promise<HostingAccount | undefined> {
    return (await store(executor).update(id, patch as Partial<HostingAccount>)) ?? undefined;
  },

  async delete(id: number, executor?: Executor | null): Promise<boolean> {
    return store(executor).delete(id);
  },
};
