// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `execShell()` — run a multi-statement shell BODY on the connected server
 * (B-23).
 *
 * Five modules had their own three-line `sh(executor, body, timeoutMs)` doing
 * exactly `executor.exec(\`sh -lc ${quoteArg(body)}\`, { timeoutMs })`
 * (obsidian ×2, databases, nginx-sudo-io, expo-shell).
 *
 * The body travels as a SINGLE quoted argument, so the caller may use pipes,
 * `&&`, redirections and `$VAR` freely — but any value interpolated INTO the
 * body must still be `quoteArg`-ed by the caller: `execShell` quotes the body
 * as a whole, not the values inside it.
 *
 * NOTE — this helper does NOT inject sudo credentials. Call sites that need
 * `sudo` inside the body (databases, nginx) must run
 * `injectSudoIntoShellScript()` on the body FIRST: `sudo` hidden inside
 * `sh -lc '…'` is invisible to the executor-boundary interceptor.
 */

import { quoteArg } from "./quote.js";
import type { ExecOptions, ExecResult, Executor } from "./types.js";

/** `sh -lc '<body>'` as a single command string. */
export function shellCmd(body: string): string {
  return `sh -lc ${quoteArg(body)}`;
}

/** Run `body` through a login shell on the target. */
export function execShell(
  executor: Executor,
  body: string,
  opts?: ExecOptions,
): Promise<ExecResult> {
  return executor.exec(shellCmd(body), opts);
}
