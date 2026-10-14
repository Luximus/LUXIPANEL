// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Privileged filesystem MUTATIONS on the connected server — the delete/move
 * twins of `privileged-file-write.ts` (which owns the write path).
 *
 * The panel's SSH/local user can't touch a root-owned path (or a dir owned by
 * another Linux user), so a plain `executor.unlink`/`rename`/`rm` there fails
 * with EACCES/EPERM. Every mutation here tries the UNPRIVILEGED path first (no
 * sudo round-trip for the common owner/dir-writable case) and, only on a
 * permission failure, retries through the sudo ladder (`sudo rm`/`sudo mv`,
 * always argv — never a shell body — so the executor's sudo boundary injects
 * the stored passphrase). This is what lets the file manager manage files that
 * ended up root-owned (e.g. by the historical `sudo cp` upload ladder).
 *
 * All commands go through the request Executor (local or bridged) — never the
 * panel host directly (per-server isolation invariant).
 */

import { quoteCmd } from "../executor/quote.js";
import type { ExecResult, Executor } from "../executor/types.js";
import { PrivilegedWriteError } from "./privileged-file-write.js";
import { assertCanEscalate, auditPrivilegedFileOp } from "./privilege-escalation.js";

/** True when a thrown FS/SFTP error was a lack-of-privilege rejection. */
export function isPermissionDenied(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (e?.code === "EACCES" || e?.code === "EPERM") return true;
  return typeof e?.message === "string" && /permission denied|EACCES|EPERM/i.test(e.message);
}

/** True when a non-zero `ExecResult` stderr indicates a privilege failure. */
export function stderrIndicatesPermissionDenied(stderr: string): boolean {
  return /permission denied|operation not permitted|not permitted|EACCES|EPERM/i.test(stderr || "");
}

function failResult(res: ExecResult, fallback: string): never {
  const stderr = (res.stderr ?? "").trim();
  throw new PrivilegedWriteError(stderr || fallback, stderr);
}

/**
 * Resolve the `uid:gid` of `path` on the target via a single `stat`. Numeric
 * ids (`%u:%g`) so `chown` always applies even when there's no passwd/group
 * entry. Returns `undefined` on any failure (fail-open — the caller then skips
 * the ownership fixup rather than breaking the operation).
 */
export async function resolvePathOwner(executor: Executor, path: string): Promise<string | undefined> {
  try {
    const res = await executor.exec(quoteCmd("stat", ["-c", "%u:%g", "--", path]));
    const spec = res.stdout.trim();
    if (res.exitCode === 0 && /^[0-9]+:[0-9]+$/.test(spec)) return spec;
  } catch {
    // fail-open: unknown owner
  }
  return undefined;
}

/**
 * Remove `target` (a file, or a tree when `recursive`), escalating to
 * `sudo rm` only when the unprivileged `rm` is denied. `rm -f`/`rm -rf`
 * already ignore a missing path, so this is idempotent.
 */
export async function privilegedRemove(executor: Executor, target: string, recursive: boolean): Promise<void> {
  const flag = recursive ? "-rf" : "-f";
  const res = await executor.exec(quoteCmd("rm", [flag, "--", target]));
  if (res.exitCode === 0) return;
  if (!stderrIndicatesPermissionDenied(res.stderr)) failResult(res, `No se pudo eliminar ${target}`);
  // Escalation gate: only sudo/wheel members of the connected server may reach
  // for root — everyone else gets the typed 403 (no sudo attempt).
  await assertCanEscalate(executor, "delete", [target]);
  const sudoRes = await executor.exec(quoteCmd("sudo", ["rm", flag, "--", target]));
  auditPrivilegedFileOp("delete", [target], sudoRes.exitCode === 0);
  if (sudoRes.exitCode !== 0) failResult(sudoRes, `No se pudo eliminar ${target}`);
}

/**
 * Rename/move `from` → `to`, escalating to `sudo mv` when the unprivileged
 * rename is denied. `sudo mv` (vs a raw rename) also transparently handles a
 * cross-filesystem move (EXDEV → copy+delete).
 */
export async function privilegedRename(executor: Executor, from: string, to: string): Promise<void> {
  try {
    await executor.rename(from, to);
    return;
  } catch (err) {
    if (!isPermissionDenied(err)) throw err;
  }
  await assertCanEscalate(executor, "rename", [from, to]);
  const res = await executor.exec(quoteCmd("sudo", ["mv", "--", from, to]));
  auditPrivilegedFileOp("rename", [from, to], res.exitCode === 0);
  if (res.exitCode !== 0) failResult(res, `No se pudo mover ${from}`);
}

/**
 * `chmod <mode> <target>`, escalating to `sudo chmod` on a permission failure
 * so a root-owned entry's mode can still be changed from the panel. `mode` is
 * an octal string (e.g. `"755"`).
 */
export async function privilegedChmod(executor: Executor, target: string, mode: string): Promise<void> {
  const res = await executor.exec(quoteCmd("chmod", [mode, "--", target]));
  if (res.exitCode === 0) return;
  if (!stderrIndicatesPermissionDenied(res.stderr)) failResult(res, `No se pudieron ajustar permisos de ${target}`);
  await assertCanEscalate(executor, "chmod", [target]);
  const sudoRes = await executor.exec(quoteCmd("sudo", ["chmod", mode, "--", target]));
  auditPrivilegedFileOp("chmod", [target], sudoRes.exitCode === 0);
  if (sudoRes.exitCode !== 0) failResult(sudoRes, `No se pudieron ajustar permisos de ${target}`);
}
