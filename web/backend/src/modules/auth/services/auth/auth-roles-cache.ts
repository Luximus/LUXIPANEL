// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Auth service — per-target role/permission memoization used by
 * `buildTokenPayload`. Invalidated eagerly on any role CRUD event. Pure code
 * movement out of auth.service.ts. `invalidateRolesCache` is re-exported by the
 * facade (public surface).
 */

import { getContextExecutor } from "../../../../shared/executor/context.js";
import { eventBus, Events } from "../../../../shared/events/index.js";
import { roleRepository } from "../../../users/repositories/role.repository.js";

/** Per-target memoization of the role/permission records used to resolve a
 *  login's group permissions. `buildTokenPayload` runs on EVERY login/refresh
 *  and each miss is an SFTP round-trip to read the role sidecars; caching by
 *  `executor.target.id` for a short TTL removes that latency without affecting
 *  isolation (the key is the connected server). Invalidated eagerly on any role
 *  CRUD (see below), so an admin editing permissions is reflected immediately. */
const ROLES_CACHE_TTL_MS = 60_000;
type CachedRoles = Awaited<ReturnType<typeof roleRepository.findAll>>;
const rolesCache = new Map<string, { roles: CachedRoles; expires: number }>();

export async function getRolesForTarget(): Promise<CachedRoles> {
  const targetId = getContextExecutor()?.target.id ?? "local";
  const now = Date.now();
  const hit = rolesCache.get(targetId);
  if (hit && hit.expires > now) return hit.roles;
  // Miss (or expired): fall back to the authoritative SFTP read.
  const roles = await roleRepository.findAll();
  // Only cache a NON-EMPTY successful read. An empty result can come from an
  // unprivileged session whose role sidecars aren't readable — caching it would
  // poison a later privileged (admin) login on the SAME target within the TTL.
  if (roles.length > 0) rolesCache.set(targetId, { roles, expires: now + ROLES_CACHE_TTL_MS });
  return roles;
}

/** Drop every cached role list (all targets). The next `buildTokenPayload`
 *  re-reads from the authoritative SFTP store. Wired to role CRUD events below;
 *  also exported so callers/tests can force a refresh. */
export function invalidateRolesCache(): void {
  rolesCache.clear();
}

// Invalidate the whole role cache on any role CRUD (rare; the events carry no
// targetId so we clear all — the next login re-reads via SFTP). Emitted by
// users/services/roles.service.ts create/update/delete.
for (const roleEvent of [Events.ROLE_CREATED, Events.ROLE_UPDATED, Events.ROLE_DELETED]) {
  eventBus.on(roleEvent, () => invalidateRolesCache());
}
