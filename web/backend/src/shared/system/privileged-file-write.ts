// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Privileged file WRITE on the connected server — the ONE implementation
 * (B-01b; the read half lives in `privileged-file-io.ts`).
 *
 * The panel's SSH user cannot write root-owned paths, and content must NEVER be
 * piped into `sudo`'s stdin (that collides with `sudo -S`, which reads the
 * passphrase from the same stream — `printf … | sudo -S tee` ate the content as
 * the password). So every writer follows the same ladder:
 *
 *     stage a 0600 temp file over SFTP  →  sudo cp into place  →  sudo chmod
 *
 * That ladder was copy-pasted in `nginx/services/nginx-sudo-io.ts#writeSudo`,
 * `mail/services/postfix.service.ts#writePostfixFile`,
 * `mail/services/dovecot.service.ts#writeRootOwnedFile` and
 * `files/services/directory-privacy.service.ts#writeContent`.
 *
 * SECURITY — the staging name must be UNGUESSABLE and 0600 from creation.
 * `directory-privacy` used `Date.now() + Math.random()`, which lets a local
 * user pre-plant a symlink at the staging path and capture the (secret)
 * content, because `writeFile` opens with O_TRUNC and follows symlinks. This
 * helper always uses `randomUUID()` (CSPRNG) and `mode: 0o600`.
 *
 * TWO execution shapes, because how `sudo` reaches the target differs:
 *  - `"separate"` (default) — each privileged step is its own `executor.exec`
 *    with `sudo` as argv[0], so the executor's sudo-boundary interceptor SEES
 *    it and injects `-S` + the stored passphrase.
 *  - `"combined"` — all steps in one `&&` chain for a single round-trip. The
 *    interceptor cannot see a `sudo` nested in a shell body, so a caller using
 *    this MUST pass a `run` that injects the passphrase itself (nginx does,
 *    via `injectSudoIntoShellScript`).
 */

import { randomUUID } from "node:crypto";

import { quoteArg, quoteCmd } from "../executor/quote.js";
import type { ExecResult, Executor } from "../executor/types.js";
import { createModuleLogger } from "../logger/index.js";

const log = createModuleLogger("privileged-write");

/**
 * A `chown` spec is either `user`, `user:group`, or numeric `uid:gid`. We only
 * ever build it from `stat`-resolved values (numeric ids from `%u:%g`), but
 * validate defensively so a hostile spec can never smuggle a `chown` flag
 * (`--reference=…`) even though `--` already ends option parsing.
 */
const OWNER_SPEC = /^[a-zA-Z0-9_.:-]+$/;

/** Raised when one of the privileged steps exits non-zero. */
export class PrivilegedWriteError extends Error {
  constructor(
    message: string,
    /** Raw stderr of the failing step, when there was any. */
    readonly stderr = "",
  ) {
    super(message);
    this.name = "PrivilegedWriteError";
  }
}

export interface PrivilegedWriteOptions {
  /** Octal mode applied to the destination. Default `"0644"`. */
  mode?: string;
  /**
   * Ownership applied to the destination AFTER the copy+chmod, as a `chown`
   * spec (`user`, `user:group`, or numeric `uid:gid`). Because this ladder
   * writes via `sudo cp`, the file would otherwise land `root:root` — for an
   * upload that means the target dir's real owner can no longer manage the file
   * (the `/home/dayz/@LuxiCore.zip` bug). Callers resolve the destination
   * directory's owner and pass it here. Best-effort: a failing `chown` is
   * logged, never fatal — the bytes are already on disk.
   */
  owner?: string;
  /** `cp -a <path> <backup>` BEFORE overwriting. */
  backup?: string;
  /** `mkdir -p $(dirname <path>)` before the copy (idempotent). */
  mkdirParent?: boolean;
  /** Staging-file prefix under /tmp, for log/debug legibility. */
  tmpPrefix?: string;
  /** Execution shape — see the module docstring. Default `"separate"`. */
  shape?: "separate" | "combined";
  /** Command runner. Defaults to `executor.exec`. */
  run?: (command: string) => Promise<ExecResult>;
  /**
   * `sudo` flavour. `"sudo"` (default) lets the executor boundary inject `-S`
   * plus the stored passphrase; `"sudo -n"` is strictly non-interactive.
   */
  sudo?: "sudo" | "sudo -n";
  /** Error message when the copy fails (before the stderr fallback). */
  copyErrorMessage?: string;
  /** Error message when the chmod fails. */
  chmodErrorMessage?: string;
}

function fail(res: ExecResult, fallback: string): never {
  const stderr = (res.stderr ?? "").trim();
  throw new PrivilegedWriteError(stderr || fallback, stderr);
}

/**
 * Write `content` to a possibly root-owned `path`.
 *
 * @throws {PrivilegedWriteError} when the copy or the chmod fails. The staging
 * temp file is removed either way.
 */
export async function writePrivilegedFile(
  executor: Executor,
  path: string,
  content: string | Buffer,
  opts: PrivilegedWriteOptions = {},
): Promise<void> {
  const run = opts.run ?? ((command: string) => executor.exec(command));
  const sudoWord = opts.sudo ?? "sudo";
  const sudoArgv = sudoWord === "sudo -n" ? ["-n"] : [];
  const mode = opts.mode ?? "0644";
  const owner = opts.owner && OWNER_SPEC.test(opts.owner) ? opts.owner : undefined;
  if (opts.owner && !owner) {
    log.warn({ path, owner: opts.owner }, "Ignoring invalid chown spec on privileged write");
  }
  const tmp = `/tmp/.${opts.tmpPrefix ?? "lxp"}-${randomUUID()}`;

  // Binary payloads (e.g. an uploaded file) must be staged raw — forcing
  // utf-8 would mangle them. Text keeps the historical utf-8 staging.
  await executor.writeFile(
    tmp,
    content,
    Buffer.isBuffer(content) ? { mode: 0o600 } : { encoding: "utf-8", mode: 0o600 },
  );
  try {
    if (opts.shape === "combined") {
      const q = quoteArg(path);
      // ONE shell round-trip. `--` ends option parsing on every binary so a
      // path starting with `-` is never read as a flag.
      const body = [
        opts.backup ? `${sudoWord} cp -a -- ${q} ${quoteArg(opts.backup)}` : null,
        opts.mkdirParent ? `${sudoWord} mkdir -p -- $(dirname -- ${q})` : null,
        `${sudoWord} cp -- ${quoteArg(tmp)} ${q}`,
        `${sudoWord} chmod ${mode} ${q}`,
        // Ownership is best-effort even in the single round-trip: `|| true` so a
        // failing chown never aborts an otherwise-successful write.
        owner ? `${sudoWord} chown -- ${quoteArg(owner)} ${q} || true` : null,
      ]
        .filter(Boolean)
        .join(" && ");
      const res = await run(body);
      if (res.exitCode !== 0) fail(res, opts.copyErrorMessage ?? `No se pudo escribir ${path}`);
      return;
    }

    if (opts.backup) {
      const bk = await run(quoteCmd("sudo", [...sudoArgv, "cp", "-a", "--", path, opts.backup]));
      if (bk.exitCode !== 0) fail(bk, `No se pudo respaldar ${path}`);
    }
    if (opts.mkdirParent) {
      const dir = path.replace(/\/[^/]*$/, "") || "/";
      const mk = await run(quoteCmd("sudo", [...sudoArgv, "mkdir", "-p", "--", dir]));
      if (mk.exitCode !== 0) fail(mk, `No se pudo crear ${dir}`);
    }
    const cp = await run(quoteCmd("sudo", [...sudoArgv, "cp", tmp, path]));
    if (cp.exitCode !== 0) fail(cp, opts.copyErrorMessage ?? `No se pudo escribir ${path}`);
    const chmod = await run(quoteCmd("sudo", [...sudoArgv, "chmod", mode, path]));
    if (chmod.exitCode !== 0) {
      fail(chmod, opts.chmodErrorMessage ?? `No se pudieron ajustar permisos de ${path}`);
    }
    if (owner) {
      // Best-effort: the bytes are already in place, so a failing chown must
      // NOT turn a successful write into an error. Log and move on.
      const ch = await run(quoteCmd("sudo", [...sudoArgv, "chown", "--", owner, path]));
      if (ch.exitCode !== 0) {
        log.warn({ path, owner, stderr: (ch.stderr ?? "").trim() }, "Privileged write chown failed (file left as-is)");
      }
    }
  } finally {
    await executor.exec(quoteCmd("rm", ["-f", tmp])).catch(() => undefined);
  }
}
