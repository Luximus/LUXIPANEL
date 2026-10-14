// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared sudo-aware shell/read/write helpers for the NGINX module services.
 *
 * `sudo` lives inside `sh -lc '<body>'`, hidden from the executor-boundary
 * interceptor, so the credential is injected into the body up-front via
 * `injectSudoIntoShellScript` (stored sidecar → live login passphrase).
 * Writes never pipe content into sudo's stdin (that collides with `sudo -S`);
 * they stage the file over SFTP and `sudo cp` it into place.
 */

import { randomUUID } from "node:crypto";
import type { Executor } from "../../../shared/executor/index.js";
import { quoteArg } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { injectSudoIntoShellScript } from "../../../shared/system/sudo-runtime.js";
import { readPrivilegedFileOrNull } from "../../../shared/system/privileged-file-io.js";

export async function sh(executor: Executor, command: string) {
  const body = await injectSudoIntoShellScript(executor, command);
  return executor.exec(`sh -lc ${quoteArg(body)}`);
}

/**
 * Read a (possibly root-only) file: plain read, then sudo fallback.
 *
 * Thin adapter over the canonical `shared/system#readPrivilegedFile`; the only
 * NGINX-specific bit is the runner, which has to go through {@link sh} so the
 * sudo passphrase is injected INSIDE the `sh -lc` body (the executor boundary
 * cannot see a `sudo` nested in a shell script).
 */
export async function readMaybeSudo(executor: Executor, path: string): Promise<string | null> {
  return readPrivilegedFileOrNull(executor, path, { run: (command) => sh(executor, command) });
}

/**
 * Write a (root-owned) file by staging it over SFTP as the panel user, then
 * `sudo cp`-ing it into place. The staged temp file carries the content, so
 * sudo's stdin stays free for the `sudo -S` password — avoiding the
 * pipe-into-sudo collision (`printf … | base64 -d | sudo -S tee` ate the
 * content as the password). `sudo` here is injected by {@link sh}.
 *
 * Options:
 *   • `mkdirParent` — ensure the destination's parent directory exists
 *     (idempotent). Saves one `mkdir -p` round-trip when the caller would
 *     otherwise run it before the write.
 *   • `backup` — atomically `cp -a <path> <backup>` BEFORE overwriting.
 *     Replaces the separate backup shell call from `writeSite` with a single
 *     `sh -lc` sequence: backup + cp + chmod all in one SSH round-trip.
 *   • `mode` — chmod the destination after the copy (default `0644`).
 */
export interface WriteSudoOptions {
  mkdirParent?: boolean;
  backup?: string;
  mode?: string;
}

export async function writeSudo(
  executor: Executor,
  path: string,
  content: string,
  opts: WriteSudoOptions = {},
): Promise<void> {
  // randomUUID (CSPRNG) + 0600: a predictable `Date.now()+Math.random()` name
  // let a local user pre-plant a symlink at the staging path before our copy,
  // capturing the (potentially secret) content (audit §5). writeFile opens with
  // O_TRUNC and follows symlinks, so the name MUST be unguessable and the mode
  // owner-only from the start.
  const tmp = `/tmp/.lxp-nginx-${randomUUID()}`;
  await executor.writeFile(tmp, content, { mode: 0o600 });
  try {
    const q = quoteArg(path);
    const t = quoteArg(tmp);
    const parent = `$(dirname -- ${q})`;
    const mode = opts.mode ?? "0644";
    // One shell round-trip: (optional backup) + (optional mkdir -p) + cp + chmod.
    // `sudo` is injected by `sh`. `--` ends option parsing on every binary
    // so a path starting with `-` can't be misread as a flag.
    const body = [
      opts.backup ? `sudo -n cp -a -- ${q} ${quoteArg(opts.backup)}` : null,
      opts.mkdirParent ? `sudo -n mkdir -p -- ${parent}` : null,
      `sudo -n cp -- ${t} ${q}`,
      `sudo -n chmod ${mode} ${q}`,
    ]
      .filter(Boolean)
      .join(" && ");
    const res = await sh(executor, body);
    if (res.exitCode !== 0) {
      throw new ValidationError(`No se pudo escribir ${path}: ${res.stderr || res.stdout || "error"}`);
    }
  } finally {
    await executor.unlink(tmp).catch(() => undefined);
  }
}

// ── Validate / reload (B-16) ────────────────────────────────────────────────
// `nginx -t` and the reload lived in three services with subtly different
// bodies (one only looked at `exitCode`, two reloaded without the
// `nginx -s reload` fallback). They belong down here, next to `sh`, so the
// write-with-validation cycle below can use them without importing a sibling
// service (which would create an import cycle).

/** Validate the running config; returns the combined `nginx -t` output. */
export async function testNginxConfig(executor: Executor): Promise<{ ok: boolean; output: string }> {
  const res = await sh(executor, `sudo -n nginx -t 2>&1 || nginx -t 2>&1`);
  return { ok: res.exitCode === 0, output: (res.stdout || res.stderr || "").trim() };
}

/** Reload nginx (systemctl, falling back to `nginx -s reload`). Never throws. */
export async function reloadNginx(executor: Executor): Promise<{ ok: boolean; output: string }> {
  const res = await sh(executor, `sudo -n systemctl reload nginx 2>&1 || sudo -n nginx -s reload 2>&1`);
  return { ok: res.exitCode === 0, output: (res.stdout || res.stderr || "").trim() };
}

// ── backup → write → `nginx -t` → rollback → reload (B-03) ──────────────────

/** One file managed by {@link writeWithNginxValidation}. */
export interface NginxManagedFile {
  path: string;
  content: string;
  /** chmod applied to the destination after the copy (default `0644`). */
  mode?: string;
}

export interface WriteWithNginxValidationOptions {
  /** Reload nginx after a successful `nginx -t`. Default `true`. */
  reload?: boolean;
  /** Message of the `ValidationError` thrown when `nginx -t` fails. */
  invalidMessage?: (testOutput: string) => string;
  /** Message when `nginx -t` fails AND the rollback also failed. */
  restoreFailedMessage?: (testOutput: string, restoreOutput: string) => string;
}

/**
 * The critical NGINX safety contract, in ONE place:
 *
 *   backup (unique name) → write → `nginx -t` → rollback on failure → reload
 *
 * It was copy-pasted in `nginx-sites#writeSite`, `nginx-system#
 * writeGlobalConfig` and `nginx-tuning#apply`; the third still used a FIXED
 * `.lxp.bak` suffix, so two concurrent writes clobbered each other's backup and
 * a rollback could restore the WRONG config. The backup name here is always
 * unique per operation, and the rollback is VERIFIED (a silent restore failure
 * used to leave a broken config in place while telling the user it had been
 * restored).
 *
 * Files that did not exist before are REMOVED on rollback instead of restored.
 */
export async function writeWithNginxValidation(
  executor: Executor,
  files: NginxManagedFile[],
  opts: WriteWithNginxValidationOptions = {},
): Promise<void> {
  const planned = await Promise.all(
    files.map(async (file) => ({
      ...file,
      existed: (await readMaybeSudo(executor, file.path)) !== null,
      // UNIQUE per operation (audit §5) — never a fixed `.lxp.bak`.
      backup: `${file.path}.lxp.bak-${Date.now()}-${randomUUID()}`,
    })),
  );

  const cleanupBackups = async () => {
    for (const file of planned) {
      if (!file.existed) continue;
      await sh(executor, `sudo -n rm -f -- ${quoteArg(file.backup)}`).catch(() => undefined);
    }
  };

  // The backup is folded into `writeSudo`'s single `sh -lc` chain, so an
  // existing file is never overwritten without a usable copy on disk.
  for (const file of planned) {
    await writeSudo(executor, file.path, file.content, {
      mkdirParent: true,
      backup: file.existed ? file.backup : undefined,
      mode: file.mode,
    });
  }

  const test = await testNginxConfig(executor);
  if (test.ok) {
    if (opts.reload !== false) {
      const reload = await reloadNginx(executor);
      if (!reload.ok) {
        // The saved config is valid but has not been activated. Retain backups
        // for an operator and never report this as a successful apply.
        throw new ValidationError(`Configuración guardada y validada, pero NGINX no se recargó: ${reload.output}`);
      }
    }
    await cleanupBackups();
    return;
  }

  const restoreFailures: string[] = [];
  for (const file of planned) {
    if (file.existed) {
      const restore = await sh(executor, `sudo -n cp -a -- ${quoteArg(file.backup)} ${quoteArg(file.path)}`);
      if (restore.exitCode !== 0) {
        restoreFailures.push((restore.stderr || restore.stdout || "").trim() || `exit ${restore.exitCode}`);
      }
    } else {
      await sh(executor, `sudo -n rm -f -- ${quoteArg(file.path)}`).catch(() => undefined);
    }
  }
  await cleanupBackups();

  if (restoreFailures.length > 0) {
    const restoreOutput = restoreFailures.join("\n");
    throw new ValidationError(
      opts.restoreFailedMessage?.(test.output, restoreOutput) ??
        `Configuración nginx inválida y ADEMÁS falló la restauración del backup — revisa el servidor:\n${test.output}\n${restoreOutput}`,
    );
  }
  throw new ValidationError(
    opts.invalidMessage?.(test.output) ??
      `Configuración nginx inválida, no se aplicaron cambios:\n${test.output}`,
  );
}
