// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Privileged file READ on the connected server — the ONE implementation.
 *
 * Reading a root-owned file through the panel's unprivileged SSH user always
 * degrades the same way: try the cheap path (SFTP / plain `cat`), then retry
 * with `sudo`. That ladder was copy-pasted in five places, each returning a
 * DIFFERENT contract for "it didn't work":
 *
 *   - `nginx/services/nginx-sudo-io.ts#readMaybeSudo`  → `string | null`
 *   - `mail/controllers/accounts.helpers.ts#readServerFile` → `string | "" | null`
 *   - `webhooks/services/discovery/nginx.detector.ts#readFile` → `""`
 *   - `files/services/directory-privacy.service.ts#readContent` → `""`
 *   - `nginx/services/server-domains.service.ts` → inline, per-file loop
 *
 * Conflating "the file is not there" with "I could not read it" is not
 * cosmetic: mail's `readAccountsFromServer` REGENERATES `/etc/dovecot/users`
 * and `/etc/postfix/vmailbox` from what it reads, so an unreadable file that
 * looked like an empty one used to wipe every mailbox on the box (documented at
 * `accounts.helpers.ts`). Hence the single return contract below is a
 * three-state result — callers map it to whatever shape they expose, but they
 * can no longer LOSE the distinction.
 */

import { quoteArg } from "../executor/quote.js";
import type { ExecResult, Executor } from "../executor/types.js";

/** stderr of `cat` when the path simply does not exist. */
const MISSING_FILE_RE = /no such file|not found/i;

export type PrivilegedReadStatus =
  /** Definitive read — `content` is the file (possibly empty). */
  | "read"
  /** The file is definitely absent (`cat` said "No such file or directory"). */
  | "missing"
  /** Inconclusive: permission denied, transport error, sudo unavailable… */
  | "unreadable";

export interface PrivilegedReadResult {
  status: PrivilegedReadStatus;
  /** File content when `status === "read"`, otherwise `""`. */
  content: string;
}

export interface PrivilegedReadOptions {
  /**
   * Try `executor.readFile` (SFTP) before shelling out. Only a NON-EMPTY read
   * short-circuits: some executors mask a permission error as an empty result,
   * so an empty SFTP read is confirmed through `cat`.
   */
  sftpFirst?: boolean;
  /** Skip the unprivileged `cat` and go straight to `sudo -n cat`. */
  sudoOnly?: boolean;
  /** Truncate the returned content to this many bytes. */
  maxBytes?: number;
  /** Per-command timeout forwarded to `executor.exec`. */
  timeoutMs?: number;
  /**
   * Command runner. Defaults to `executor.exec`. The NGINX module passes a
   * runner that wraps the command in `sh -lc` with the sudo passphrase injected
   * (`injectSudoIntoShellScript`), which the executor boundary cannot see.
   */
  run?: (command: string) => Promise<ExecResult>;
  /**
   * `sudo` flavour for the privileged retry. `"sudo -n"` (default) is
   * non-interactive; `"sudo"` lets the executor boundary inject `-S` + the
   * stored passphrase.
   */
  sudo?: "sudo" | "sudo -n";
}

function truncate(value: string, maxBytes?: number): string {
  return maxBytes != null ? value.slice(0, maxBytes) : value;
}

/**
 * Read a possibly root-owned file: (optional SFTP) → `cat` → `sudo cat`.
 *
 * A zero exit code is a DEFINITIVE read even when the output is empty (an
 * empty file is a legitimate answer); anything else falls through to the next
 * rung of the ladder.
 */
export async function readPrivilegedFile(
  executor: Executor,
  filePath: string,
  opts: PrivilegedReadOptions = {},
): Promise<PrivilegedReadResult> {
  const run =
    opts.run ??
    ((command: string) =>
      executor.exec(command, opts.timeoutMs != null ? { timeoutMs: opts.timeoutMs } : undefined));
  const q = quoteArg(filePath);
  let sawMissing = false;

  if (opts.sftpFirst) {
    try {
      const data = await executor.readFile(filePath, "utf-8");
      const text = typeof data === "string" ? data : data.toString("utf-8");
      if (text && text.trim()) return { status: "read", content: truncate(text, opts.maxBytes) };
    } catch {
      /* fall through to the shell ladder */
    }
  }

  if (!opts.sudoOnly) {
    try {
      // `--` ends option parsing so a path starting with `-` is never a flag.
      const plain = await run(`cat -- ${q}`);
      if (plain.exitCode === 0) {
        return { status: "read", content: truncate(plain.stdout ?? "", opts.maxBytes) };
      }
      if (MISSING_FILE_RE.test(plain.stderr ?? "")) sawMissing = true;
    } catch {
      /* fall through to the sudo attempt */
    }
  }

  try {
    const privileged = await run(`${opts.sudo ?? "sudo -n"} cat -- ${q}`);
    if (privileged.exitCode === 0) {
      return { status: "read", content: truncate(privileged.stdout ?? "", opts.maxBytes) };
    }
    if (MISSING_FILE_RE.test(privileged.stderr ?? "")) sawMissing = true;
  } catch {
    /* unreadable */
  }

  return { status: sawMissing ? "missing" : "unreadable", content: "" };
}

/**
 * `readPrivilegedFile` collapsed to `content | null` — null for BOTH "missing"
 * and "unreadable". Only for callers that genuinely cannot act on the
 * difference; never use it where a missing file triggers a rewrite of state.
 */
export async function readPrivilegedFileOrNull(
  executor: Executor,
  filePath: string,
  opts: PrivilegedReadOptions = {},
): Promise<string | null> {
  const res = await readPrivilegedFile(executor, filePath, opts);
  return res.status === "read" ? res.content : null;
}

/** `readPrivilegedFile` collapsed to `content | ""` (fail-soft scanners). */
export async function readPrivilegedFileOrEmpty(
  executor: Executor,
  filePath: string,
  opts: PrivilegedReadOptions = {},
): Promise<string> {
  return (await readPrivilegedFile(executor, filePath, opts)).content;
}
