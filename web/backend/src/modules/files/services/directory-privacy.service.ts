// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Directory Privacy (#cPanel-style) — password-protect a directory with HTTP
 * Basic auth via `.htaccess` + `.htpasswd` (Apache). The panel writes both
 * files through the request `Executor`, so everything lands on the connected
 * client server, never the panel host.
 *
 * Password hashing is done here in Node (Apache `apr1` MD5) so the cleartext
 * password never reaches the remote shell / argv — only the resulting hash is
 * written (over SFTP). The `.htpasswd` file is written `0640` + group-owned by
 * the webserver group (www-data/nginx/…) so only the worker can read it; when
 * no webserver group can be detected it falls back to the legacy `0644` (with
 * a warning) so Basic auth keeps working.
 *
 * ⚠️ SECURITY NOTE — apr1 hashes are WEAK: `$apr1$` is 1000-round MD5 and is
 * cheaply crackable offline with modern GPUs. It remains the format here only
 * because it's the lowest common denominator both Apache and nginx accept.
 * Recommend to operators: treat these passwords as low-value (never reuse a
 * real account password) and ROTATE them periodically; the 0640+group step
 * above exists to keep the hash file away from other local users. Migrating
 * the hash format (e.g. bcrypt, supported by nginx via crypt()) is a planned
 * follow-up — do not silently change it here, existing files must keep
 * validating.
 *
 * On nginx this `.htaccess` is inert (nginx ignores `.htaccess`); the UI flags
 * that, mirroring the exposure scanner's `.htaccess` block action.
 */

import crypto from "node:crypto";
import path from "node:path";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { readPrivilegedFileOrEmpty } from "../../../shared/system/privileged-file-io.js";
import { writePrivilegedFile } from "../../../shared/system/privileged-file-write.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { safePath } from "./filesystem.service.js";
import { detectWebserverGroup } from "./webserver-group.js";
import { snapshotService } from "./snapshot.service.js";
import { invalidateDir, invalidateFile, invalidateStat } from "../../../shared/files-cache/index.js";
import {
  nginxBasicAuthService,
  nginxSitesService,
  certbotService,
  type DirAuthResult,
  type PublishCandidate,
} from "../../nginx/services/index.js";

const log = createModuleLogger("dir-privacy");

const PRIVACY_START = "# LUXIPANEL:directory-privacy:start";
const PRIVACY_END = "# LUXIPANEL:directory-privacy:end";
const DEFAULT_REALM = "Área restringida";

export interface DirectoryPrivacyStatus {
  protected: boolean;
  realm: string | null;
  users: string[];
  /** Absolute path of the .htaccess that would (or does) hold the rule. */
  htaccess: string;
  /** Absolute path of the .htpasswd that would (or does) hold the users. */
  htpasswd: string;
  /**
   * Live nginx enforcement state. `.htaccess` is inert on nginx, so this is
   * what actually makes the password prompt appear: `enforced` is true only
   * when the auth_basic block is present in the serving nginx site.
   */
  enforcement: DirAuthResult;
  /** Optional human note from the last action (e.g. TLS couldn't be auto-issued). */
  note?: string;
}

const ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function md5(...parts: Buffer[]): Buffer {
  const h = crypto.createHash("md5");
  for (const p of parts) h.update(p);
  return h.digest();
}

function to64(value: number, count: number): string {
  let out = "";
  let v = value >>> 0;
  for (let i = 0; i < count; i++) {
    out += ITOA64[v & 0x3f];
    v >>>= 6;
  }
  return out;
}

/** Apache MD5 (`$apr1$`) password hash — the classic htpasswd default. */
export function apr1(password: string, salt?: string): string {
  const saltStr = (salt ?? randomSalt()).slice(0, 8);
  const pw = Buffer.from(password, "utf-8");
  const sp = Buffer.from(saltStr, "utf-8");
  const magic = Buffer.from("$apr1$", "utf-8");

  // alternate sum = md5(pw + salt + pw)
  const alt = md5(pw, sp, pw);

  const pieces: Buffer[] = [pw, magic, sp];
  for (let pl = pw.length; pl > 0; pl -= 16) {
    pieces.push(alt.subarray(0, pl > 16 ? 16 : pl));
  }
  // "Then something really weird" — a zero byte for set bits, pw[0] otherwise.
  const zero = Buffer.from([0]);
  for (let i = pw.length; i !== 0; i >>= 1) {
    pieces.push(i & 1 ? zero : pw.subarray(0, 1));
  }

  let result = md5(...pieces);
  for (let i = 0; i < 1000; i++) {
    const round: Buffer[] = [];
    round.push(i & 1 ? pw : result);
    if (i % 3) round.push(sp);
    if (i % 7) round.push(pw);
    round.push(i & 1 ? result : pw);
    result = md5(...round);
  }

  const enc =
    to64((result[0]! << 16) | (result[6]! << 8) | result[12]!, 4) +
    to64((result[1]! << 16) | (result[7]! << 8) | result[13]!, 4) +
    to64((result[2]! << 16) | (result[8]! << 8) | result[14]!, 4) +
    to64((result[3]! << 16) | (result[9]! << 8) | result[15]!, 4) +
    to64((result[4]! << 16) | (result[10]! << 8) | result[5]!, 4) +
    to64(result[11]!, 2);

  return `$apr1$${saltStr}$${enc}`;
}

function randomSalt(): string {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += ITOA64[bytes[i]! & 0x3f];
  return out;
}

/** A valid htpasswd username (no `:` or whitespace, no control chars). */
export function isValidUsername(name: string): boolean {
  return /^[A-Za-z0-9._@-]{1,64}$/.test(name);
}

function sanitizeRealm(realm: string | undefined): string {
  const clean = (realm ?? "").replace(/["\r\n]/g, "").trim();
  return clean || DEFAULT_REALM;
}

/**
 * Read a (possibly root-owned) file via `sudo cat`; "" if absent/unreadable.
 * `.htaccess`/`.htpasswd` commonly live under web roots owned by root or
 * www-data, so a plain SFTP read (as the SSH user) is not reliable.
 */
async function readContent(executor: Executor, file: string): Promise<string> {
  // B-01a: the sudo-cat ladder is the shared `privileged-file-io`. `sudoOnly`
  // keeps the historical behaviour (no unprivileged `cat` attempt) and `sudo`
  // (not `sudo -n`) lets the executor boundary inject the stored passphrase.
  return readPrivilegedFileOrEmpty(executor, file, { sudoOnly: true, sudo: "sudo" });
}

/**
 * Write content to a (possibly root-owned) path: stage a tmp file over SFTP
 * (writable by the SSH user), then `sudo cp` + `sudo chmod` — the shared
 * `writePrivilegedFile` ladder (B-01b). The sudo password is injected by the
 * executor wrapper, which is why the steps stay SEPARATE `sudo …` argv
 * commands instead of one `&&` chain (the boundary can't see a nested sudo).
 *
 * The optional `chgrp` stays here: it is Basic-auth policy, not file plumbing.
 */
async function writeContent(executor: Executor, file: string, content: string, mode: string, group?: string | null): Promise<void> {
  await writePrivilegedFile(executor, file, content, {
    mode,
    // The staged tmp copy is 0600 at creation (and now randomUUID-named) — it
    // may hold password hashes and must never sit world-readable in /tmp, not
    // even for the cp window, nor be symlink-guessable.
    tmpPrefix: "lxp-privacy",
  });
  if (group) {
    const chgrp = await executor.exec(quoteCmd("sudo", ["chgrp", group, file]));
    if (chgrp.exitCode !== 0) {
      // Without the group a 0640 file is unreadable by the worker → Basic
      // auth would hard-fail for visitors. Fall back to world-readable so
      // the protection keeps working, and say so.
      log.warn({ file, group, err: chgrp.stderr.trim() }, "chgrp to webserver group failed; falling back to 0644");
      await executor.exec(quoteCmd("sudo", ["chmod", "644", file]));
    }
  }
}

/**
 * Write `.htpasswd` with the least exposure the local webserver allows:
 * 0640 + group-owned by the detected webserver group (worker can read it,
 * other local users cannot see the crackable apr1 hashes). Falls back to the
 * legacy world-readable 0644 when no webserver group exists on the target.
 */
async function writeHtpasswd(executor: Executor, htpasswd: string, body: string): Promise<void> {
  const group = await detectWebserverGroup(executor);
  if (group) {
    await writeContent(executor, htpasswd, body, "640", group);
  } else {
    log.warn({ htpasswd }, "No webserver group detected; .htpasswd falls back to 0644 (world-readable hashes)");
    await writeContent(executor, htpasswd, body, "644");
  }
}

/** Remove a (possibly root-owned) file via sudo. */
async function removeContent(executor: Executor, file: string): Promise<void> {
  await executor.exec(quoteCmd("sudo", ["rm", "-f", file]));
}

/** Parse `user:hash` lines into a {user → line} map, preserving hashes. */
function parseHtpasswd(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx <= 0) continue;
    map.set(trimmed.slice(0, idx), trimmed);
  }
  return map;
}

/** Strip any existing LUXIPANEL privacy block from an .htaccess body. */
function stripPrivacyBlock(content: string): string {
  const start = content.indexOf(PRIVACY_START);
  if (start === -1) return content;
  const endMarker = content.indexOf(PRIVACY_END, start);
  const end = endMarker === -1 ? content.length : endMarker + PRIVACY_END.length;
  const before = content.slice(0, start).replace(/\n+$/, "");
  const after = content.slice(end).replace(/^\n+/, "");
  return [before, after].filter(Boolean).join("\n\n");
}

function extractRealm(htaccess: string): string | null {
  const m = htaccess.match(/AuthName\s+"([^"]*)"/);
  return m ? (m[1] ?? null) : null;
}

export const directoryPrivacyService = {
  htaccessPath(dirPath: string): string {
    return path.posix.join(safePath(dirPath), ".htaccess");
  },
  htpasswdPath(dirPath: string): string {
    return path.posix.join(safePath(dirPath), ".htpasswd");
  },

  /** Current protection state of a directory: enabled?, realm, users. */
  async getStatus(executor: Executor, dirPath: string): Promise<DirectoryPrivacyStatus> {
    const htaccess = this.htaccessPath(dirPath);
    const htpasswd = this.htpasswdPath(dirPath);
    const htaccessBody = await readContent(executor, htaccess);
    const isProtected = htaccessBody.includes(PRIVACY_START);
    const users = isProtected ? [...parseHtpasswd(await readContent(executor, htpasswd)).keys()] : [];
    const enforcement = await safeEnforcement(() => nginxBasicAuthService.statusForDir(executor, dirPath));
    return {
      protected: isProtected,
      realm: isProtected ? extractRealm(htaccessBody) : null,
      users: users.sort(),
      htaccess,
      htpasswd,
      enforcement,
    };
  },

  /**
   * Enable (or update) protection: upsert a user into `.htpasswd` and write the
   * Basic-auth block into `.htaccess`. Existing `.htaccess` content is kept.
   */
  async protect(
    executor: Executor,
    dirPath: string,
    opts: { username: string; password: string; realm?: string },
  ): Promise<DirectoryPrivacyStatus> {
    if (!isValidUsername(opts.username)) {
      throw new Error("Nombre de usuario inválido (usa letras, números y . _ @ -)");
    }
    if (!opts.password) {
      throw new Error("La contraseña no puede estar vacía");
    }
    const dir = safePath(dirPath);
    const htaccess = path.posix.join(dir, ".htaccess");
    const htpasswd = path.posix.join(dir, ".htpasswd");
    const realm = sanitizeRealm(opts.realm);

    // --- .htpasswd: upsert the user line (hash computed locally) ---
    const users = parseHtpasswd(await readContent(executor, htpasswd));
    users.set(opts.username, `${opts.username}:${apr1(opts.password)}`);
    const htpasswdBody = [...users.values()].join("\n") + "\n";
    await snapshotService.capture(executor, htpasswd, "edit");
    // 0640 + webserver group: the worker must read it, other users must not
    // (apr1 hashes are offline-crackable — see the header note re: rotation).
    await writeHtpasswd(executor, htpasswd, htpasswdBody);

    // --- .htaccess: (re)write our marked Basic-auth block, keep the rest ---
    const existing = stripPrivacyBlock(await readContent(executor, htaccess));
    const block = [
      PRIVACY_START,
      "AuthType Basic",
      `AuthName "${realm}"`,
      `AuthUserFile "${htpasswd}"`,
      "Require valid-user",
      PRIVACY_END,
    ].join("\n");
    const body = (existing ? `${existing.trimEnd()}\n\n` : "") + block + "\n";
    await snapshotService.capture(executor, htaccess, "edit");
    await writeContent(executor, htaccess, body, "644");

    invalidateAll(executor, htaccess, htpasswd);

    // nginx-native enforcement (the part that actually makes the prompt appear).
    // Best-effort: if nginx can't be edited/validated, we keep the credentials
    // and surface the reason instead of failing the whole request.
    const enable = await safeEnforcement(() =>
      nginxBasicAuthService.enableForDir(executor, dir, realm, htpasswd),
    );
    const status = await this.getStatus(executor, dirPath);
    if (!status.enforcement.enforced && enable.reason) status.enforcement.reason = enable.reason;
    return status;
  },

  /** Remove one user; if it was the last, drop protection entirely. */
  async removeUser(executor: Executor, dirPath: string, username: string): Promise<DirectoryPrivacyStatus> {
    const dir = safePath(dirPath);
    const htpasswd = path.posix.join(dir, ".htpasswd");
    const users = parseHtpasswd(await readContent(executor, htpasswd));
    if (!users.delete(username)) {
      return this.getStatus(executor, dirPath);
    }
    if (users.size === 0) {
      return this.unprotect(executor, dirPath);
    }
    await snapshotService.capture(executor, htpasswd, "edit");
    await writeHtpasswd(executor, htpasswd, [...users.values()].join("\n") + "\n");
    invalidateAll(executor, htpasswd);
    return this.getStatus(executor, dirPath);
  },

  /** Disable protection: strip our `.htaccess` block and remove `.htpasswd`. */
  async unprotect(executor: Executor, dirPath: string): Promise<DirectoryPrivacyStatus> {
    const dir = safePath(dirPath);
    const htaccess = path.posix.join(dir, ".htaccess");
    const htpasswd = path.posix.join(dir, ".htpasswd");

    // Drop the nginx block first so nothing references .htpasswd once removed.
    // Throws on an nginx validation error → we keep the files intact (still
    // protected) rather than leaving nginx pointing at a missing user file.
    // Cover both wirings: docroot enforcement and a published `alias` block.
    await nginxBasicAuthService.disableForDir(executor, dir);
    await nginxBasicAuthService.unpublishDir(executor, dir);

    const current = await readContent(executor, htaccess);
    if (current.includes(PRIVACY_START)) {
      const stripped = stripPrivacyBlock(current).trimEnd();
      await snapshotService.capture(executor, htaccess, "edit");
      if (stripped) {
        await writeContent(executor, htaccess, stripped + "\n", "644");
      } else {
        // Nothing left but our block → remove the file entirely.
        await removeContent(executor, htaccess);
      }
    }
    // Drop the credentials file (snapshot first so it's restorable).
    await snapshotService.capture(executor, htpasswd, "delete");
    await removeContent(executor, htpasswd);

    invalidateAll(executor, htaccess, htpasswd);
    return this.getStatus(executor, dirPath);
  },

  /** Every enabled nginx domain the folder can be published under. */
  async listPublishSites(executor: Executor): Promise<PublishCandidate[]> {
    return nginxBasicAuthService.listPublishCandidates(executor);
  },

  /**
   * Publish an already-protected folder under a chosen nginx **domain**, exposing
   * it at a URL via an `alias` location guarded by the folder's existing
   * `.htpasswd`. Optionally provisions TLS for the site (best-effort) when it
   * has none yet. Returns the refreshed status (with `enforcement.publicUrl`).
   */
  async publish(
    executor: Executor,
    dirPath: string,
    opts: { domain: string; site?: string; urlPath?: string; tls?: boolean; email?: string },
  ): Promise<DirectoryPrivacyStatus> {
    const dir = safePath(dirPath);
    const htpasswd = path.posix.join(dir, ".htpasswd");

    const current = await this.getStatus(executor, dirPath);
    if (!current.protected) {
      throw new Error("Primero añade un usuario y contraseña a la carpeta; luego podrás publicarla.");
    }

    const candidates = await nginxBasicAuthService.listPublishCandidates(executor);
    // Match by domain (+ site when given, since a domain could appear in several).
    const cand =
      candidates.find((c) => c.domain === opts.domain && (!opts.site || c.site === opts.site)) ??
      candidates.find((c) => c.domain === opts.domain);
    if (!cand) {
      throw new Error(`El dominio "${opts.domain}" no es un destino válido (debe ser un server_name de un sitio nginx habilitado).`);
    }

    // Best-effort TLS: only when requested and the chosen site has none yet.
    let note: string | undefined;
    if (opts.tls !== false && !cand.ssl) {
      const email = (opts.email ?? "").trim() || `admin@${cand.domain}`;
      const issued = await certbotService.issueWithExecutor(cand.domain, email, executor);
      if (issued.success && issued.certPath && issued.keyPath) {
        try {
          await nginxSitesService.applySslToSite(executor, cand.site, issued.certPath, issued.keyPath);
        } catch (err) {
          note = `Se emitió el certificado pero no se pudo aplicar TLS al sitio: ${(err as Error).message}. Se publicó igualmente.`;
        }
      } else {
        note = `No se pudo emitir TLS automáticamente (${issued.error ?? "error"}); se publicó con el esquema actual del sitio. Habilita SSL para ${cand.domain} desde el módulo Nginx.`;
      }
    }

    const realm = sanitizeRealm(current.realm ?? undefined);
    const pub = await nginxBasicAuthService.publishDir(executor, {
      dir,
      siteName: cand.site,
      host: cand.domain,
      urlPath: opts.urlPath,
      realm,
      htpasswd,
    });

    const status = await this.getStatus(executor, dirPath);
    if (!status.enforcement.enforced && pub.reason) status.enforcement.reason = pub.reason;
    if (note) status.note = note;
    return status;
  },

  /** Remove the published `alias` exposure (keeps the folder's credentials). */
  async unpublish(executor: Executor, dirPath: string): Promise<DirectoryPrivacyStatus> {
    const dir = safePath(dirPath);
    await nginxBasicAuthService.unpublishDir(executor, dir);
    return this.getStatus(executor, dirPath);
  },
};

function invalidateAll(executor: Executor, ...paths: string[]): void {
  for (const p of paths) {
    void invalidateDir(executor, p);
    void invalidateFile(executor, p);
    void invalidateStat(executor, p);
  }
}

/** Read nginx enforcement state without letting an nginx hiccup fail the call. */
async function safeEnforcement(fn: () => Promise<DirAuthResult>): Promise<DirAuthResult> {
  try {
    return await fn();
  } catch (err) {
    return { enforced: false, site: null, url: null, publicUrl: null, reason: (err as Error).message };
  }
}
