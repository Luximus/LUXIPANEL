// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { AppError } from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteArg } from "../../../shared/executor/index.js";
import { getContextExecutor } from "../../../shared/executor/context.js";
import { runCommand } from "../../../shared/executor/run-command.js";
import { NON_LOGIN_SHELLS } from "../../../shared/system/shells.js";
import { env } from "../../../config/env.js";
import { panelUserRepository } from "../../auth/repositories/panel-user.repository.js";
import type { NewPanelUser, PanelUser } from "../../auth/models/panel-users.model.js";
import type { MutationStep } from "../../../shared/remote-cache/submit-mutation.js";

const log = createModuleLogger("system-accounts");

const SYSTEM_PASSWORD_PLACEHOLDER = "SYSTEM_AUTH_MANAGED_EXTERNALLY";
// NON_LOGIN_SHELLS is the canonical exact-match Set, now sourced from
// shared/system/shells.ts (SSOT). The `.has(parsed.shell)` checks below keep
// identical exact-match semantics to the previous inline Set.

/**
 * Defense-in-depth against `chpasswd` stdin injection. The password is already
 * rejected for control chars / `:` by `passwordSchema` at the controller, but
 * `createSystemUser`/`buildCreateSteps`/`buildSetPasswordSteps` (and the
 * `applyStepsLive` twin that replays `step.input`) feed `<user>:<pass>\n` into
 * chpasswd's stdin. A newline would let an attacker append a second
 * `root:<pass>` line and reset an arbitrary account. Reject here too so no
 * future caller can bypass the schema.
 */
function assertChpasswdSafe(password: string): void {
  // eslint-disable-next-line no-control-regex
  if (/[\r\n\t\f\v\x00:]/.test(password)) {
    throw new AppError(
      "Password must not contain control characters or ':'",
      400,
      "INVALID_PASSWORD",
    );
  }
}

/**
 * Build the `chpasswd` step that feeds `<user>:<pass>\n` on stdin. Validates the
 * password with `assertChpasswdSafe` first so no caller can bypass the schema.
 * The trailing `\n` and argv are load-bearing (the worker/live-fallback replay
 * `step.input` verbatim into chpasswd's stdin) — keep them identical.
 */
function buildChpasswdStep(username: string, password: string): MutationStep {
  assertChpasswdSafe(password);
  return { type: "sh", argv: ["chpasswd"], sudo: true, input: `${username}:${password}\n` };
}
/**
 * Legacy synthetic role-group prefix. We NO LONGER create `lxp-role-*` groups
 * (permissions now attach to real Linux groups by name). Kept ONLY as a filter:
 * orphaned `lxp-role-*` groups must never appear as assignable groups in the UI
 * nor be touched by membership reconciliation.
 */
export const ROLE_GROUP_PREFIX = "lxp-role-";
/** Linux groups below this GID are system-owned (Debian GID_MIN = 1000). */
export const SYSTEM_GID_MAX = 999;
export const DEFAULT_LOGIN_SHELL = "/bin/bash";

/**
 * Minimal, curated binary allowlist copied into a jail (Track 2). Kept small on
 * purpose: every binary added to a chroot is reachable by the jailed tenant, so
 * the list is the interactive shell's essentials only. Module-specific tools are
 * appended conditionally by `buildJailSetupSteps` based on `allowedModules`.
 */
const JAIL_BASE_BINARIES = [
  "bash", "sh", "ls", "pwd", "cat", "mkdir", "rm", "mv", "cp", "chmod", "chown",
  "find", "stat", "touch", "head", "tail", "grep", "sed", "base64", "tr", "wc",
  "test", "which", "file", "id", "env",
];

/** Extra binaries copied into the jail when the matching module is allowed. */
const JAIL_MODULE_BINARIES: Record<string, string[]> = {
  mail: ["doveadm"],
  cron: ["crontab"],
  backups: ["tar", "gzip"],
};
const FULL_SYNC_COOLDOWN_MS = 60_000;
let lastFullSyncAt = 0;
let fullSyncInFlight: Promise<void> | null = null;
// Per-username cooldown so a burst of navigations (each calls /api/session)
// doesn't fire a fresh SSH `getent passwd` round trip every time.
const USER_SYNC_COOLDOWN_MS = 60_000;
const lastUserSyncAt = new Map<string, number>();

export interface SystemAccount {
  username: string;
  uid: number;
  gid: number;
  displayName: string | null;
  homeDir: string;
  shell: string;
  locked: boolean;
}

function parseDisplayName(gecos: string): string | null {
  const value = gecos.split(",")[0]?.trim() ?? "";
  return value.length > 0 ? value : null;
}

/**
 * Parse one `getent passwd` line into the account fields (without `locked`,
 * which comes from `passwd -S`). Returns null for malformed lines or non-numeric
 * UID/GID — same validation both callers used inline.
 */
export function parsePasswdLine(line: string): Omit<SystemAccount, "locked"> | null {
  const [username, _x, uidRaw, gidRaw, gecos, homeDir, shell] = line.split(":");
  if (!username || !uidRaw || !gidRaw || !homeDir || !shell) return null;
  const uid = Number.parseInt(uidRaw, 10);
  const gid = Number.parseInt(gidRaw, 10);
  if (!Number.isFinite(uid) || !Number.isFinite(gid)) return null;
  return { username, uid, gid, displayName: parseDisplayName(gecos ?? ""), homeDir, shell };
}

/**
 * Parse one `getent group` line (`name:passwd:gid:member1,member2`) into its
 * fields. Returns null when there is no group name (same skip semantics both
 * callers used). `gid` is NaN when unparseable — callers gate with
 * `Number.isFinite`. `members` are SUPPLEMENTARY members only.
 */
function parseGroupLine(line: string): { name: string; gid: number; members: string[] } | null {
  const [name, , gidRaw, membersRaw] = line.split(":");
  if (!name) return null;
  const gid = Number.parseInt(gidRaw ?? "", 10);
  const members = (membersRaw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return { name, gid, members };
}

/** `passwd -S` reports the lock state in the 2nd whitespace field (`L`/`P`/`NP`);
 *  locked ⇒ it starts with `L`. Shared by the single (`passwd -S <user>`) and
 *  batch (`passwd -Sa`, `username status …`) parsers — same criterion. */
function isLockedFromPasswdStatus(line: string): boolean {
  return (line.split(/\s+/)[1] ?? "").startsWith("L");
}

/** `passwd -S <user>` reports the lock state in its 2nd field (`L`/`P`/`NP`). */
function parseLockedFlag(status: string): boolean {
  return isLockedFromPasswdStatus(status);
}

/** Supplementary group names a user belongs to (`id -nG`), [] on any error. */
async function readUserGroups(username: string): Promise<string[]> {
  try {
    const out = await runCommand("id", ["-nG", username], { allowNonZeroExit: true });
    return out.split(/\s+/).map((g) => g.trim()).filter((g) => g.length > 0);
  } catch {
    return [];
  }
}

/**
 * Build the group maps from ONE `getent group` (audit §5 perf): the full-sync
 * previously ran `id -nG <user>` once PER user (N SSH round-trips for N
 * accounts). `getent group` lines are `name:passwd:gid:member1,member2` where
 * the members are SUPPLEMENTARY only, so we also return gid→name to resolve each
 * user's PRIMARY group from their passwd gid.
 */
async function readAllGroupMaps(): Promise<{ supByUser: Map<string, string[]>; gidToName: Map<number, string> }> {
  const supByUser = new Map<string, string[]>();
  const gidToName = new Map<number, string>();
  const out = await runCommand("getent", ["group"], { allowNonZeroExit: true }).catch(() => "");
  for (const raw of out.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parsed = parseGroupLine(line);
    if (!parsed) continue;
    const { name, gid, members } = parsed;
    if (Number.isFinite(gid)) gidToName.set(gid, name);
    for (const m of members) {
      const list = supByUser.get(m) ?? [];
      if (!list.includes(name)) list.push(name);
      supByUser.set(m, list);
    }
  }
  return { supByUser, gidToName };
}

/** Full group set (primary + supplementary) for a user, resolved in memory. */
function resolveUserGroups(user: SystemAccount, maps: { supByUser: Map<string, string[]>; gidToName: Map<number, string> }): string[] {
  const groups = new Set(maps.supByUser.get(user.username) ?? []);
  const primary = maps.gidToName.get(user.gid);
  if (primary) groups.add(primary);
  return [...groups];
}

/**
 * Run a system command ON THE CONNECTED SERVER via the per-request Executor
 * (NEVER on the panel host — every module is per-server, see CLAUDE.md
 * §"Login managed + módulo Usuarios"). Privileged commands pass `sudo: true`
 * (the wrapped executor injects the SSH passphrase as the sudo password).
 *
 * stdin (chpasswd `user:pass`): `executor.exec` has no stdin, so we stage the
 * input in a 0600 tmp file via SFTP and redirect it INSIDE `sudo sh -c`. That
 * keeps sudo's own stdin (used by `sudo -S` for the passphrase) separate from
 * the command's stdin — they don't collide — and the secret never touches argv
 * (no `ps`/audit exposure on the target).
 */
async function getSystemUser(username: string): Promise<SystemAccount | null> {
  const line = await runCommand("getent", ["passwd", username], { allowNonZeroExit: true });
  if (!line) return null;

  const parsed = parsePasswdLine(line);
  if (!parsed) return null;

  const status = await runCommand("passwd", ["-S", parsed.username], { sudo: true, allowNonZeroExit: true });
  return { ...parsed, locked: parseLockedFlag(status) };
}

async function upsertSystemUserInDatabase(systemUser: SystemAccount, precomputedGroups?: string[]): Promise<PanelUser> {
  const existing = await panelUserRepository.findByUsername(systemUser.username);
  const now = new Date();
  // Capture the user's real supplementary groups — source of truth for the
  // group-union permission resolution in buildTokenPayload (no SSH at token time).
  // In the full sync the caller passes a precomputed set (one `getent group`
  // for all users) so we don't run `id -nG` per user.
  const groups = precomputedGroups ?? await readUserGroups(systemUser.username);

  if (!existing) {
    const payload: NewPanelUser = {
      username: systemUser.username,
      email: null,
      displayName: systemUser.displayName,
      passwordHash: SYSTEM_PASSWORD_PLACEHOLDER,
      authProvider: "system",
      systemUid: systemUser.uid,
      systemGid: systemUser.gid,
      homeDir: systemUser.homeDir,
      shell: systemUser.shell,
      managedBySystem: true,
      syncedAt: now,
      roleId: null,
      modules: null,
      groups,
      enabled: !systemUser.locked,
      phoneE164: null,
    };
    return await panelUserRepository.create(payload);
  }

  const patch: Partial<Omit<NewPanelUser, "id">> = {
    authProvider: "system",
    systemUid: systemUser.uid,
    systemGid: systemUser.gid,
    homeDir: systemUser.homeDir,
    shell: systemUser.shell,
    managedBySystem: true,
    syncedAt: now,
    groups,
    enabled: !systemUser.locked,
  };

  if (!existing.displayName || existing.displayName.trim().length === 0) {
    patch.displayName = systemUser.displayName;
  }

  if (!existing.passwordHash || existing.passwordHash !== SYSTEM_PASSWORD_PLACEHOLDER) {
    patch.passwordHash = SYSTEM_PASSWORD_PLACEHOLDER;
  }

  await panelUserRepository.update(existing.id, patch);
  const updated = await panelUserRepository.findById(existing.id);
  return updated ?? existing;
}

async function listInteractiveUsers(): Promise<SystemAccount[]> {
  const output = await runCommand("getent", ["passwd"], { allowNonZeroExit: true });
  if (!output) return [];

  const users: SystemAccount[] = [];
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const parsed = parsePasswdLine(line);
    if (!parsed) continue;
    if (NON_LOGIN_SHELLS.has(parsed.shell)) continue;
    users.push({ ...parsed, locked: false });
  }

  // Lock state in ONE `passwd -Sa` (all accounts) instead of one `passwd -S
  // <user>` per user — the old loop was N SSH+sudo round-trips (N+1 in
  // syncAllUsersToDatabase). Same parsing/semantics per line (2nd field = lock
  // flag); users absent from the batch output keep the default `locked: false`.
  const lockedByUser = await readLockedFlags();
  for (const user of users) {
    user.locked = lockedByUser.get(user.username) ?? false;
  }

  users.sort((a, b) => a.username.localeCompare(b.username));
  return users;
}

/** Lock state for every account in a single `passwd -Sa` (sudo) call. Each line
 *  is `username status …`; the 2nd field starts with `L` when locked (same as
 *  the per-user `passwd -S`). Returns a username→locked map; empty on failure
 *  (callers default to unlocked, preserving prior behavior). */
async function readLockedFlags(): Promise<Map<string, boolean>> {
  const out = await runCommand("passwd", ["-S", "-a"], { sudo: true, allowNonZeroExit: true }).catch(() => "");
  return parseLockedFlags(out);
}

/**
 * Pure parser for `passwd -Sa` output → `username → locked`.
 *
 * Exported because `users.controller#readLinuxUsersFromServer` gets the same
 * text from its own batched round-trip and used to re-implement this loop.
 */
export function parseLockedFlags(output: string): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const username = line.split(/\s+/)[0];
    if (!username) continue;
    map.set(username, isLockedFromPasswdStatus(line));
  }
  return map;
}

async function syncMissingSystemUsersAsDisabled(systemUsers: SystemAccount[]): Promise<void> {
  const users = await panelUserRepository.findAll();
  const existing = new Set(systemUsers.map((account) => account.username));

  for (const user of users) {
    if (!user.managedBySystem) continue;
    if (existing.has(user.username)) continue;
    await panelUserRepository.update(user.id, {
      enabled: false,
      syncedAt: new Date(),
    });
  }
}

export const systemAccountsService = {
  /** Look up a single system user on the connected server (getent passwd).
   *  Returns null when the account does not exist. */
  async getSystemUser(username: string): Promise<SystemAccount | null> {
    return getSystemUser(username);
  },

  /**
   * Lightweight tenant-scoping read (Fase 3): every interactive user with its
   * home dir and supplementary tenant-group membership, using ONLY non-sudo
   * commands (`getent passwd` + `getent group <tenantGroup>`). Safe to run under
   * the privilege-dropped owner executor. Used to count sub-users (quota) and to
   * resolve which accounts belong to the tenant. NOT a replacement for
   * listInteractiveUsers (no lock state, no per-user passwd -S).
   */
  async listUsersWithTenantGroup(tenantGroup: string): Promise<Array<{ username: string; homeDir: string; groups: string[] }>> {
    const passwdOut = await runCommand("getent", ["passwd"], { allowNonZeroExit: true }).catch(() => "");
    // `getent group <name>` lists ONLY supplementary members (primary-group
    // members are not listed) — that's fine: tenant membership also checks the
    // home-dir, which catches sub-users whose PRIMARY group is the tenant group.
    const groupOut = await runCommand("getent", ["group", tenantGroup], { allowNonZeroExit: true }).catch(() => "");
    const supplementaryMembers = new Set(
      (groupOut.split(":")[3] ?? "").split(",").map((m) => m.trim()).filter(Boolean),
    );
    const rows: Array<{ username: string; homeDir: string; groups: string[] }> = [];
    for (const raw of passwdOut.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const parsed = parsePasswdLine(line);
      if (!parsed) continue;
      if (NON_LOGIN_SHELLS.has(parsed.shell)) continue;
      rows.push({
        username: parsed.username,
        homeDir: parsed.homeDir,
        groups: supplementaryMembers.has(parsed.username) ? [tenantGroup] : [],
      });
    }
    return rows;
  },

  async syncAllUsersToDatabase(): Promise<void> {
    // Per-server: needs a connected-server executor. Skip silently when there
    // isn't one (e.g. mid-login before the target is pinned) so auth never
    // breaks — the projection refreshes on the next authenticated request.
    if (!getContextExecutor()) return;
    const users = await listInteractiveUsers();
    // One `getent group` for the whole fleet instead of one `id -nG` per user.
    const groupMaps = await readAllGroupMaps();
    for (const user of users) {
      await upsertSystemUserInDatabase(user, resolveUserGroups(user, groupMaps));
    }
    await syncMissingSystemUsersAsDisabled(users);
    log.info({ count: users.length }, "System users synchronized into panel database");
  },

  async ensureRecentFullSync(): Promise<void> {
    const now = Date.now();
    if (now - lastFullSyncAt < FULL_SYNC_COOLDOWN_MS) {
      return;
    }
    if (!fullSyncInFlight) {
      fullSyncInFlight = this.syncAllUsersToDatabase()
        .then(() => {
          lastFullSyncAt = Date.now();
        })
        .finally(() => {
          fullSyncInFlight = null;
        });
    }
    await fullSyncInFlight;
  },

  async ensureRecentUserSync(username: string): Promise<void> {
    const now = Date.now();
    const prev = lastUserSyncAt.get(username) ?? 0;
    if (now - prev < USER_SYNC_COOLDOWN_MS) return;
    lastUserSyncAt.set(username, now);
    try {
      await this.syncUserToDatabase(username);
    } catch (err) {
      // Allow a retry on the next call instead of being stuck in cooldown.
      lastUserSyncAt.delete(username);
      throw err;
    }
  },

  async syncUserToDatabase(username: string): Promise<PanelUser | null> {
    if (!getContextExecutor()) return null;
    const user = await getSystemUser(username);
    if (!user) return null;
    return await upsertSystemUserInDatabase(user);
  },

  /** Create a REAL Linux group by name if it doesn't exist yet (idempotent). */
  async ensureGroup(name: string): Promise<string> {
    const exists = await runCommand("getent", ["group", name], { allowNonZeroExit: true });
    if (!exists) {
      await runCommand("groupadd", [name], { sudo: true });
    }
    return name;
  },

  /** Add a user to a REAL Linux group synchronously (idempotent `gpasswd -a`). */
  async addUserToGroup(username: string, group: string): Promise<void> {
    await runCommand("gpasswd", ["-a", username, group], { sudo: true, allowNonZeroExit: true });
  },

  /** Rename a REAL Linux group (`groupmod -n`). No-op if already named `next`. */
  async renameGroup(previous: string, next: string): Promise<string> {
    if (previous === next) return next;
    const nextExists = await runCommand("getent", ["group", next], { allowNonZeroExit: true });
    if (nextExists) return next;
    const previousExists = await runCommand("getent", ["group", previous], { allowNonZeroExit: true });
    if (!previousExists) {
      await runCommand("groupadd", [next], { sudo: true });
      return next;
    }
    await runCommand("groupmod", ["-n", next, previous], { sudo: true });
    return next;
  },

  /** Delete a REAL Linux group by name (idempotent). */
  async deleteGroup(name: string): Promise<void> {
    const exists = await runCommand("getent", ["group", name], { allowNonZeroExit: true });
    if (!exists) return;
    await runCommand("groupdel", [name], { sudo: true, allowNonZeroExit: true });
  },

  /** name → gid map of every real Linux group (`getent group`). */
  async listGroupGids(): Promise<Map<string, number>> {
    const out = await runCommand("getent", ["group"], { allowNonZeroExit: true });
    const map = new Map<string, number>();
    for (const raw of out.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const parsed = parseGroupLine(line);
      if (!parsed) continue;
      if (Number.isFinite(parsed.gid)) map.set(parsed.name, parsed.gid);
    }
    return map;
  },

  // ── write-behind step builders (Fase 2) ────────────────────────────────
  // Return the SSH command recipe for a mutation so users.service can enqueue
  // the whole sequence as ONE on-box job (no per-command SSH latency) and the
  // worker applies it before the panel does its getent sync. NO step may exit
  // non-zero, so membership cleanup reads the user's current groups first and
  // only removes the ones they're actually in (gpasswd -d of an absent member
  // would fail the job; we avoid `ignoreError` to keep the worker generic).

  /** Supplementary groups the user currently belongs to (`id -nG`). */
  async userGroups(username: string): Promise<string[]> {
    return readUserGroups(username);
  },

  buildCreateSteps(params: { username: string; password: string; displayName?: string | null; home?: string | null; primaryGroup?: string | null; shell?: string }): MutationStep[] {
    const args = ["-m", "-s", params.shell ?? DEFAULT_LOGIN_SHELL];
    if (params.displayName && params.displayName.trim().length > 0) {
      args.push("-c", params.displayName.trim());
    }
    // Hosting tenants: force the home under the tenant root and the account's
    // primary group to the tenant group (so sub-users live inside the envelope).
    // Admin/normal create never passes these → default /home/<user> + UPG.
    if (params.home && params.home.trim().length > 0) {
      args.push("-d", params.home.trim());
    }
    if (params.primaryGroup && params.primaryGroup.trim().length > 0) {
      args.push("-g", params.primaryGroup.trim());
    }
    args.push(params.username);
    return [
      { type: "sh", argv: ["useradd", ...args], sudo: true },
      buildChpasswdStep(params.username, params.password),
    ];
  },

  buildRenameSteps(currentUsername: string, nextUsername: string): MutationStep[] {
    return [{ type: "sh", argv: ["usermod", "-l", nextUsername, currentUsername], sudo: true }];
  },

  buildSetDisplayNameSteps(username: string, displayName: string | null): MutationStep[] {
    return [{ type: "sh", argv: ["usermod", "-c", displayName ?? "", username], sudo: true }];
  },

  buildSetEnabledSteps(username: string, enabled: boolean): MutationStep[] {
    return [{ type: "sh", argv: ["usermod", enabled ? "-U" : "-L", username], sudo: true }];
  },

  buildSetPasswordSteps(username: string, password: string): MutationStep[] {
    return [buildChpasswdStep(username, password)];
  },

  buildDeleteSteps(username: string): MutationStep[] {
    return [{ type: "sh", argv: ["userdel", username], sudo: true }];
  },

  /**
   * Steps to reconcile a user's membership in the set of ASSIGNABLE Linux
   * groups so it matches `desiredGroups`. The "managed set" = real groups that
   * are user-created (GID >= 1000) and not legacy `lxp-role-*`; we ONLY add to
   * or remove from groups inside it. System groups (GID < 1000: sudo/wheel/
   * docker/…), the legacy synthetic groups and the user's primary group are
   * NEVER touched — so the panel can't accidentally strip a user out of sudo.
   *
   * Reads current membership under `readUsername` (pre-rename) but emits ops
   * under `applyUsername` (post-rename). No step exits non-zero: `-d` only on
   * actual members, `-a` is idempotent. `applyUsername` must exist when these
   * steps run (place AFTER create/rename in the same job).
   */
  async buildGroupMembershipSteps(
    applyUsername: string,
    desiredGroups: string[],
    readUsername: string = applyUsername,
  ): Promise<MutationStep[]> {
    const gids = await this.listGroupGids();
    // The user's PRIMARY group must never be removed (gpasswd -d would fail and
    // it's not a supplementary membership). Empty for brand-new users.
    let primaryGroup = "";
    try {
      primaryGroup = (await runCommand("id", ["-gn", readUsername], { allowNonZeroExit: true })).trim();
    } catch { /* user not visible yet */ }
    // Managed = any real group EXCEPT legacy synthetic groups and the primary
    // group. System groups (sudo, www-data, …) ARE assignable on purpose.
    const isManaged = (name: string): boolean =>
      gids.has(name) && !name.startsWith(ROLE_GROUP_PREFIX) && name !== primaryGroup;

    const managedDesired = new Set(desiredGroups.map((g) => g.trim()).filter((g) => isManaged(g)));

    // Current supplementary groups (may be empty for a brand-new user).
    let current: string[] = [];
    try {
      current = await this.userGroups(readUsername);
    } catch { /* user not visible to getent yet */ }
    const currentManaged = new Set(current.filter((g) => isManaged(g)));

    const steps: MutationStep[] = [];
    // Remove: in a managed group now but not desired.
    for (const g of currentManaged) {
      if (!managedDesired.has(g)) steps.push({ type: "sh", argv: ["gpasswd", "-d", applyUsername, g], sudo: true });
    }
    // Add: desired managed group the user isn't in yet.
    for (const g of managedDesired) {
      if (!currentManaged.has(g)) steps.push({ type: "sh", argv: ["gpasswd", "-a", applyUsername, g], sudo: true });
    }
    return steps;
  },

  /**
   * Build the jailkit chroot-jail setup recipe (Track 2 — interactive shell
   * isolation). Returned as a `MutationStep[]` so the hosting provisioner can
   * APPEND it to the same write-behind job (one transport, atomic with the rest
   * of the tenant provisioning). Every step is idempotent so re-provisioning is
   * safe:
   *   a) `jk_init`     — copies the base jailkit profiles into the jail root.
   *   b) `jk_cp`       — copies the curated binary allowlist (+ module extras)
   *                      with their library dependencies into the jail.
   *   c) mount `proc`  — a /proc inside the jail with `hidepid=2,gid=<group>` so
   *                      the tenant can't see other users' processes.
   *   d) `jk_jailuser` — moves the owner into the jail and sets their LOGIN shell
   *                      to jk_chrootsh. `-m` is the move/modify mode.
   *
   * `homeRoot` is BOTH the home and the jail root (no nested `.jail`) so the
   * panel/worker (Track 1, `sudo -u owner sh -c` on the host) and the jailed PTY
   * see the same tree. The login shell is NEVER hardcoded into `useradd`; it is
   * jk_jailuser that pins it (so a fail-soft revert can restore /bin/bash).
   */
  buildJailSetupSteps(
    homeRoot: string,
    owner: string,
    tenantGroup: string,
    allowedModules: string[],
  ): MutationStep[] {
    // Strict input validation: homeRoot and tenantGroup are interpolated into a
    // concatenation-heavy `sh -c` recipe below (step c). quoteArg() protects
    // the outer argv layer but the body is then re-evaluated by /bin/sh, so a
    // tainted value (tenantGroup=`ten,gid=0,);rm -rf /;#`) escapes `gid=<g>`
    // and runs as root. Validate at the recipe boundary so neither the worker
    // nor the live fallback can ever see an unsafe value.
    //   - tenantGroup: Linux group name (POSIX: [a-z_][a-z0-9_-]{0,31})
    //   - homeRoot: absolute path under /home, ASCII printables only, no
    //     spaces, no `..`, no shell metacharacters.
    // eslint-disable-next-line no-control-regex
    const POSIX_GROUP_NAME = /^[a-z_][a-z0-9_-]{0,31}$/;
    // eslint-disable-next-line no-control-regex
    const POSIX_USER_NAME = /^[a-z_][a-z0-9_-]{0,31}$/;
    const SAFE_HOME_ROOT = /^\/[a-zA-Z0-9._/-]+$/;
    if (!POSIX_GROUP_NAME.test(tenantGroup)) {
      throw new AppError(
        `Invalid tenantGroup: ${JSON.stringify(tenantGroup)}`,
        400,
        "INVALID_TENANT_GROUP",
      );
    }
    if (!POSIX_USER_NAME.test(owner)) {
      throw new AppError(
        `Invalid jail owner: ${JSON.stringify(owner)}`,
        400,
        "INVALID_JAIL_OWNER",
      );
    }
    if (!SAFE_HOME_ROOT.test(homeRoot) || homeRoot.includes("..") || /\s/.test(homeRoot)) {
      throw new AppError(
        `Invalid homeRoot: ${JSON.stringify(homeRoot)}`,
        400,
        "INVALID_HOME_ROOT",
      );
    }

    // jk_init/jk_cp/jk_jailuser live alongside the configured jk_chrootsh path.
    const jailDir = env.JAIL_TOOL_PATH.replace(/\/[^/]*$/, "") || "/usr/sbin";
    const jkBin = (name: string): string => `${jailDir}/${name}`;
    const binaries = [...JAIL_BASE_BINARIES];
    for (const mod of allowedModules) {
      const extra = JAIL_MODULE_BINARIES[mod];
      if (extra) binaries.push(...extra);
    }
    const uniqueBinaries = [...new Set(binaries)];

    return [
      // a) Base profiles (idempotent: jk_init merges, doesn't clobber).
      { type: "sh", argv: [jkBin("jk_init"), "-j", homeRoot, "basicshell", "netutils", "extendedshell"], sudo: true },
      // b) Curated binaries + their shared libs. jk_cp re-copies harmlessly.
      { type: "sh", argv: [jkBin("jk_cp"), "-j", homeRoot, ...uniqueBinaries.map((b) => `/usr/bin/${b}`)], sudo: true },
      // c) /proc inside the jail with hidepid=2 scoped to the tenant group, so
      //    processes outside the tenant are invisible. `mountpoint -q` guard keeps
      //    it idempotent (no double-mount on re-provision).
      {
        type: "sh",
        argv: [
          "sh", "-c",
          `mountpoint -q ${quoteArg(`${homeRoot}/proc`)} || ` +
            `{ mkdir -p ${quoteArg(`${homeRoot}/proc`)} && ` +
            `mount -t proc -o hidepid=2,gid=${quoteArg(tenantGroup)} proc ${quoteArg(`${homeRoot}/proc`)}; }`,
        ],
        sudo: true,
      },
      // d) Move the owner into the jail + set login shell to jk_chrootsh.
      { type: "sh", argv: [jkBin("jk_jailuser"), "-m", "-j", homeRoot, owner], sudo: true },
    ];
  },
};
