// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Remote panel config sidecar — persistence layer for module state that
 * is owned by LUXIPANEL but lives on the connected server (no DB).
 * Each module writes its JSON under `/etc/luxipanel/<module>.json` via the
 * executor so the data is bound to the actual server, not the panel host.
 */

import path from "node:path";
import { quoteArg, quoteCmd, type Executor } from "../executor/index.js";
import { noServerExecutor, requireExecutor } from "../executor/require-executor.js";
import { safeSegment } from "../utils/safe-segment.js";
import { createModuleLogger } from "../logger/index.js";
import { isFileNotFoundError } from "../kv-store/index.js";
import { KvReadError } from "../errors/errors.js";
import { CONFIG_DIR } from "@config/paths.js";

const log = createModuleLogger("remote-config");

/**
 * Resolve the executor for a per-server config op. Managed-only: an explicit
 * executor wins, else the request-scoped one pinned by the auth middleware;
 * if neither exists we fail closed (never the panel host — that store is
 * shared across every bridged server).
 */
const REMOTE_CONFIG_NO_EXECUTOR = noServerExecutor(
  "remote-config: no executor in scope — a per-server executor is required " +
    "(managed-only: panel-host fallback is disabled to prevent cross-server data leakage)",
);

function resolveExecutor(executor?: Executor | null): Executor {
  return requireExecutor(executor, REMOTE_CONFIG_NO_EXECUTOR);
}
function baseDir(): string {
  return CONFIG_DIR;
}

function configPath(name: string): string {
  // Defense-in-depth: do not allow ".." or "/" in the file name. Uses the SAME
  // strict sanitizer as kv-store (`shared/utils/safe-segment.ts`) — this copy
  // used to omit the length cap AND the "."/".." rejection, so a module name of
  // ".." escaped LUXIPANEL_CONFIG_DIR.
  return path.posix.join(baseDir(), `${safeSegment(name)}.json`);
}

/**
 * Read the sidecar. Returns `null` ONLY when the file genuinely does not exist
 * (ENOENT); a TRANSIENT failure (SSH/SFTP hiccup, dropped session) THROWS
 * `KvReadError` so callers don't misread it as "absent". This matters for
 * `update()`: the old fail-open-to-null made a transient read return the
 * fallback, which `write()` then persisted OVER the existing file — silently
 * wiping the module's config (the exact bug `kv-store` already fixed).
 */
async function readRaw(executor: Executor, filePath: string): Promise<string | null> {
  let readErr: unknown;
  try {
    const data = await executor.readFile(filePath, "utf-8");
    return typeof data === "string" ? data : data.toString("utf-8");
  } catch (err) {
    readErr = err;
  }
  // Unambiguous ENOENT → genuinely absent (legitimate at boot).
  if (isFileNotFoundError(readErr)) return null;
  // Non-ENOENT: try sudo cat to recover the permission case (file EXISTS but the
  // panel user can't read it directly). exec resolves even on non-zero exit.
  try {
    const { stdout } = await executor.exec(quoteCmd("sudo", ["-n", "cat", filePath]));
    if (stdout) return stdout;
  } catch {
    /* sudo cat couldn't run — fall through to classify the original error */
  }
  // Nothing recovered and the original error was NOT ENOENT → transient. THROW
  // so a read→mutate→write cycle aborts with the on-disk config intact.
  throw new KvReadError(filePath, readErr);
}

async function writeRaw(executor: Executor, filePath: string, content: string): Promise<void> {
  const dir = path.posix.dirname(filePath);
  try {
    await executor.exec(quoteCmd("mkdir", ["-p", dir]));
  } catch {
    await executor.exec(quoteCmd("sudo", ["-n", "mkdir", "-p", dir]));
  }
  try {
    // Create 0600 from the start (these sidecars may hold secrets/policy) — no
    // umask-derived 0644 window before the chmod below.
    await executor.writeFile(filePath, content, { encoding: "utf-8", mode: 0o600 });
  } catch {
    await executor.exec(
      quoteCmd("sh", [
        "-lc",
        `(umask 077; printf '%s' ${quoteArg(content)} > ${quoteArg(filePath)})`,
      ]),
    );
  }
  try {
    await executor.exec(quoteCmd("chmod", ["600", filePath]));
  } catch {
    /* non-fatal */
  }
}

export const remoteConfig = {
  /** Read JSON state for a module. Returns the fallback if missing/corrupt. */
  async read<T>(executor: Executor | null | undefined, moduleName: string, fallback: T): Promise<T> {
    const exec = resolveExecutor(executor);
    const filePath = configPath(moduleName);
    const raw = await readRaw(exec, filePath);
    if (!raw || !raw.trim()) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      log.warn({ moduleName, err }, "Corrupt remote-config JSON, returning fallback");
      return fallback;
    }
  },

  /** Write JSON state for a module. */
  async write<T>(executor: Executor | null | undefined, moduleName: string, value: T): Promise<void> {
    const exec = resolveExecutor(executor);
    const filePath = configPath(moduleName);
    await writeRaw(exec, filePath, JSON.stringify(value, null, 2));
  },

  /** Read-mutate-write helper. */
  async update<T>(
    executor: Executor | null | undefined,
    moduleName: string,
    fallback: T,
    mutator: (current: T) => T,
  ): Promise<T> {
    const current = await this.read<T>(executor, moduleName, fallback);
    const next = mutator(current);
    await this.write<T>(executor, moduleName, next);
    return next;
  },
};
