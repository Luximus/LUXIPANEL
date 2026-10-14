// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Non-interactive sudo for CLI-bridge runs: per-job askpass helper + `sudo`
 * shim dropped on the target so the CLI's own `sudo …` children work without
 * a TTY. Split out of `cli-bridge.provider.ts` (behaviour unchanged).
 */

import { createModuleLogger } from "../../../../../shared/logger/index.js";
import { resolveSudoPassword } from "../../../../../shared/system/sudo-runtime.js";
import type { Executor } from "../../../../../shared/executor/index.js";
import { cliSecretsDir } from "./cli-tmp-paths.js";

const log = createModuleLogger("provider-cli-bridge");

/**
 * Make `sudo` work NON-interactively for the CLI's own child commands.
 *
 * The CLI (claude/codex/gemini) shells out to `sudo …` itself — that bypasses
 * the panel's executor-level sudo interception. So we drop a per-job `sudo`
 * shim earliest in PATH that re-invokes the real sudo with `-A` (askpass), and
 * an askpass helper that prints the resolved password (the stored sudo
 * credential, else this operator's live SSH passphrase = sudo password under
 * LP's one-passphrase model). The secret is written via SFTP (never argv) to a
 * 0600 file and the whole dir is removed when the CLI exits.
 *
 * Returns null when no credential is available → the CLI's `sudo` keeps its
 * default behaviour (only NOPASSWD rules work), same as before.
 */
/**
 * Whether a sudo credential is resolvable for this target — the SAME detection
 * `setupSudoAskpass` uses, so the system prompt's sudo promise never diverges
 * from what the run can actually do. Cheap: `resolveSudoPassword` is memoized
 * per target.
 */
export async function hasSudoCredential(executor: Executor): Promise<boolean> {
  try {
    return Boolean((await resolveSudoPassword(executor)) ?? (await executor.getSudoPasswordHint?.()));
  } catch {
    return false;
  }
}

export async function setupSudoAskpass(
  executor: Executor,
  jobId: string,
): Promise<{ envPrefix: string; cleanup: string } | null> {
  let password: string | null = null;
  try {
    password = (await resolveSudoPassword(executor)) ?? (await executor.getSudoPasswordHint?.()) ?? null;
  } catch { /* best-effort */ }
  if (!password) return null;

  const dir = cliSecretsDir(jobId);
  const passFile = `${dir}/p`;
  const askpass = `${dir}/askpass.sh`;
  const shim = `${dir}/sudo`;
  try {
    await executor.exec(`mkdir -p ${dir} && chmod 700 ${dir}`, { timeoutMs: 5_000 });
    await executor.writeFile(passFile, Buffer.from(password, "utf8"));
    await executor.writeFile(askpass, Buffer.from(`#!/bin/sh\ncat ${passFile}\n`, "utf8"));
    // The shim forces askpass and points at the REAL sudo (absolute path so it
    // doesn't recurse into itself via PATH).
    await executor.writeFile(
      shim,
      Buffer.from(`#!/bin/sh\nexport SUDO_ASKPASS=${askpass}\nexec /usr/bin/sudo -A "$@"\n`, "utf8"),
    );
    await executor.exec(`chmod 600 ${passFile}; chmod 700 ${askpass} ${shim}`, { timeoutMs: 5_000 });
  } catch (err) {
    log.warn({ jobId, err: (err as Error).message }, "sudo askpass setup failed — falling back to sudo -n");
    void executor.exec(`rm -rf ${dir}`, { timeoutMs: 5_000 }).catch(() => undefined);
    return null;
  }
  return {
    envPrefix: `export PATH=${dir}:$PATH; export SUDO_ASKPASS=${askpass};`,
    cleanup: `rm -rf ${dir}`,
  };
}
