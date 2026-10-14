// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Privilege-escalation GATE for file-manager operations on the connected server.
 *
 * The privileged file ladders (`writePrivilegedFile` on an upload EACCES, and
 * `privilegedRemove`/`privilegedRename`/`privilegedChmod` on a mutation EACCES)
 * escalate to `sudo` so the panel can manage root-owned paths. But the panel
 * backend runs as ONE service user with a stored sudo passphrase, so — left
 * ungated — ANY logged-in panel user could write/delete/chmod root-owned files
 * through the Files module. That is a privilege escalation: in standalone
 * multi-node the panel login IS a real Linux user of the box, and a non-sudo
 * Linux user must NOT gain root's reach just by opening the panel.
 *
 * This gate makes the sudo ladder conditional: it only runs when the logged-in
 * panel user is a member of a privileged Linux group (`sudo`/`wheel`) ON THE
 * CONNECTED SERVER — the SAME signal `auth` already uses to decide who is a
 * panel admin (`PRIVILEGED_ADMIN_GROUPS` in auth-shared). We resolve it LIVE
 * from the request executor (`id -nG <user>`, no sudo needed to read your own
 * groups) rather than trusting the JWT, because the token's groups were captured
 * at login against the login server and a session may have since switched
 * target. A short per-(server,user) cache keeps this to one `id -nG` round-trip
 * per session-ish window instead of one per file operation.
 *
 * FAIL-CLOSED: no user context, an unresolvable group read, or a user outside
 * sudo/wheel all mean NO escalation — the caller surfaces the normal typed
 * permission error (403) instead of silently reaching for root.
 *
 * AUDIT: every time the ladder actually escalates, `auditPrivilegedFileOp`
 * records WHO (the real panel username, never root/the service user), the
 * operation, the path(s) and the outcome in the structured log.
 */

import { getContextUser } from "../executor/context.js";
import { quoteArg } from "../executor/quote.js";
import type { Executor } from "../executor/types.js";
import { ForbiddenError } from "../errors/index.js";
import { createModuleLogger } from "../logger/index.js";

const log = createModuleLogger("privilege-escalation");

/**
 * Linux groups whose membership permits the sudo file ladder. Kept in sync with
 * auth's `PRIVILEGED_ADMIN_GROUPS` (a member already has a root-equivalent shell
 * on the box, so gating them would be theatre). Defined locally so `shared/`
 * does not import a `modules/` file (layering) — the set is a two-value literal.
 */
const PRIVILEGED_UNIX_GROUPS = new Set(["sudo", "wheel"]);

/** How long a resolved membership decision is trusted before we re-check the
 *  connected server. Short by design: group changes are rare and a stale grant
 *  window of seconds is acceptable, but we must not pay an `id -nG` SSH
 *  round-trip on every delete/rename/chmod/upload. */
const ESCALATION_CACHE_TTL_MS = 30_000;

/** The file operations that may escalate — used only for the audit record. */
export type PrivilegedFileOp = "upload" | "delete" | "rename" | "chmod";

interface CacheEntry {
  value: boolean;
  expires: number;
}

/** Per-(targetId, username) membership cache. Keyed by target so the same
 *  username on a different connected server never reuses a decision. */
const membershipCache = new Map<string, CacheEntry>();

/**
 * Resolve whether `username` belongs to a privileged Linux group on the server
 * reachable through `executor`. Returns `null` when the membership could NOT be
 * determined (exec failure / non-zero exit) so the caller can distinguish an
 * authoritative "not privileged" (`false`) from an unknown state (fail-closed,
 * NOT cached, so a transient blip doesn't lock a real admin out for the TTL).
 */
async function resolveMembership(executor: Executor, username: string): Promise<boolean | null> {
  try {
    // `id -nG` reads the CALLER-visible group list; a user can always read its
    // own membership without sudo. Single-line command (SSO agents gateway
    // rejects `\r`/`\n`), path-safe via quoteArg.
    const res = await executor.exec(`id -nG ${quoteArg(username)}`);
    if (res.exitCode !== 0) return null;
    const groups = res.stdout
      .trim()
      .split(/\s+/)
      .map((g) => g.trim().toLowerCase())
      .filter(Boolean);
    return groups.some((g) => PRIVILEGED_UNIX_GROUPS.has(g));
  } catch {
    return null;
  }
}

/**
 * True when the CURRENTLY logged-in panel user may use the sudo file ladder on
 * the server reachable through `executor`. Identity comes from the request-
 * scoped `getContextUser()`; membership is resolved live (cached per session).
 * Absent user context → `false` (fail-closed: internal/no-user callers of the
 * file ladders must not silently escalate).
 */
export async function canEscalatePrivileges(executor: Executor): Promise<boolean> {
  const user = getContextUser();
  const username = user?.username?.trim();
  if (!username) return false;

  const key = `${executor.target.id}:${username.toLowerCase()}`;
  const now = Date.now();
  const hit = membershipCache.get(key);
  if (hit && hit.expires > now) return hit.value;

  const resolved = await resolveMembership(executor, username);
  if (resolved === null) return false; // fail-closed; don't cache an unknown
  membershipCache.set(key, { value: resolved, expires: now + ESCALATION_CACHE_TTL_MS });
  return resolved;
}

/**
 * Enforce the escalation gate before a sudo file ladder. When the logged-in
 * panel user is NOT privileged on the connected server, throw a typed 403 with a
 * clear message INSTEAD of attempting sudo — so an unprivileged user gets the
 * normal permission denial, never root's reach. Callers invoke this only once
 * the UNPRIVILEGED path has already failed with EACCES/EPERM.
 */
export async function assertCanEscalate(
  executor: Executor,
  op: PrivilegedFileOp,
  paths: string[],
): Promise<void> {
  if (await canEscalatePrivileges(executor)) return;
  const username = getContextUser()?.username ?? "actual";
  throw new ForbiddenError(
    `Permiso denegado: la operación "${op}" sobre ${paths.join(", ")} requiere ` +
      `privilegios de administrador (grupo sudo/wheel) en el servidor conectado, ` +
      `y el usuario ${username} no los tiene.`,
  );
}

/**
 * Record that a sudo file ladder ACTUALLY escalated, attributing it to the real
 * panel user (never root / the service account). Structured so the "who did the
 * privileged action" question is answerable from the logs.
 */
export function auditPrivilegedFileOp(op: PrivilegedFileOp, paths: string[], ok: boolean): void {
  const user = getContextUser();
  log.info(
    {
      user: user?.username ?? null,
      userId: user?.userId ?? null,
      op,
      paths,
      ok,
      privileged: true,
    },
    "privileged file op",
  );
}

/** Test seam — drop the membership cache so unit tests don't leak decisions. */
export function __resetEscalationCacheForTests(): void {
  membershipCache.clear();
}
