import { withResourceCreationLock } from "../../../shared/quota/resource-creation-lock.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { Executor } from "../../../shared/executor/index.js";
import { getContextUser } from "../../../shared/executor/context.js";
import { getTenantEnvelope, isHostingSession, isTenantDbName } from "../../../shared/tenant/tenant-scope.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { hostingAccountRepository } from "../../hosting/repositories/hosting-account.repository.js";

/** Resolve ownership once per operation using the target server's account
 * registry. This closes collisions between nested Linux usernames. */
export async function databaseNameAllowed(executor: Executor): Promise<(name: string) => boolean> {
  const user = getContextUser();
  if (!isHostingSession(user)) return () => true;
  const env = getTenantEnvelope(user!);
  const accounts = await hostingAccountRepository.findAll({ limit: Number.MAX_SAFE_INTEGER }, executor);
  if (!accounts.rows.some((account) => account.username === env.owner && account.status === "active")) {
    throw new ForbiddenError("La cuenta de hosting no está activa");
  }
  const owners = accounts.rows.map((account) => account.username);
  return (name) => isTenantDbName(env, name, owners);
}

export async function tenantDatabaseQuota(executor: Executor, owner: string): Promise<number> {
  const account = await hostingAccountRepository.findByUsername(owner, executor);
  if (!account || account.status !== "active") throw new ForbiddenError("La cuenta de hosting no está activa");
  return account.maxDatabases;
}

/** Both database engines share one account-wide distributed quota lock. */
export async function withTenantDatabaseCreationLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return withResourceCreationLock(key, "databases", fn);
}

export async function assertDatabaseAccess(executor: Executor, database: string): Promise<void> {
  if (!(await databaseNameAllowed(executor))(database)) {
    throw new ForbiddenError("No puedes acceder a una base de datos de otra cuenta");
  }
}
