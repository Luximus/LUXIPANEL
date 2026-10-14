// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Secure staging for files that are later `sudo cp`'d into root-owned
 * locations (Postfix maps, Dovecot users, Sieve scripts, stdin secrets).
 *
 * Security contract (audit Top #9 — C1):
 *  - The staged file is created with `mode: 0o600` ATOMICALLY (the executor
 *    passes the mode to open()/SFTP-open, no write-then-chmod window), so
 *    mailbox routing rows / `{SHA512-CRYPT}` hashes / plaintext passwords are
 *    never group/world-readable, not even briefly.
 *  - Preferred staging root is `${LUXIPANEL_CONFIG_DIR}/cache/<purpose>-staging`
 *    (0700) on the CONNECTED server instead of the world-writable `/tmp`.
 *    If that dir cannot be created (exotic permissions), we fall back to
 *    `/tmp` — still atomic 0600 AND with an unguessable CSPRNG name, so
 *    neither the historical read window nor a pre-planted file/symlink at a
 *    predicted path are viable.
 */

import { randomUUID } from "node:crypto";

import { panelConfigDir } from "../../../config/paths.js";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { FILE_MODES } from "../../../shared/system/file-modes.js";

/** Staging dirs already ensured, keyed by `<targetId>:<dir>` (per process). */
const ensuredDirs = new Set<string>();

async function ensureStagingDir(executor: Executor, dir: string): Promise<void> {
  const key = `${executor.target.id}:${dir}`;
  if (ensuredDirs.has(key)) return;
  await executor.mkdir(dir, { recursive: true });
  // RemoteFs.mkdir has no mode parameter — tighten to owner-only explicitly.
  // Best-effort: a failed chmod must not break the write (the files inside
  // are 0600 regardless).
  await executor.exec(quoteCmd("chmod", [FILE_MODES.OWNER_ONLY_DIR_STR, dir])).catch(() => undefined);
  ensuredDirs.add(key);
}

/**
 * Stage `content` in a 0600 file on the target and return its path.
 * `purpose` picks the staging subdir (e.g. "postfix" → `postfix-staging/`).
 */
export async function stageSecretFile(executor: Executor, purpose: string, content: string): Promise<string> {
  // randomUUID (122 bits CSPRNG): the staged path must be unguessable — a
  // predictable name would let a local user pre-plant a file/symlink at the
  // target path (writeFile opens with O_TRUNC, not O_EXCL, and follows
  // symlinks), capturing the plaintext before our 0600 applies.
  const name = `${purpose}-${randomUUID()}`;
  const stagingDir = `${panelConfigDir()}/cache/${purpose}-staging`;
  try {
    await ensureStagingDir(executor, stagingDir);
    const staged = `${stagingDir}/${name}`;
    await executor.writeFile(staged, content, { encoding: "utf-8", mode: FILE_MODES.OWNER_ONLY });
    return staged;
  } catch {
    // Staging dir unavailable — /tmp fallback, still atomic 0600.
    const fallback = `/tmp/luxipanel-${name}`;
    await executor.writeFile(fallback, content, { encoding: "utf-8", mode: FILE_MODES.OWNER_ONLY });
    return fallback;
  }
}

/**
 * Run a mutating command and throw if it exits non-zero. The executor
 * resolves commands without throwing on failure, so silent-failure parity
 * with the old `execSync` paths (which DID throw) must be explicit.
 */
export async function execChecked(executor: Executor, cmd: string, what: string): Promise<void> {
  const res = await executor.exec(cmd);
  if (res.exitCode !== 0) {
    throw new Error(`${what} failed: ${(res.stderr || res.stdout || "").trim() || `exit ${res.exitCode}`}`);
  }
}

/**
 * Write a file that lives in a ROOT-OWNED directory (`/etc/postfix`,
 * `/etc/dovecot`, …).
 *
 * Tries a direct SFTP write first (works when the panel user owns `dest`) and,
 * on failure, stages the content 0600 and `sudo cp`s it into place — the
 * executor boundary injects the sudo passphrase, like the surrounding
 * `sudo postmap`/`sudo chown` calls already rely on. Throws only if the
 * privileged copy fails, so callers surface an actionable message instead of a
 * raw SFTP "Permission denied".
 *
 * The final `chmod` is best-effort ON PURPOSE: the copy already landed, and the
 * mode was applied atomically on the SFTP fast path.
 *
 * This was `postfix.service#writePostfixFile` and `dovecot.service#
 * writeRootOwnedFile`, line-for-line identical except for the mode.
 *
 * @param purpose Staging subdir / temp-name prefix (e.g. "postfix", "dovecot").
 * @param mode    Numeric mode for the SFTP fast path (applied by open()).
 * @param modeStr Same mode as a `chmod` argument for the privileged path.
 */
export async function writeRootOwnedFile(
  executor: Executor,
  purpose: string,
  dest: string,
  content: string,
  mode: number,
  modeStr: string,
): Promise<void> {
  try {
    await executor.writeFile(dest, content, { encoding: "utf-8", mode });
    return;
  } catch {
    // SFTP write denied (root-owned dir) — fall back to staged sudo copy.
  }
  const tmp = await stageSecretFile(executor, purpose, content);
  try {
    const res = await executor.exec(quoteCmd("sudo", ["cp", tmp, dest]));
    if (res.exitCode !== 0) {
      throw new Error(
        `sudo cp → ${dest} failed: ${(res.stderr || res.stdout || "").trim() || "exit " + res.exitCode}`,
      );
    }
    await executor.exec(quoteCmd("sudo", ["chmod", modeStr, dest])).catch(() => undefined);
  } finally {
    await removeStagedFile(executor, tmp);
  }
}

/** Remove a staged file (SFTP unlink, `rm -f` fallback). Never throws. */
export async function removeStagedFile(executor: Executor, path: string): Promise<void> {
  try {
    await executor.unlink(path);
  } catch {
    await executor.exec(quoteCmd("rm", ["-f", path])).catch(() => undefined);
  }
}
