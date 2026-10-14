// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Local PAM login validator (standalone-local mode).
 *
 * In `standalone-local` mode the panel manages the very server it runs on and
 * there is no SSH bridge or LP-LICENSE-SERVER. Users authenticate with their
 * REAL Linux account: this validator checks a username + password against PAM
 * by running `su <user> -c 'exit 0'` inside a pseudo-terminal and feeding the
 * password to su's prompt — exactly how an interactive login validates.
 *
 * SECURITY — the root exemption:
 *   `su` lets root switch to any user WITHOUT a password. The panel typically
 *   runs as root (so it can administer the box), so calling `su` directly would
 *   authenticate ANY password. To force PAM to actually verify, we drop the
 *   spawned `su` to an unprivileged uid/gid (the `nobody` account) whenever the
 *   process is privileged. `su` is setuid-root, so it still performs the PAM
 *   check correctly — it just no longer gets the root bypass. When the panel is
 *   already unprivileged we spawn as-is (su will prompt unless the panel user
 *   *is* the target user, in which case they are already that account).
 *
 * node-pty is imported lazily so the test runner (vitest, threads pool) never
 * loads the native addon at import time.
 */

import { readFileSync } from "node:fs";

import { env } from "../../../config/env.js";
import { AuthError } from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("local-auth");

/** Only well-formed Linux usernames may reach the command (defense-in-depth;
 *  argv is passed without a shell so this is belt-and-suspenders). */
const USERNAME_RE = /^[a-z_][a-z0-9_-]*\$?$/;

/** Memoized uid/gid of the drop account. The mapping is stable for the process
 *  lifetime, so we avoid a `readFileSync("/etc/passwd")` on every login. */
let cachedDropIds: { uid: number; gid: number } | null = null;

/** Resolve the uid/gid of an unprivileged account to drop `su` to. Reads
 *  /etc/passwd (world-readable) for the account named `LOCAL_AUTH_DROP_USER`
 *  (default `nobody`); falls back to the conventional 65534:65534. Memoized. */
function resolveDropIds(): { uid: number; gid: number } {
  if (cachedDropIds) return cachedDropIds;
  const dropUser = env.LOCAL_AUTH_DROP_USER;
  try {
    const passwd = readFileSync("/etc/passwd", "utf-8");
    for (const line of passwd.split("\n")) {
      const cols = line.split(":");
      if (cols[0] === dropUser && cols[2] && cols[3]) {
        const uid = Number.parseInt(cols[2], 10);
        const gid = Number.parseInt(cols[3], 10);
        if (Number.isInteger(uid) && Number.isInteger(gid)) {
          cachedDropIds = { uid, gid };
          return cachedDropIds;
        }
      }
    }
  } catch {
    /* fall through to the conventional default */
  }
  cachedDropIds = { uid: 65534, gid: 65534 };
  return cachedDropIds;
}

/**
 * Validate that `password` is the local Linux password for `username`.
 * Resolves on success; throws `AuthError("Invalid passphrase")` on a wrong
 * password (so the caller's failure handling matches the SSH path), or a more
 * specific `AuthError` when validation could not run at all.
 */
export async function validateLocalPassword(username: string, password: string): Promise<void> {
  if (!USERNAME_RE.test(username)) {
    throw new AuthError("Invalid passphrase", "INVALID_PASSPHRASE");
  }
  if (!password) {
    throw new AuthError("Debes ingresar la contraseña del usuario.", "PASSPHRASE_REQUIRED");
  }

  let pty: typeof import("node-pty");
  try {
    pty = await import("node-pty");
  } catch (err) {
    log.error({ err: (err as Error).message }, "node-pty unavailable — cannot validate local login");
    throw new AuthError("La validación de contraseña no está disponible en este servidor.", "LOCAL_AUTH_UNAVAILABLE");
  }

  // Drop privileges so su can't use the root bypass (see file header).
  const isRoot = typeof process.getuid === "function" && process.getuid() === 0;
  const drop = isRoot ? resolveDropIds() : undefined;

  await new Promise<void>((resolve, reject) => {
    let child: import("node-pty").IPty;
    try {
      child = pty.spawn("su", [username, "-c", "exit 0"], {
        name: "xterm-color",
        cols: 80,
        rows: 30,
        cwd: "/",
        env: { PATH: process.env.PATH ?? "/usr/sbin:/usr/bin:/sbin:/bin", TERM: "xterm" },
        ...(drop ? { uid: drop.uid, gid: drop.gid } : {}),
      });
    } catch (err) {
      reject(new AuthError("No se pudo verificar la contraseña.", "PASSPHRASE_VERIFY_FAILED"));
      log.error({ err: (err as Error).message }, "su spawn failed");
      return;
    }

    let out = "";
    let sent = false;
    let settled = false;
    const send = () => {
      if (sent) return;
      sent = true;
      try { child.write(`${password}\r`); } catch { /* closed */ }
    };
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(fallback);
      try { child.kill(); } catch { /* already gone */ }
      fn();
    };

    child.onData((chunk) => {
      out += chunk;
      if (/password:/i.test(out)) send();
    });
    child.onExit(({ exitCode }) => finish(() => {
      if (exitCode === 0) return resolve();
      if (/authentication failure|incorrect password|su: authentication/i.test(out)) {
        return reject(new AuthError("Invalid passphrase", "INVALID_PASSPHRASE"));
      }
      // Unknown failure (su denied, PAM misconfig, no such user) — fail closed.
      log.warn({ out: out.slice(0, 200), exitCode, username }, "local su validation returned an unexpected error");
      reject(new AuthError("Invalid passphrase", "INVALID_PASSPHRASE"));
    }));

    // Some su builds don't emit a detectable prompt; send after a short delay.
    const fallback = setTimeout(send, 600);
    // Hard timeout so a wrong password (su re-prompts up to 3×) can't hang us.
    const timer = setTimeout(
      () => finish(() => reject(new AuthError("Invalid passphrase", "INVALID_PASSPHRASE"))),
      env.SSH_LOGIN_TIMEOUT_MS,
    );
  });
}
