// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Login ACL mirror.
 *
 * Managed mode resolves a user's panel permissions from the per-server role
 * records under `${LUXIPANEL_CONFIG_DIR}` (default `/etc/luxipanel`). Those
 * sidecars are written by privileged operations and are NOT readable by an
 * unprivileged login user (e.g. a non-sudo account): their kv reads fall back
 * to `sudo -n cat`, which fails, so the panel sees an EMPTY world and the user
 * ends up dashboard-only.
 *
 * To let non-privileged login users resolve their group permissions WITHOUT
 * granting them sudo or read access to the secret sidecars, a privileged
 * executor (an admin/SSO session, or any login that can write the config)
 * mirrors the NON-SECRET group→permission map into a world-readable file
 * (`login-acl.json`, mode 0644) and makes the config dir traversable (0711,
 * not listable — the 0600 secret sidecars stay unreadable). The unprivileged
 * login then reads this mirror to build its token. The mirror contains only
 * group names, module lists and permission matrices — no secrets, no password
 * hashes.
 */

import path from "node:path";
import crypto from "node:crypto";
import { CONFIG_DIR } from "@config/paths.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteCmd } from "../../../shared/executor/index.js";
import type { Executor } from "../../../shared/executor/types.js";
import { roleRepository } from "../../users/repositories/role.repository.js";

const log = createModuleLogger("login-acl");

function baseDir(): string {
  return CONFIG_DIR;
}
function mirrorPath(): string {
  return path.posix.join(baseDir(), "login-acl.json");
}

export interface LoginAclGroup {
  modules: string[];
  permissions: Record<string, unknown>;
}
export interface LoginAcl {
  v: 1;
  groups: Record<string, LoginAclGroup>;
}

export const loginAclService = {
  /**
   * Rebuild the world-readable mirror from the per-server role records. MUST be
   * called with a PRIVILEGED executor (one that can read the role sidecars and
   * write/chmod under the config dir) — i.e. an admin/SSO login. Best-effort:
   * a non-privileged executor simply can't write/chmod and we swallow the error
   * (its reads of the role records would be empty anyway).
   */
  async refresh(executor: Executor | null | undefined): Promise<void> {
    if (!executor) return;
    try {
      const roles = await roleRepository.findAll(executor);
      const groups: Record<string, LoginAclGroup> = {};
      for (const r of roles) {
        groups[r.name] = {
          modules: Array.isArray(r.modules) ? (r.modules as unknown as string[]) : [],
          permissions: (r.permissions ?? {}) as Record<string, unknown>,
        };
      }
      const payload: LoginAcl = { v: 1, groups };
      const file = mirrorPath();
      const content = JSON.stringify(payload);

      // Write the mirror. Direct SFTP works when the config dir is owned by the
      // (privileged) login user; fall back to `sudo -n cp` from a tmp file when
      // the dir is root-owned (the admin is a NOPASSWD sudoer in that model).
      try {
        await executor.writeFile(file, content, { encoding: "utf-8" });
      } catch {
        // Random, unpredictable tmp name → no attacker can pre-create/symlink
        // the path we're about to write through sudo (Date.now() was guessable).
        const tmp = path.posix.join("/tmp", `.lxp-acl-${crypto.randomBytes(12).toString("hex")}.json`);
        await executor.writeFile(tmp, content, { encoding: "utf-8" });
        await executor.exec(quoteCmd("sudo", ["-n", "cp", tmp, file]));
        await executor.exec(quoteCmd("sudo", ["-n", "rm", "-f", tmp])).catch(() => undefined);
      }

      // Make the file world-readable and the config dir traversable (0711:
      // others can reach a known path but NOT list it). Owner-only secret
      // sidecars keep their 0600 and stay unreadable. Try direct then sudo.
      const chmod = async (mode: string, target: string): Promise<void> => {
        try {
          const r = await executor.exec(quoteCmd("chmod", [mode, target]));
          if (r.exitCode === 0) return;
        } catch { /* try sudo */ }
        await executor.exec(quoteCmd("sudo", ["-n", "chmod", mode, target])).catch(() => undefined);
      };
      await chmod("0644", file);
      await chmod("0711", baseDir());
      log.info({ groups: Object.keys(groups).length }, "Login ACL mirror refreshed");
    } catch (err) {
      // Non-privileged executor (can't write/chmod) or transient failure — the
      // mirror just stays as last written by a privileged session.
      log.debug({ err: (err as Error)?.message }, "Login ACL mirror refresh skipped");
    }
  },

  /** Read the mirror with the current (possibly unprivileged) executor. Returns
   *  null when it doesn't exist or can't be parsed. */
  async read(executor: Executor | null | undefined): Promise<LoginAcl | null> {
    if (!executor) return null;
    try {
      const raw = await executor.readFile(mirrorPath(), "utf-8");
      const text = typeof raw === "string" ? raw : raw.toString("utf-8");
      const parsed = JSON.parse(text) as LoginAcl;
      if (parsed && typeof parsed === "object" && parsed.groups) return parsed;
      return null;
    } catch {
      return null;
    }
  },
};
