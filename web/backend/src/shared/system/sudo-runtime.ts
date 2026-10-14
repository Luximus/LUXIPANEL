// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Sudo runtime — panel-wide transparent sudo-password injection.
 *
 * Most modules shell out with a bare `sudo …` / `sudo -n …` (mail, firewall,
 * dns, postfix, …). On targets without a NOPASSWD sudoers rule those calls
 * fail with "a password is required". This module lets the executor layer
 * transparently rewrite such commands to feed the per-server stored sudo
 * password (AES-256-GCM sidecar, see {@link ./sudo-credentials.ts}) without
 * touching the ~44 call sites.
 *
 * Two hazards handled here:
 *  - Recursion: reading the stored credential itself goes through the
 *    executor (remote-config / kv-store fall back to `sudo -n cat`). The
 *    `sudoBypassALS` flag disables interception while we resolve the
 *    credential so we can't recurse into ourselves.
 *  - Round-trips: managed mode reads the sidecar over SFTP. We memoize the
 *    resolved password per target for a short TTL so we don't re-read it on
 *    every privileged command (keeps the kv-store perf invariant).
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { Executor } from "../executor/types.js";
import { buildSudoPrefix } from "./installer.js";
import { getStoredSudoPassword } from "./sudo-credentials.js";

const sudoBypassALS = new AsyncLocalStorage<true>();

/**
 * Run `fn` with sudo interception disabled. MUST wrap every code path that
 * reads/writes the sudo credential sidecar, otherwise the interceptor would
 * try to resolve the password by reading the file that needs the password.
 */
export function runWithSudoBypass<T>(fn: () => Promise<T>): Promise<T> {
  return sudoBypassALS.run(true, fn);
}

export function isSudoBypassed(): boolean {
  return sudoBypassALS.getStore() === true;
}

interface CacheEntry {
  password: string | null;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

/** Drop the memoized password for a target (call after store/clear). */
export function invalidateSudoPasswordCache(targetId?: string): void {
  if (targetId) cache.delete(targetId);
  else cache.clear();
}

/**
 * Resolve the sudo password for a target, memoized. Reads the encrypted
 * sidecar under a bypass scope so the read itself never re-enters the
 * interceptor. Returns null when no credential is stored.
 */
export async function resolveSudoPassword(executor: Executor): Promise<string | null> {
  const id = executor.target.id;
  const now = Date.now();
  const hit = cache.get(id);
  if (hit && hit.expiresAt > now) return hit.password;

  const password = await runWithSudoBypass(() => getStoredSudoPassword(executor));
  cache.set(id, { password, expiresAt: now + TTL_MS });
  return password;
}

// Matches a `sudo` (optionally `sudo -n`) token at a *command position*:
// start of line, or after `&&`, `||`, `;`, or a newline. Deliberately does
// NOT match `<cmd> | sudo …` (pipe-into-sudo, e.g. `echo x | sudo tee`):
// `sudo -S` consumes stdin for the password, which would collide with the
// piped data. Those few sites keep `sudo -n` (NOPASSWD-only) — documented.
const SUDO_AT_CMD_POS = /(^|&&|\|\||;|\n)(\s*)sudo(?:\s+-n)?\s+/g;

/** True if `cmd` contains a sudo token we would rewrite. */
export function commandUsesSudo(cmd: string): boolean {
  SUDO_AT_CMD_POS.lastIndex = 0;
  return SUDO_AT_CMD_POS.test(cmd);
}

/**
 * Rewrite every command-position `sudo`/`sudo -n` in `cmd` so it reads the
 * password from stdin via {@link buildSudoPrefix}. The replacement text is
 * inserted verbatim (String.replace does not re-scan it), so the prefix's
 * own internal `… | sudo -S` is never matched again.
 */
export function rewriteSudoCommand(cmd: string, password: string): string {
  const prefix = buildSudoPrefix(password); // `printf … | base64 -d | sudo -S -p ''`
  return cmd.replace(SUDO_AT_CMD_POS, (_m, sep: string, ws: string) => `${sep}${ws}${prefix} `);
}

/** Already wired with a password (e.g. by sudoShell) — don't double-rewrite. */
function alreadyPasswordWired(cmd: string): boolean {
  return /base64 -d \| sudo -S/.test(cmd);
}

// The injected prefix carries the sudo password as a base64 argument to
// `printf`. The payload never contains `|` (base64 alphabet + the shell-quoting
// noise exec wrappers add), so everything from `printf` up to the next pipe is
// the secret segment — including the mangled forms that appear inside
// `err.cmd`/`err.message` after `sh -lc` re-quoting.
const SUDO_B64_SEGMENT = /printf[^|]*\|\s*base64 -d\s*\|\s*sudo -S/g;

/**
 * Mask the base64 sudo password in any text destined for logs or API error
 * shapes. Error objects from failed exec calls carry the full command line
 * (`err.cmd`, and duplicated inside `err.message`), which after
 * {@link rewriteSudoCommand}/{@link injectSudoIntoShellScript} contains the
 * credential — callers MUST pass such strings through here before logging.
 */
export function redactSudoSecrets(text: string): string {
  return text.replace(SUDO_B64_SEGMENT, "printf '***REDACTED***' | base64 -d | sudo -S");
}

/**
 * Resolve the sudo password for a target: the stored sidecar credential
 * first (memoized per server), then the live SSH passphrase of THIS executor
 * instance (LP's one-passphrase model). The passphrase is read per-instance
 * and is NEVER written into the shared per-target cache, so one operator's
 * passphrase can't be served to another operator on the same server.
 */
async function resolveSudoPasswordOrHint(inner: Executor): Promise<string | null> {
  const stored = await resolveSudoPassword(inner);
  if (stored) return stored;
  return (await inner.getSudoPasswordHint?.()) ?? null;
}

/**
 * Shared tail of the two injectors: skip when already wired or when there's no
 * command-position sudo token, otherwise resolve the credential and rewrite.
 * No-op (returns the input verbatim) when no credential is available, so the
 * original `sudo -n` graceful behaviour is preserved. Does NOT consult the
 * bypass flag — callers that need it gate before calling.
 */
async function rewriteWithResolvedSudo(inner: Executor, cmd: string): Promise<string> {
  if (alreadyPasswordWired(cmd)) return cmd;
  if (!commandUsesSudo(cmd)) return cmd;
  const password = await resolveSudoPasswordOrHint(inner);
  if (!password) return cmd;
  return rewriteSudoCommand(cmd, password);
}

/**
 * Rewrite every command-position `sudo`/`sudo -n` inside a shell SCRIPT BODY
 * (the string later run as `sh -lc '<body>'`). Modules that wrap their
 * commands in `sh -lc` hide the `sudo` token from the executor-boundary
 * interceptor (it only sees the outer `sh -lc '…'`, where `sudo` is not at a
 * command position). Such callers run the body through this helper first so
 * the credential is injected before wrapping. Pipe-into-sudo (`… | sudo …`)
 * is still left untouched — those call sites must avoid feeding the file
 * content through sudo's stdin (see nginx writes). No-op when no credential
 * is available, preserving the original `sudo -n` (graceful) behaviour.
 */
export async function injectSudoIntoShellScript(inner: Executor, scriptBody: string): Promise<string> {
  return rewriteWithResolvedSudo(inner, scriptBody);
}

/**
 * Given the raw command a module wants to run, return the command the
 * executor should actually run: unchanged when interception doesn't apply,
 * or rewritten to inject the stored sudo password.
 *
 * `inner` MUST be the unwrapped executor so the credential read doesn't
 * bounce back through the interceptor.
 */
export async function maybeInjectSudoPassword(inner: Executor, cmd: string): Promise<string> {
  if (isSudoBypassed()) return cmd;
  return rewriteWithResolvedSudo(inner, cmd);
}
