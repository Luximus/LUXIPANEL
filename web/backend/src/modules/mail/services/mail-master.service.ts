// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Mail master-access service — a Dovecot "master user" owned by the panel.
 *
 * WHY: Dovecot only keeps a one-way HASH of every mailbox password, so when a
 * user changes their password OUTSIDE the panel (mail client, `doveadm pw`,
 * another tool) the per-account credential captured at create time
 * (`mailbox-credential.service`) silently goes stale and the inbox dies with
 * `MAIL_CREDENTIAL_INVALID`. Nothing can recover that plaintext.
 *
 * Dovecot's answer is the master user: a single privileged login
 * (`<mailbox>*<master>` + master password, see `auth_master_user_separator`)
 * that can open ANY mailbox on that server — exactly what cPanel/Roundcube-style
 * panels use. The panel provisions one per mail server, idempotently:
 *
 *   /etc/dovecot/master-users                       `luxipanel-master:{SHA512-CRYPT}…`
 *   /etc/dovecot/conf.d/95-luxipanel-master.conf    `passdb … master = yes` (2.3 / 2.4 syntax)
 *   ${LUXIPANEL_CONFIG_DIR}/mail/master-access.json  master password, AES-GCM encrypted
 *
 * The master password never leaves the panel host in the clear except inside
 * the TLS-validated IMAP/SMTP session to that same server. It is stored on the
 * TARGET (via dataStore + executor) encrypted with the panel's
 * MAIL_ENCRYPTION_KEY, like the per-account credentials. Provisioning is
 * validated with `doveconf -n` BEFORE `systemctl reload dovecot` and rolled
 * back on a syntax error, so a bad write can never take the mail server down.
 *
 * Consumers (`withImap`, `smtpService.send`) try the master login FIRST and
 * fall back to the per-account credential, so servers the panel cannot
 * provision (no sudo, foreign Dovecot) keep working exactly as before.
 */

import { randomBytes } from "node:crypto";
import path from "node:path";
import { mailConfig } from "../../../config/mail.js";
import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import { getContextExecutor, quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { FILE_MODES } from "../../../shared/system/file-modes.js";
import { dovecotService } from "./dovecot.service.js";
import { mailCryptoService } from "./mail-crypto.service.js";
import { execChecked, writeRootOwnedFile } from "./staging.helpers.js";
import { getContextUser } from "../../../shared/executor/context.js";

const log = createModuleLogger("mail-master");

/** Login name of the panel's Dovecot master user. */
export const MASTER_USERNAME = "luxipanel-master";
/** `auth_master_user_separator` — the IMAP login becomes `<address>*<master>`. */
export const MASTER_SEPARATOR = "*";
/** Single-document collection: one master credential per mail server. */
const STORE_ID = 1;
/** Cache the (encrypted) stored doc per target so the inbox doesn't re-read
 *  the target's JSON on every folder/message request. */
const CACHE_TTL_MS = 60_000;
/** After a provisioning failure, don't retry on every request. */
const FAILURE_TTL_MS = 5 * 60_000;

export interface StoredMasterAccess {
  id: number;
  username: string;
  passwordEncrypted: string;
  createdAt: string;
  rotatedAt: string | null;
  /** Last time an IMAP login with the master credential succeeded. */
  verifiedAt: string | null;
  /** `major.minor[.patch]` of the Dovecot the conf was rendered for. */
  dovecotVersion: string | null;
}

export interface MasterAccessStatus {
  enabled: boolean;
  username: string;
  createdAt: string | null;
  rotatedAt: string | null;
  verifiedAt: string | null;
  dovecotVersion: string | null;
  /** Why the last (lazy) provisioning attempt failed, if it did. */
  lastError: string | null;
}

/** A resolved login the transports can hand to imapflow / nodemailer. */
export interface MailAuthCandidate {
  kind: "master" | "account";
  user: string;
  pass: string;
}

const store = makeKvStore<StoredMasterAccess>({ module: "mail", collection: "master-access" });

interface CacheEntry {
  doc: StoredMasterAccess | null;
  error: string | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<StoredMasterAccess | null>>();

/** Dovecot paths derived from the configured users file (`/etc/dovecot/users`). */
export function masterPaths(usersFile: string = mailConfig.dovecot.usersFile) {
  const dovecotDir = path.dirname(usersFile);
  return {
    dovecotDir,
    masterUsersFile: path.join(dovecotDir, "master-users"),
    confFile: path.join(dovecotDir, "conf.d", "95-luxipanel-master.conf"),
  };
}

/** Parse `# 2.4.1 (…)` / `# 2.3.19.1 (…)` — the first line of `doveconf -n`. */
export function parseDovecotVersion(firstLine: string): { major: number; minor: number; raw: string } | null {
  const m = /(\d+)\.(\d+)(?:\.\d+)*/.exec(firstLine || "");
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), raw: m[0] };
}

/**
 * Render the drop-in that enables the master passdb. Dovecot 2.4 renamed the
 * settings (named `passdb <name> {}` blocks, `passwd_file_path`); 2.3 keeps the
 * classic `driver`/`args` form. Exported for unit tests.
 */
export function renderMasterConf(version: { major: number; minor: number } | null, masterUsersFile: string): string {
  const header = [
    "# LUXIPANEL — acceso maestro del panel a los buzones (Dovecot master user).",
    "# Generado por LUXIPANEL: no editar a mano. El panel inicia sesión como",
    `# <buzón>${MASTER_SEPARATOR}${MASTER_USERNAME} con la clave de ${masterUsersFile}.`,
    `auth_master_user_separator = ${MASTER_SEPARATOR}`,
  ];
  const is24 = !!version && (version.major > 2 || (version.major === 2 && version.minor >= 4));
  const block = is24
    ? [
      `passdb ${MASTER_USERNAME} {`,
      "  driver = passwd-file",
      "  master = yes",
      `  passwd_file_path = ${masterUsersFile}`,
      "}",
    ]
    : [
      "passdb {",
      "  driver = passwd-file",
      "  master = yes",
      `  args = ${masterUsersFile}`,
      "}",
    ];
  return [...header, ...block].join("\n") + "\n";
}

/** Render `/etc/dovecot/master-users` (passwd-file: `user:hash`). */
export function renderMasterUsers(passwordHash: string): string {
  return `${MASTER_USERNAME}:${passwordHash}\n`;
}

/** IMAP/SMTP login name that opens `address` with the master credential. */
export function masterLoginFor(address: string, username: string = MASTER_USERNAME): string {
  return `${address}${MASTER_SEPARATOR}${username}`;
}

function generateMasterPassword(): string {
  // 32 base64url chars ≈ 192 bits; no shell-hostile characters.
  return randomBytes(24).toString("base64url");
}

async function detectDovecotVersion(executor: Executor): Promise<{ major: number; minor: number; raw: string } | null> {
  const cmd = `${quoteCmd("sudo", ["doveconf", "-n"])} 2>/dev/null | head -n 1`;
  const res = await executor.exec(quoteCmd("sh", ["-c", cmd]));
  return parseDovecotVersion(res.stdout.trim());
}

async function filesPresent(executor: Executor): Promise<boolean> {
  const { masterUsersFile, confFile } = masterPaths();
  const res = await executor.exec(quoteCmd("sudo", ["test", "-s", masterUsersFile, "-a", "-s", confFile]));
  return res.exitCode === 0;
}

/**
 * Write the master-users file + the conf drop-in, validate with `doveconf -n`
 * (rolling the drop-in back on failure) and reload Dovecot.
 */
async function installOnServer(executor: Executor, plaintext: string): Promise<string | null> {
  const { masterUsersFile, confFile } = masterPaths();
  const version = await detectDovecotVersion(executor);
  const hash = await dovecotService.hashPasswordWithExecutor(plaintext, executor);
  if (!hash.startsWith("{")) {
    throw new Error(`doveadm pw returned an unexpected hash: ${hash.slice(0, 12)}…`);
  }

  await writeRootOwnedFile(
    executor,
    "dovecot",
    masterUsersFile,
    renderMasterUsers(hash),
    FILE_MODES.OWNER_READABLE,
    FILE_MODES.OWNER_READABLE_STR,
  );
  await execChecked(
    executor,
    quoteCmd("sudo", ["chown", `root:${mailConfig.dovecot.group}`, masterUsersFile]),
    "chown master-users",
  );

  await writeRootOwnedFile(
    executor,
    "dovecot",
    confFile,
    renderMasterConf(version, masterUsersFile),
    FILE_MODES.WORLD_READABLE,
    FILE_MODES.WORLD_READABLE_STR,
  );

  // Validate BEFORE touching the running daemon; a syntax error must never
  // take the mail server down. Roll the drop-in back so the next reload (by
  // anyone) still sees a clean config.
  const check = await executor.exec(`${quoteCmd("sudo", ["doveconf", "-n"])} >/dev/null`);
  if (check.exitCode !== 0) {
    await executor.exec(quoteCmd("sudo", ["rm", "-f", confFile])).catch(() => undefined);
    throw new Error(
      `doveconf rejected the master-user drop-in (${(check.stderr || check.stdout || "").trim() || `exit ${check.exitCode}`}); rolled back.`,
    );
  }
  await dovecotService.reloadWithExecutor(executor);
  return version?.raw ?? null;
}

async function provision(
  executor: Executor,
  existing: StoredMasterAccess | null,
  rotate: boolean,
): Promise<StoredMasterAccess> {
  const targetId = executor.target.id;
  // Keep the current password when only the server files are missing (e.g. a
  // reinstalled Dovecot); mint a new one on first provisioning or rotation.
  const plaintext = existing && !rotate
    ? mailCryptoService.decrypt(existing.passwordEncrypted)
    : generateMasterPassword();
  const dovecotVersion = await installOnServer(executor, plaintext);
  const now = new Date().toISOString();
  const doc: StoredMasterAccess = {
    id: STORE_ID,
    username: MASTER_USERNAME,
    passwordEncrypted: existing && !rotate ? existing.passwordEncrypted : mailCryptoService.encrypt(plaintext),
    createdAt: existing?.createdAt ?? now,
    rotatedAt: existing ? now : null,
    verifiedAt: null,
    dovecotVersion,
  };
  await store(executor).set(STORE_ID, doc);
  log.info({ target: targetId, dovecotVersion, rotated: rotate }, "Dovecot master user provisioned");
  return doc;
}

async function loadOrProvision(executor: Executor, rotate: boolean): Promise<StoredMasterAccess> {
  const existing = (await store(executor).get(STORE_ID)) as StoredMasterAccess | null;
  if (existing && !rotate && (await filesPresent(executor))) return existing;
  return provision(executor, existing, rotate);
}

export const mailMasterService = {
  /** Read a previously configured master login without changing Dovecot. */
  async getExisting(executor: Executor | null = getContextExecutor()): Promise<StoredMasterAccess | null> {
    if (!executor) return null;
    const cached = cache.get(executor.target.id);
    if (cached?.doc && cached.expiresAt > Date.now()) return cached.doc;
    const doc = (await store(executor).get(STORE_ID)) as StoredMasterAccess | null;
    if (!doc || !(await filesPresent(executor))) return null;
    cache.set(executor.target.id, { doc, error: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return doc;
  },
  /**
   * Stored master credential for the connected server, provisioning it on
   * first use. Never throws: a server the panel cannot provision (no sudo,
   * foreign Dovecot, syntax rejected) yields `null` and the caller falls back
   * to the per-account credential. Concurrent callers (folders + messages
   * fire together) share one in-flight provisioning per target.
   */
  async getOrProvision(executor: Executor | null = getContextExecutor()): Promise<StoredMasterAccess | null> {
    if (!executor) return null;
    const key = executor.target.id;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.doc;
    const running = inflight.get(key);
    if (running) return running;

    const task = (async () => {
      try {
        const doc = await loadOrProvision(executor, false);
        cache.set(key, { doc, error: null, expiresAt: Date.now() + CACHE_TTL_MS });
        return doc;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn({ target: key, err: message }, "Master access unavailable on this server");
        cache.set(key, { doc: null, error: message, expiresAt: Date.now() + FAILURE_TTL_MS });
        return null;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, task);
    return task;
  },

  /** Explicit (re)provisioning — `rotate` mints a new master password. Throws. */
  async ensure(executor: Executor, opts: { rotate?: boolean } = {}): Promise<StoredMasterAccess> {
    const key = executor.target.id;
    cache.delete(key);
    const doc = await loadOrProvision(executor, opts.rotate === true);
    cache.set(key, { doc, error: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return doc;
  },

  /** Remove the master user from the server and forget its credential. */
  async disable(executor: Executor): Promise<void> {
    const { masterUsersFile, confFile } = masterPaths();
    await execChecked(executor, quoteCmd("sudo", ["rm", "-f", confFile, masterUsersFile]), "remove master-user files");
    await dovecotService.reloadWithExecutor(executor);
    await store(executor).delete(STORE_ID).catch(() => undefined);
    cache.delete(executor.target.id);
    log.info({ target: executor.target.id }, "Dovecot master user removed");
  },

  /** Status for the UI/API (never the password). */
  async status(executor: Executor): Promise<MasterAccessStatus> {
    const doc = (await store(executor).get(STORE_ID)) as StoredMasterAccess | null;
    const cached = cache.get(executor.target.id);
    return {
      enabled: !!doc && (await filesPresent(executor)),
      username: MASTER_USERNAME,
      createdAt: doc?.createdAt ?? null,
      rotatedAt: doc?.rotatedAt ?? null,
      verifiedAt: doc?.verifiedAt ?? null,
      dovecotVersion: doc?.dovecotVersion ?? null,
      lastError: cached?.error ?? null,
    };
  },

  /** Record a successful master login (best-effort, throttled by the cache). */
  async markVerified(executor: Executor | null = getContextExecutor()): Promise<void> {
    if (!executor) return;
    const cached = cache.get(executor.target.id);
    if (!cached?.doc || cached.doc.verifiedAt) return;
    const doc = { ...cached.doc, verifiedAt: new Date().toISOString() };
    cached.doc = doc;
    await store(executor).set(STORE_ID, doc).catch(() => undefined);
  },

  /**
   * The server rejected the master login: drop the cache so the next request
   * re-checks the files (and re-provisions if someone removed them).
   */
  reportAuthFailure(executor: Executor | null = getContextExecutor()): void {
    if (!executor) return;
    cache.delete(executor.target.id);
  },

  /** Last provisioning error for the connected server (from the cache). */
  lastError(executor: Executor | null = getContextExecutor()): string | null {
    if (!executor) return null;
    return cache.get(executor.target.id)?.error ?? null;
  },

  /**
   * Ordered logins for `address`: master first (when available), then the
   * per-account credential (when captured). Empty when neither exists — the
   * caller turns that into the 409 the inbox UI understands.
   */
  async resolveAuthCandidates(address: string, encryptedPassword: string | null): Promise<MailAuthCandidate[]> {
    const out: MailAuthCandidate[] = [];
    const user = getContextUser();
    const master = user && user.kind !== "admin" ? await this.getExisting() : await this.getOrProvision();
    if (master) {
      try {
        out.push({
          kind: "master",
          user: masterLoginFor(address, master.username),
          pass: mailCryptoService.decrypt(master.passwordEncrypted),
        });
      } catch (err) {
        log.warn({ err, address }, "Stored master credential is not decryptable — ignoring");
      }
    }
    if (encryptedPassword) {
      // The per-account credential may be undecryptable (stored under a previous
      // MAIL_ENCRYPTION_KEY). That must NOT abort the whole login — the master
      // candidate above is what usually works. Skip it instead of throwing so
      // `withImap` can still try the master (this is exactly what let the inbox
      // fail with MAIL_CREDENTIAL_DECRYPT_FAILED on a server the master covers).
      try {
        out.push({ kind: "account", user: address, pass: mailCryptoService.decrypt(encryptedPassword) });
      } catch (err) {
        log.warn({ err, address }, "Stored per-account credential is not decryptable — skipping (master login still tried)");
      }
    }
    return out;
  },

  /** Test seam. */
  _resetCache(): void {
    cache.clear();
    inflight.clear();
  },
};
