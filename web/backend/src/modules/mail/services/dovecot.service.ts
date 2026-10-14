// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Dovecot service — manages Dovecot user database and maildirs.
 *
 * Migrated from the original backend/src/dovecot.ts.
 */

import path from "node:path";
import { mailConfig } from "../../../config/mail.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteArg, quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { FILE_MODES } from "../../../shared/system/file-modes.js";
import { stageSecretFile, removeStagedFile, execChecked, writeRootOwnedFile } from "./staging.helpers.js";

const log = createModuleLogger("dovecot");

/**
 * Write a file that lives in a root-owned directory (e.g. `/etc/dovecot`).
 * Tries a direct SFTP write first (works when the panel user owns the file)
 * and, on failure, stages the content in a writable tmp path and `sudo cp`s
 * it into place — the executor injects the sudo passphrase, like the
 * surrounding `sudo chown` already does. Throws only if the sudo copy fails,
 * so the caller gets an actionable error instead of a raw SFTP denial.
 */
async function writeDovecotFile(
  executor: Executor,
  dest: string,
  content: string,
  mode: number = FILE_MODES.OWNER_READABLE,
  modeStr: string = FILE_MODES.OWNER_READABLE_STR,
): Promise<void> {
  // `mode` is applied atomically on the SFTP fast path too: if the panel SSH
  // user can write `dest` directly, the file (`/etc/dovecot/users` holds
  // `{SHA512-CRYPT}` secrets) must land 0640 — NOT the SFTP umask default
  // (world-readable). The staged fallback is 0600 for the same reason.
  await writeRootOwnedFile(executor, "dovecot", dest, content, mode, modeStr);
}

/**
 * Render the exact `/etc/dovecot/users` file content for a set of entries.
 * Single source of truth for the line format — used by the legacy
 * regenerate paths AND the write-behind steps builder so they never diverge.
 */
export function renderDovecotUsersContent(
  entries: Array<{ address: string; passwordHash: string; quotaMb: number }>,
): string {
  const lines = entries.map((e) => {
    const [local, domain] = e.address.split("@");
    return `${e.address}:${e.passwordHash}:${mailConfig.vmail.uid}:${mailConfig.vmail.gid}::${mailConfig.vmail.base}/${domain}/${local}::userdb_quota_rule=*:storage=${e.quotaMb}M`;
  });
  return lines.join("\n") + "\n";
}

export const dovecotService = {
  /** Generate Dovecot {SHA512-CRYPT} password hash on the connected server. */
  async hashPasswordWithExecutor(plain: string, executor: Executor): Promise<string> {
    // Never pass the plaintext via argv (`-p <pass>` is visible in `ps` /
    // `/proc/<pid>/cmdline` / auditd on the target). `doveadm pw` reads the
    // password from stdin when `-p` is omitted, prompting twice ("New
    // password:" / "Retype:"). `executor.exec` has no stdin channel, so we
    // stage the secret in a 0600 tmp file via SFTP and redirect it into the
    // command inside `sh -c` (mirrors system-accounts.service's chpasswd
    // pattern). The hash is still parsed from stdout, unchanged.
    // doveadm prompts for the password AND a verification — feed it twice.
    // Staged 0600-atomic (owner-only for its short lifetime).
    const tmp = await stageSecretFile(executor, "dovecot", `${plain}\n${plain}\n`);
    try {
      const inner = `${quoteCmd("doveadm", ["pw", "-s", "SHA512-CRYPT"])} < ${quoteArg(tmp)}`;
      const out = await executor.exec(quoteCmd("sh", ["-c", inner]));
      return out.stdout.trim();
    } finally {
      await removeStagedFile(executor, tmp);
    }
  },

  /** Ensure maildir exists for a given address (on the connected server). */
  async ensureMaildirWithExecutor(address: string, executor: Executor): Promise<void> {
    const [local, domain] = address.split("@");
    if (!local || !domain) throw new Error(`Invalid address: ${address}`);
    const maildirPath = path.join(mailConfig.vmail.base, domain, local);
    // vmail tree is root/vmail-owned → SFTP mkdir is denied; use sudo mkdir
    // (passphrase auto-injected) so it works on non-root targets.
    await execChecked(executor, quoteCmd("sudo", ["mkdir", "-p", path.join(maildirPath, "Maildir")]), "mkdir maildir");
    await execChecked(executor, quoteCmd("sudo", ["chown", "-R", `${mailConfig.vmail.uid}:${mailConfig.vmail.gid}`, maildirPath]), "chown maildir");
    log.info({ address, path: maildirPath, target: executor.target.id }, "Created maildir via executor");
  },

  /** Regenerate /etc/dovecot/users file from account data (via executor). */
  async regenerateUsersFileWithExecutor(entries: Array<{ address: string; passwordHash: string; quotaMb: number }>, executor: Executor): Promise<void> {
    const content = renderDovecotUsersContent(entries);
    await writeDovecotFile(executor, mailConfig.dovecot.usersFile, content, FILE_MODES.OWNER_READABLE, FILE_MODES.OWNER_READABLE_STR);
    await execChecked(executor, quoteCmd("sudo", ["chown", "root:" + mailConfig.dovecot.group, mailConfig.dovecot.usersFile]), "chown dovecot users");
    log.info({ count: entries.length, target: executor.target.id }, "Regenerated Dovecot users file via executor");
  },

  /** Reload Dovecot service (on the connected server, via executor). */
  async reloadWithExecutor(executor: Executor): Promise<void> {
    await execChecked(executor, quoteCmd("sudo", ["systemctl", "reload", "dovecot"]), "systemctl reload dovecot");
    log.info({ target: executor.target.id }, "Dovecot reloaded via executor");
  },
};
