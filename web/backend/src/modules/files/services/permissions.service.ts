// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Permissions service — check and modify Unix file permissions.
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { safePath } from "./filesystem.service.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { privilegedChmod } from "../../../shared/system/privileged-fs-ops.js";

const log = createModuleLogger("permissions");

// Strict charset for Unix usernames/group names. Blocks shell metacharacters
// and chown argument injection (e.g. "--reference=…").
const OWNER_GROUP_CHARSET = /^[a-zA-Z0-9_.-]+$/;
// Unix numeric UID/GID.
const OWNER_GROUP_NUMERIC = /^[0-9]+$/;

function assertSafeOwnerGroup(value: string, label: string): void {
  if (!value) throw new Error(`${label} required`);
  if (value.length > 64) throw new Error(`${label} too long`);
  if (!OWNER_GROUP_CHARSET.test(value) && !OWNER_GROUP_NUMERIC.test(value)) {
    throw new Error(`Invalid ${label}: only [A-Za-z0-9_.-] or numeric UID/GID allowed`);
  }
}

export interface UnixPermissions {
  path: string;
  owner: string;
  group: string;
  mode: string;        // octal string e.g. "0755"
  modeSymbolic: string; // e.g. "rwxr-xr-x"
}

export type PermissionLevel = "ok" | "warning" | "danger";

export interface PermissionAnalysis {
  /** Last 3 octal digits of the current mode, e.g. "777". */
  current: string;
  /** Recommended mode for this kind of path ("755" dir, "644" file). */
  recommended: string;
  level: PermissionLevel;
  reasons: string[];
}

/** Last three octal digits (perm bits) of a mode string like "0100644"/"644". */
function permBits(mode: string): string {
  return mode.replace(/[^0-7]/g, "").slice(-3).padStart(3, "0");
}

export const permissionsService = {
  /** Get owner, group, and mode for a path. */
  getPermissions(filePath: string): UnixPermissions {
    const safe = safePath(filePath);
    const stat = fs.statSync(safe);
    const mode = stat.mode.toString(8).slice(-4);

    // Get owner/group via stat command
    let owner = String(stat.uid);
    let group = String(stat.gid);
    try {
      const out = execFileSync("stat", ["-c", "%U %G", safe], {
        encoding: "utf-8",
        timeout: 3000,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      const parts = out.split(" ");
      if (parts[0]) owner = parts[0];
      if (parts[1]) group = parts[1];
    } catch { /* non-Linux */ }

    return {
      path: safe,
      owner,
      group,
      mode,
      modeSymbolic: this._toSymbolic(stat.mode),
    };
  },

  /** Get permissions through an executor when running against a bridged target. */
  async getPermissionsWithExecutor(filePath: string, executor: Executor): Promise<UnixPermissions> {
    const safe = safePath(filePath);
    const stat = await executor.stat(safe);

    let owner = "0";
    let group = "0";
    try {
      const out = await executor.exec(quoteCmd("stat", ["-c", "%U %G", safe]));
      const parts = out.stdout.trim().split(/\s+/);
      if (parts[0]) owner = parts[0];
      if (parts[1]) group = parts[1];
    } catch {
      // Permission metadata unavailable; fall back to uid/gid-like placeholders.
    }

    return {
      path: safe,
      owner,
      group,
      mode: stat.mode,
      modeSymbolic: this._toSymbolic(parseInt(stat.mode, 8)),
    };
  },

  /**
   * Change file mode (chmod).
   * @param mode Octal string or number, e.g. "755" or 0o755
   */
  chmod(filePath: string, mode: string | number): void {
    const safe = safePath(filePath);
    const modeNum = typeof mode === "string" ? parseInt(mode, 8) : mode;
    fs.chmodSync(safe, modeNum);
    log.info({ path: safe, mode: modeNum.toString(8) }, "chmod applied");
  },

  /**
   * Change file mode through an executor. Escalates to `sudo chmod` on a
   * permission failure (via {@link privilegedChmod}) so a root-owned entry's
   * mode can still be changed from the panel.
   */
  async chmodWithExecutor(filePath: string, mode: string | number, executor: Executor): Promise<void> {
    const safe = safePath(filePath);
    const modeNum = typeof mode === "string" ? parseInt(mode, 8) : mode;
    await privilegedChmod(executor, safe, modeNum.toString(8));
    log.info({ path: safe, mode: modeNum.toString(8), target: executor.target.id }, "chmod applied via executor");
  },

  /**
   * Change owner and/or group (chown). Requires sudo.
   * @param owner  Username or UID
   * @param group  Group name or GID (optional)
   */
  chown(filePath: string, owner: string, group?: string): void {
    const safe = safePath(filePath);
    assertSafeOwnerGroup(owner, "owner");
    if (group) assertSafeOwnerGroup(group, "group");
    const spec = group ? `${owner}:${group}` : owner;
    execFileSync("sudo", ["chown", "--", spec, safe], { timeout: 10000, stdio: "pipe" });
    log.info({ path: safe, spec }, "chown applied");
  },

  /** Change owner and/or group through an executor. */
  async chownWithExecutor(filePath: string, owner: string, group: string | undefined, executor: Executor): Promise<void> {
    const safe = safePath(filePath);
    assertSafeOwnerGroup(owner, "owner");
    if (group) assertSafeOwnerGroup(group, "group");
    const spec = group ? `${owner}:${group}` : owner;
    await executor.exec(quoteCmd("sudo", ["chown", "--", spec, safe]));
    log.info({ path: safe, spec, target: executor.target.id }, "chown applied via executor");
  },

  /**
   * Educational analysis of a mode for the permissions recommender (#5).
   * Pure (no I/O) so it's trivially testable and reusable on the client.
   */
  analyzeMode(mode: string, isDir: boolean): PermissionAnalysis {
    const bits = permBits(mode);
    const owner = Number(bits[0]);
    const group = Number(bits[1]);
    const other = Number(bits[2]);
    const recommended = isDir ? "755" : "644";
    const what = isDir ? "directorio" : "archivo";
    const reasons: string[] = [];
    // Severity escalates monotonically (ok < warning < danger); `bump` only
    // ever raises the level, never lowers it.
    const LEVELS: PermissionLevel[] = ["ok", "warning", "danger"];
    let rank = 0;
    const bump = (l: PermissionLevel) => { rank = Math.max(rank, LEVELS.indexOf(l)); };

    if (bits === "777") {
      bump("danger");
      reasons.push("777 da control total (lectura, escritura y ejecución) a TODOS los usuarios del sistema — el valor más peligroso.");
    } else if (other & 2) {
      bump("danger");
      reasons.push(`Cualquier usuario del sistema puede modificar este ${what} (permiso de escritura para «otros»).`);
    }
    if (!(other & 2) && group & 2) {
      bump("warning");
      reasons.push("El grupo puede modificarlo; revisa que sea intencional.");
    }
    if (!isDir && ((owner & 1) || (group & 1) || (other & 1))) {
      bump("warning");
      reasons.push("Tiene permiso de ejecución. Innecesario para archivos de datos/configuración (déjalo solo en scripts).");
    }
    if (!isDir && other & 1) {
      bump("warning");
      reasons.push("«Otros» pueden ejecutarlo: riesgo si vive en una carpeta pública (p. ej. uploads).");
    }

    const level = LEVELS[rank]!;
    if (bits === recommended) {
      reasons.unshift(`Permisos recomendados para un ${what}.`);
    } else if (level === "ok") {
      reasons.push(`Recomendado para un ${what}: ${recommended}.`);
    }
    return { current: bits, recommended, level, reasons };
  },

  /**
   * Recursive chmod across a directory tree (#5): apply a file mode to files
   * and/or a dir mode to directories. Uses `find -exec chmod … +`.
   */
  async chmodRecursiveWithExecutor(
    executor: Executor,
    opts: { path: string; fileMode?: string; dirMode?: string; applyTo: "all" | "files" | "dirs" },
  ): Promise<void> {
    const safe = safePath(opts.path);
    const norm = (m: string) => parseInt(m, 8).toString(8);
    const runs: string[] = [];
    if ((opts.applyTo === "all" || opts.applyTo === "files") && opts.fileMode) {
      runs.push(quoteCmd("find", [safe, "-type", "f", "-exec", "chmod", norm(opts.fileMode), "{}", "+"]));
    }
    if ((opts.applyTo === "all" || opts.applyTo === "dirs") && opts.dirMode) {
      runs.push(quoteCmd("find", [safe, "-type", "d", "-exec", "chmod", norm(opts.dirMode), "{}", "+"]));
    }
    for (const cmd of runs) {
      await executor.exec(cmd, { timeoutMs: 60_000 });
    }
    log.info({ path: safe, applyTo: opts.applyTo, target: executor.target.id }, "recursive chmod applied");
  },

  /** Convert numeric mode to symbolic representation (e.g. rwxr-xr-x). */
  _toSymbolic(mode: number): string {
    const chars = "rwxrwxrwx";
    let result = "";
    for (let i = 8; i >= 0; i--) {
      result += (mode >> i) & 1 ? chars[8 - i]! : "-";
    }
    return result;
  },
};
