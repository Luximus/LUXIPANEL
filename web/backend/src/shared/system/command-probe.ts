// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * "Is this binary on the target's PATH?" — one probe.
 *
 * `terminal-cli` and `hosting/jail` each carried their own `command -v`
 * variant, both preceded by the same binary-name allowlist. Probing through a
 * LOGIN shell matters: the PATH the user actually gets in a PTY includes
 * `~/.local/bin`, nvm shims and friends, so a plain `exec` would report a
 * perfectly installed CLI as missing.
 */

import type { Executor } from "../executor/types.js";

/**
 * Binary names we are willing to interpolate into a shell probe: letters,
 * digits, `_`, `.` and `-`. Anything else never reaches the shell.
 */
export const SAFE_COMMAND_NAME_RE = /^[A-Za-z0-9_.-]+$/;

/** `true` when `command` is a safe binary NAME (not a path, no metacharacters). */
export function isSafeCommandName(command: string): boolean {
  return SAFE_COMMAND_NAME_RE.test(command);
}

export interface CommandProbeOptions {
  /**
   * Decide on the printed path instead of on the exit code. Needed by callers
   * whose original probe wrapped the lookup in `|| true` (the exit code is
   * always 0 there, so only an empty stdout means "not found").
   */
  requireOutput?: boolean;
}

/**
 * `true` when `command` resolves on the target's login-shell PATH.
 * Returns `false` for unsafe names and for any probe failure.
 */
export async function isCommandInPath(
  executor: Executor,
  command: string,
  options: CommandProbeOptions = {},
): Promise<boolean> {
  if (!command || !isSafeCommandName(command)) return false;
  const requireOutput = options.requireOutput === true;
  const probe = requireOutput
    ? `command -v ${command} 2>/dev/null`
    : `command -v ${command} >/dev/null 2>&1`;
  try {
    const result = await executor.exec(`bash -lc '${probe}'`);
    if (result.exitCode !== 0) return false;
    return requireOutput ? result.stdout.trim().length > 0 : true;
  } catch {
    return false;
  }
}
