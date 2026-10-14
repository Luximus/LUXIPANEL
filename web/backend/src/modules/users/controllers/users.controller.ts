// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Users controller — CRUD for panel users.
 */

import { z } from "zod";
import { ONE_DAY_SECONDS } from "../../../shared/constants.js";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { usersService } from "../services/users.service.js";
import { sshKeysService, generateLoginKeypair } from "../services/ssh-keys.service.js";
import { usernameSchema, displayNameSchema, passwordSchema, emailSchema } from "../../../shared/validators/index.js";
import { getExecutor, quoteCmd } from "../../../shared/executor/index.js";
import { MIN_REAL_UID } from "../../../shared/system/users.js";
import { DirectSshExecutor } from "../../../shared/executor/direct-ssh-executor.js";
import { serveCachedDataTable } from "../../../shared/remote-cache/serve-cached-datatable.js";
import { CACHE_KEYS } from "../../../shared/cache/cacheable-modules.js";
import { panelUserRepository } from "../../auth/repositories/panel-user.repository.js";
import { roleRepository } from "../repositories/role.repository.js";
import {
  ROLE_GROUP_PREFIX,
  parseLockedFlags,
  parsePasswdLine,
  systemAccountsService,
} from "../services/system-accounts.service.js";
import { NotFoundError, ValidationError, AppError, ForbiddenError, ErrorCodes } from "../../../shared/errors/index.js";
import { getContextUser } from "../../../shared/executor/context.js";
import { isHostingSession, getTenantEnvelope, filterTenantUsers, assertTargetInTenant, assertTenantUsernameSafe } from "../../../shared/tenant/tenant-scope.js";
import { totpRepository } from "../../auth/repositories/index.js";
import { totpService } from "../../auth/services/index.js";
import { scopeSessionMap } from "../services/session-scope.js";

type LinuxUserRow = {
  id: number;
  username: string;
  email: null;
  displayName: string | null;
  roleId: null;
  role: null;
  modules: never[];
  enabled: boolean;
  phoneE164: null;
  authProvider: "system";
  systemUid: number;
  systemGid: number;
  homeDir: string;
  shell: string;
  managedBySystem: true;
  syncedAt: null;
  /** Account creation — home dir birth time (`stat %W`), ctime fallback. ISO. */
  createdAt: string | null;
  /** Last change — shadow last-password-change day, home mtime fallback. ISO. */
  updatedAt: string | null;
};

/** Epoch seconds → ISO string, or null for 0/negative (unknown). */
function epochSecondsToIso(seconds: number): string | null {
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

async function readLinuxUsersFromServer(req: Request): Promise<LinuxUserRow[]> {
  const executor = getExecutor(req);
  let passwdOut = "";
  let lockOut = "";
  let shadowOut = "";

  try {
    // Pull /etc/passwd, the `passwd -Sa` lock-status and `getent shadow`
    // (last-password-change day, field 3) in a single round-trip. The sudo
    // sections are best-effort: if unavailable we fall back gracefully.
    // MIRRORS collector-users.py 1:1 (cache and live read must be identical).
    const result = await executor.exec(quoteCmd("sh", [
      "-lc",
      "getent passwd; printf '\\n---\\n'; sudo -n passwd -Sa 2>/dev/null || true; " +
        "printf '\\n---\\n'; sudo -n getent shadow 2>/dev/null || true",
    ]));
    const [first, second, third] = result.stdout.split("\n---\n");
    passwdOut = first ?? "";
    lockOut = second ?? "";
    shadowOut = third ?? "";
  } catch {
    return [];
  }

  // username -> locked flag from `passwd -Sa` (best-effort). Same parser the
  // service uses, so cache and live read cannot drift.
  const lockedByName = parseLockedFlags(lockOut);

  // username -> last-password-change day (shadow field 3, days since epoch).
  const lastChangeByName = new Map<string, number>();
  for (const raw of shadowOut.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(":");
    const name = parts[0];
    const days = Number.parseInt(parts[2] ?? "", 10);
    if (name && Number.isFinite(days) && days > 0) lastChangeByName.set(name, days);
  }

  // Parse passwd first (we need each home dir to batch-stat birth/ctime/mtime).
  const parsed: Array<{ name: string; uid: number; gid: number; displayName: string | null; homeDir: string; shell: string }> = [];
  for (const raw of passwdOut.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // One `getent passwd` parser for the whole module (service + controller).
    const account = parsePasswdLine(line);
    if (!account) continue;
    parsed.push({
      name: account.username,
      uid: account.uid,
      gid: account.gid,
      displayName: account.displayName,
      homeDir: account.homeDir,
      shell: account.shell,
    });
  }

  // Batch-stat every home in one call: `%n|%W|%Z|%Y` = path|birth|ctime|mtime.
  // Missing homes go to stderr (ignored) — those rows fall back to null dates.
  const homeStat = new Map<string, { birth: number; ctime: number; mtime: number }>();
  const homes = [...new Set(parsed.map((p) => p.homeDir))];
  // Chunk the paths (audit §5): a single `stat … <all homes>` can blow past
  // ARG_MAX with many accounts and the `catch` would silently null EVERY date.
  const STAT_BATCH = 200;
  for (let i = 0; i < homes.length; i += STAT_BATCH) {
    const batch = homes.slice(i, i + STAT_BATCH);
    try {
      const statRes = await executor.exec(quoteCmd("stat", ["-c", "%n|%W|%Z|%Y", ...batch]));
      for (const raw of statRes.stdout.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        const segs = line.split("|");
        if (segs.length < 4) continue;
        const path = segs[0];
        if (!path) continue;
        homeStat.set(path, {
          birth: Number.parseInt(segs[1] ?? "", 10) || 0,
          ctime: Number.parseInt(segs[2] ?? "", 10) || 0,
          mtime: Number.parseInt(segs[3] ?? "", 10) || 0,
        });
      }
    } catch {
      /* stat unavailable for this batch — those dates stay null */
    }
  }

  const out: LinuxUserRow[] = [];
  for (const p of parsed) {
    const locked = lockedByName.get(p.name) ?? false;
    const st = homeStat.get(p.homeDir);
    const createdSecs = st ? (st.birth > 0 ? st.birth : st.ctime) : 0;
    const changeDay = lastChangeByName.get(p.name);
    const updatedSecs = changeDay ? changeDay * ONE_DAY_SECONDS : st ? st.mtime : 0;

    out.push({
      id: p.uid,
      username: p.name,
      email: null,
      displayName: p.displayName,
      roleId: null,
      role: null,
      modules: [],
      enabled: !locked,
      phoneE164: null,
      authProvider: "system",
      systemUid: p.uid,
      systemGid: p.gid,
      homeDir: p.homeDir,
      shell: p.shell,
      managedBySystem: true,
      syncedAt: null,
      createdAt: epochSecondsToIso(createdSecs),
      updatedAt: epochSecondsToIso(updatedSecs),
    });
  }
  return out;
}

/** Parse the optional per-user modules override (JSON array), [] if none. */
function parseModules(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

const RESERVED_SYSTEM_USERNAMES = new Set([
  "root",
  "daemon",
  "bin",
  "sys",
  "sync",
  "games",
  "man",
  "lp",
  "mail",
  "news",
  "uucp",
  "proxy",
  "www-data",
  "backup",
  "list",
  "irc",
  "_apt",
  "nobody",
  "systemd-network",
  "systemd-resolve",
  "messagebus",
  "redis",
  "postgres",
  "mysql",
  "mongodb",
  "nginx",
  "sshd",
]);

// NOTE: diverges from shared NON_LOGIN_SHELLS / isNonLoginShell (shared/system/
// shells.ts) — this UI-hiding check ALSO treats `/sync` as non-login (e.g. the
// `sync` system account). Keep `/sync` here; do not collapse into the shared set.
const NON_LOGIN_SHELL_SUFFIXES = ["/nologin", "/false", "/sync"];

function shouldHideSystemAccount(user: {
  username: string;
  systemUid: number | null;
  managedBySystem: boolean | null;
  shell: string | null;
}): boolean {
  const username = user.username.toLowerCase();
  const shell = (user.shell ?? "").trim().toLowerCase();

  if (RESERVED_SYSTEM_USERNAMES.has(username)) return true;
  if (shell.length > 0 && NON_LOGIN_SHELL_SUFFIXES.some((suffix) => shell.endsWith(suffix))) return true;

  // Typical Linux service/system accounts are below 1000.
  if (user.managedBySystem && user.systemUid !== null && user.systemUid < MIN_REAL_UID) return true;

  return false;
}

const createUserSchema = z.object({
  username: usernameSchema,
  email: emailSchema.optional(),
  displayName: displayNameSchema.optional(),
  password: passwordSchema,
  groups: z.array(z.string().min(1).max(64)).optional(),
  modules: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
  phoneE164: z.string().max(20).optional(),
});

const updateUserSchema = z.object({
  username: usernameSchema.optional(),
  email: emailSchema.nullable().optional(),
  displayName: displayNameSchema.optional(),
  groups: z.array(z.string().min(1).max(64)).optional(),
  modules: z.array(z.string()).nullable().optional(),
  enabled: z.boolean().optional(),
  phoneE164: z.string().max(20).nullable().optional(),
  _lookupUsername: z.string().max(64).optional(),
});

/** Resolve the authoritative system username for an SSH-keys request: prefer
 *  the panel record by id/uid, fall back to the explicitly provided username
 *  (the DataTable row always carries it). */
async function resolveUsername(idRaw: string, provided: unknown): Promise<string> {
  const candidate = typeof provided === "string" && provided.trim().length > 0 ? provided.trim() : undefined;
  const id = parseInt(idRaw, 10);
  let username: string | undefined;
  if (Number.isFinite(id)) {
    const user = (await panelUserRepository.findById(id)) ?? (await panelUserRepository.findBySystemUid(id));
    if (user) username = user.username;
  }
  if (!username) username = candidate;
  if (!username) throw new NotFoundError("User");
  const uname = username.trim();

  // SECURITY (audit §5): the SSH-key routes accept any `:id` and fall back to a
  // client-supplied username, so `POST /api/users/999999/ssh-keys` with
  // `username=root` would otherwise try to install a key in ~root/.ssh — the
  // service layer doesn't protect root here. Reject it universally.
  if (uname === "root") throw new ForbiddenError("No puedes gestionar claves SSH de root.");

  // Hosting tenants may only manage their OWN members, and never a
  // system/privileged account.
  const ctx = getContextUser();
  if (isHostingSession(ctx)) {
    assertTenantUsernameSafe(uname);
    const env = getTenantEnvelope(ctx!);
    const groups = await systemAccountsService.userGroups(uname).catch(() => [] as string[]);
    assertTargetInTenant(env, { username: uname, groups });
  }
  return uname;
}

export const usersController = {
  /** GET /api/users — list Linux users from connected server (no DB).
   *  Cache-first: the engine's collector-users.py runs `getent passwd +
   *  passwd -Sa` on the customer's server and stores the full LinuxUserRow
   *  list. Filtering (hide system accounts) stays in the controller. */
  list: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const cached = await serveCachedDataTable<LinuxUserRow>({
      executor, module: CACHE_KEYS.users.system.module, collection: CACHE_KEYS.users.system.collection,
      liveLoader: () => readLinuxUsersFromServer(req),
    });
    const rows = cached.rows.filter((u) => !shouldHideSystemAccount({
      username: u.username,
      systemUid: u.systemUid,
      managedBySystem: u.managedBySystem,
      shell: u.shell,
    }));

    // Join panel metadata (Linux group memberships) by username so the table
    // shows each user's groups and effective modules. Fast kv reads.
    const panelUsers = await panelUserRepository.findAll().catch(() => []);
    const byName = new Map(panelUsers.map((u) => [u.username.toLowerCase(), u]));
    const records = await roleRepository.findAll().catch(() => []);
    const modulesByGroup = new Map(
      records.map((r) => [r.name, Array.isArray(r.modules) ? (r.modules as unknown as string[]) : []]),
    );

    const data = rows.map((u) => {
      const meta = byName.get(u.username.toLowerCase());
      // Hide the legacy synthetic role groups and the user's own primary group.
      const groups = (meta?.groups ?? [])
        .filter((g) => !g.startsWith(ROLE_GROUP_PREFIX) && g !== u.username);
      const override = parseModules(meta?.modules ?? null);
      const fromGroups = groups.flatMap((g) => modulesByGroup.get(g) ?? []);
      const modules = [...new Set([...override, ...fromGroups])].sort();
      // Use the PANEL user id (so edit/delete PUT /api/users/:id hit the right
      // record); fall back to the Linux UID only when not yet synced. Overlay
      // panel metadata (email/displayName/phone) so the edit dialog loads them.
      // Prefer the panel's recorded creation timestamp (when the user was
      // created here) over the Linux home-dir birth time fallback from the
      // collector/live read.
      let createdAt = u.createdAt;
      const metaCreated = (meta as { createdAt?: unknown } | undefined)?.createdAt;
      if (metaCreated) {
        const d = new Date(metaCreated as string | number | Date);
        if (!Number.isNaN(d.getTime())) createdAt = d.toISOString();
      }
      return {
        ...u,
        id: meta?.id ?? u.id,
        systemUid: u.systemUid,
        email: meta?.email ?? null,
        displayName: meta?.displayName ?? u.displayName,
        phoneE164: meta?.phoneE164 ?? null,
        createdAt,
        groups,
        modules,
      };
    });

    // ── Fase 3: hosting tenant scoping. The cache (lprc:*) is the WHOLE VPS's
    //    user list (shared per-server, collector knows nothing of tenants), so
    //    the per-tenant cut lives HERE — same place/pattern as
    //    shouldHideSystemAccount. Uses the already-computed `groups` + each row's
    //    `homeDir`. Admin/normal sessions get the full list untouched.
    let out = data;
    const ctx = getContextUser();
    if (isHostingSession(ctx)) {
      const env = getTenantEnvelope(ctx!);
      out = filterTenantUsers(env, data);
    }

    res.json({ ok: true, data: out });
  }),

  /** GET /api/users/sessions — LIVE (uncached) presence map for the table:
   *  who is online, how many active sessions each user has, and their last
   *  login. Runs `who`+`lslogins` and `journalctl` (parallel) on the server.
   *  Fail-soft: any error returns an empty map so the table just omits dots.
   *
   *  LAST-LOGIN SOURCE (why journald is primary): on Debian 13 / OpenSSH 10
   *  the classic last-login plumbing is GONE — the `lastlog` command and
   *  `pam_lastlog` were dropped, and the PAM session stack writes neither
   *  `/var/log/lastlog` nor `/var/log/wtmp` (no pam_lastlog2 / pam_wtmpdb),
   *  so `lastlog`/`lslogins` return empty or a value frozen at the last *pty*
   *  login and never update — that is the "last login never changes" bug.
   *  journald is the only source that records EVERY authentication
   *  (`sshd-session: Accepted … for <user> from <ip>`), always current, so it
   *  is the authoritative source. `lslogins` then `lastlog` stay as fallbacks
   *  for older servers / hosts where the journal isn't readable. Note: the
   *  panel's own SSH service account legitimately shows "just now" because the
   *  panel itself authenticates as it on every poll. */
  sessions: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const data: Record<string, { online: boolean; connections: number; lastLogin: string | null }> = {};
    const ensure = (user: string) =>
      (data[user] ??= { online: false, connections: 0, lastLogin: null });
    try {
      // Two independent reads in parallel:
      //  A) who + lslogins + legacy lastlog (no privilege needed).
      //  B) journald sshd login events (root-only → top-level `sudo` so the
      //     executor injects the passphrase; `-g` filters in-engine, newest
      //     first, capped). Both fail-soft to "" so one missing source is fine.
      const [presence, journal] = await Promise.all([
        executor
          .exec(quoteCmd("sh", [
            "-lc",
            // LC_ALL=C pins formats to English; lslogins --time-format=iso → ISO-8601.
            "LC_ALL=C who; printf '\\n---\\n'; " +
              "LC_ALL=C lslogins --time-format=iso -o USER,LAST-LOGIN --noheadings 2>/dev/null || true; " +
              "printf '\\n---\\n'; LC_ALL=C lastlog 2>/dev/null || true",
          ]))
          .then((r) => r.stdout)
          .catch(() => ""),
        executor
          .exec(quoteCmd("sudo", [
            "journalctl", "_COMM=sshd-session", "_COMM=sshd",
            "-g", "Accepted .* for ", "-r", "-n", "500",
            "-o", "short-iso", "--no-pager",
          ]))
          .then((r) => r.stdout)
          .catch(() => ""),
      ]);

      const [whoOut, lsloginsOut, lastlogOut] = presence.split("\n---\n");

      // `who`: one line per active login session → online + session count.
      for (const raw of (whoOut ?? "").split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        const user = line.split(/\s+/)[0];
        if (!user) continue;
        const e = ensure(user);
        e.online = true;
        e.connections += 1;
      }

      // journald (AUTHORITATIVE): "<iso> host sshd-session[pid]: Accepted
      // <method> for <user> from <ip> …", newest-first → first hit per user wins.
      const acceptedRe = /^(\S+)\s.*?Accepted\s+\S+\s+for\s+(\S+)\s+from\s/;
      for (const raw of (journal ?? "").split(/\r?\n/)) {
        const m = raw.match(acceptedRe);
        if (!m) continue;
        const iso = m[1]!;
        const user = m[2]!;
        if (data[user]?.lastLogin) continue; // already have a newer hit
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) continue;
        ensure(user).lastLogin = d.toISOString();
      }

      // `lslogins` fallback: "<user>  <iso>" (blank login col = never). Only
      // fills users journald didn't cover (older hosts / unreadable journal).
      for (const raw of (lsloginsOut ?? "").split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        const [user, iso] = line.split(/\s+/);
        if (!user || !iso || data[user]?.lastLogin) continue;
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) continue;
        ensure(user).lastLogin = d.toISOString();
      }

      // Legacy `lastlog` fallback (older distros): header row then one row per
      // user. Trailing column is an English date (LC_ALL=C); "Never" → null.
      const dateRe = /[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2}.*\d{4}\s*$/;
      const lines = (lastlogOut ?? "").split(/\r?\n/);
      for (let i = 1; i < lines.length; i++) {
        const line = (lines[i] ?? "").trim();
        if (!line) continue;
        const user = line.split(/\s+/)[0];
        if (!user || data[user]?.lastLogin) continue;
        const m = line.match(dateRe);
        if (!m) continue;
        const d = new Date(m[0].trim());
        if (Number.isNaN(d.getTime())) continue;
        ensure(user).lastLogin = d.toISOString();
      }
    } catch {
      /* fail-soft: empty map */
    }
    // Presence is gathered for the whole VPS. Hosting tenants may only receive
    // sessions belonging to accounts visible in their own envelope, just like
    // GET /api/users. Resolve membership server-side; the client cannot be the
    // security boundary for this map.
    const ctx = getContextUser();
    if (isHostingSession(ctx)) {
      const env = getTenantEnvelope(ctx!);
      const cached = await serveCachedDataTable<LinuxUserRow>({
        executor, module: CACHE_KEYS.users.system.module, collection: CACHE_KEYS.users.system.collection,
        liveLoader: () => readLinuxUsersFromServer(req),
      });
      const panelUsers = await panelUserRepository.findAll().catch(() => []);
      const visibleRows = cached.rows.filter((user) => !shouldHideSystemAccount({
        username: user.username,
        systemUid: user.systemUid,
        managedBySystem: user.managedBySystem,
        shell: user.shell,
      }));
      res.json({ ok: true, data: scopeSessionMap(data, visibleRows, panelUsers, env) });
      return;
    }
    res.json({ ok: true, data });
  }),

  /** POST /api/users — create a new user. */
  create: asyncHandler(async (req: Request, res: Response) => {
    const body = createUserSchema.parse(req.body);
    const { user, job } = await usersService.create(body);
    res.status(201).json({ ok: true, data: { id: user.id, username: user.username, job } });
  }),

  /** PUT /api/users/:id — update a user. */
  update: asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const body = updateUserSchema.parse(req.body);
    const job = await usersService.update(id, body);
    res.json({ ok: true, job });
  }),

  /** DELETE /api/users/:id — delete a user. */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const lookupUsername = typeof req.query["username"] === "string" ? req.query["username"] : undefined;
    const job = await usersService.delete(id, lookupUsername);
    res.json({ ok: true, job });
  }),

  /** PUT /api/users/:id/password — change a user's Linux password.
   *  Hardened: only members of the Linux `sudo` group (wheel on RHEL) may do it,
   *  AND it is gated by the caller's own TOTP (2FA must be enabled+registered,
   *  and a valid code supplied for THIS change). */
  changePassword: asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const { password, totpCode } = z
      .object({ password: passwordSchema, totpCode: z.string().trim().min(6).max(10) })
      .parse(req.body);

    const caller = res.locals.user;
    if (!caller) throw new ForbiddenError("No autorizado.");

    // Only sudo-group members can change OTHER users' passwords. Authoritative
    // live check on the connected server (`id -nG`); not the JWT `kind`, which
    // can also be granted by a role carrying the `admin` module.
    const callerGroups = await systemAccountsService.userGroups(caller.username);
    const inSudo = callerGroups.some((g) => {
      const n = g.trim().toLowerCase();
      return n === "sudo" || n === "wheel";
    });
    if (!inSudo) {
      throw new ForbiddenError("Solo los usuarios del grupo sudo pueden cambiar contraseñas de otros usuarios.");
    }

    // The caller must have 2FA active+registered. If not, we refuse (no silent
    // bypass) and the frontend points them to Ajustes › Seguridad.
    const totp = await totpRepository.getByUser(caller.userId);
    if (!totp?.enabled) {
      throw new AppError(
        "Debes activar 2FA en Ajustes › Seguridad antes de cambiar contraseñas.",
        403,
        ErrorCodes.TWOFA_REQUIRED,
      );
    }
    const valid = await totpService.verify(totpCode, totp.secret);
    if (!valid) {
      throw new AppError("Código 2FA incorrecto.", 401, "INVALID_TOTP");
    }

    await usersService.changePassword(id, password);
    res.json({ ok: true });
  }),

  /** GET /api/users/:id/ssh-keys — list a user's authorized SSH keys. */
  listSshKeys: asyncHandler(async (req: Request, res: Response) => {
    const username = await resolveUsername(String(req.params.id), req.query["username"]);
    const data = await sshKeysService.list(username);
    res.json({ ok: true, data });
  }),

  /** POST /api/users/:id/login-key — generate an SSH login key pair for the
   *  user: install the PUBLIC key into authorized_keys on the client server and
   *  return the PRIVATE key ONCE (encrypted with the supplied passphrase) so an
   *  admin can register it manually in LP-LICENSE-SERVER. */
  generateLoginKey: asyncHandler(async (req: Request, res: Response) => {
    const { passphrase, username: bodyUsername } = z
      .object({ passphrase: z.string().min(1).max(256), username: z.string().max(64).optional() })
      .parse(req.body);
    const username = await resolveUsername(String(req.params.id), bodyUsername);
    // Validate the supplied password against the user's actual Linux account via
    // SSH login (so the private key isn't encrypted with the wrong passphrase).
    const executor = getExecutor(req);
    if (executor instanceof DirectSshExecutor) {
      const ok = await executor.verifyAccountPassword(username, passphrase);
      if (!ok) throw new ValidationError("La contraseña no coincide con la del usuario en el servidor.");
    }
    const keypair = generateLoginKeypair(passphrase, `${username}@luxipanel-login`);
    await sshKeysService.add(username, keypair.publicKey);
    res.status(201).json({ ok: true, data: keypair });
  }),

  /** POST /api/users/:id/ssh-keys — register a new SSH public key. */
  addSshKey: asyncHandler(async (req: Request, res: Response) => {
    const { publicKey, username: bodyUsername } = z
      .object({ publicKey: z.string().min(1).max(16384), username: z.string().max(64).optional() })
      .parse(req.body);
    const username = await resolveUsername(String(req.params.id), bodyUsername);
    await sshKeysService.add(username, publicKey);
    res.status(201).json({ ok: true });
  }),

  /** DELETE /api/users/:id/ssh-keys — remove an SSH key by its id. */
  removeSshKey: asyncHandler(async (req: Request, res: Response) => {
    const { keyId, username: bodyUsername } = z
      .object({ keyId: z.string().min(1).max(128), username: z.string().max(64).optional() })
      .parse({ ...req.body, ...req.query });
    const username = await resolveUsername(String(req.params.id), bodyUsername);
    await sshKeysService.remove(username, keyId);
    res.json({ ok: true });
  }),
};
