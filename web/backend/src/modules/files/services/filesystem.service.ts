// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Filesystem service — sandboxed file operations.
 *
 * All paths are resolved and validated against ALLOWED_BASES before any
 * operation is performed. This prevents directory traversal attacks.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { ForbiddenError, AppError } from "../../../shared/errors/index.js";
import { ErrorCodes } from "../../../shared/errors/codes.js";
import { env } from "../../../config/env.js";
import { quoteArg, getContextExecutor, LOCAL_TARGET_ID, type Executor } from "../../../shared/executor/index.js";

const log = createModuleLogger("filesystem");

/**
 * Directories the file manager is allowed to access.
 * Default: "/host" when the host filesystem is mounted there (Docker),
 * falls back to "/" for bare-metal installs.
 * Override via FILE_MANAGER_BASES env var (comma-separated paths).
 */
function resolveDefaultBases(): string[] {
  const envBases = env.FILE_MANAGER_BASES;
  if (envBases) return envBases.split(",").map((b) => b.trim()).filter(Boolean);
  // Docker: host fs is mounted at /host by docker-compose
  if (fs.existsSync("/host")) return ["/host"];
  return ["/"];
}

export let ALLOWED_BASES: string[] = resolveDefaultBases();

export function setAllowedBases(bases: string[]): void {
  ALLOWED_BASES = bases.filter(Boolean).map((b) => path.resolve(b));
  log.info({ bases: ALLOWED_BASES }, "File manager allowed bases updated");
}

/** Resolve and validate a user-supplied path. Throws ForbiddenError if outside sandbox. */
export function safePath(userPath: string): string {
  const resolved = path.resolve(userPath);
  const allowed = ALLOWED_BASES.some((base) => resolved === base || resolved.startsWith(base + path.sep));
  if (!allowed) {
    throw new ForbiddenError(`Access denied: path '${resolved}' is outside allowed directories`);
  }
  return resolved;
}

export interface DirEntry {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink";
  /** Convenience alias for type === "dir" — used by the frontend. */
  isDir: boolean;
  size: number;
  mode: string;
  mtime: Date;
  isReadable: boolean;
  isWritable: boolean;
  /** Hidden files (start with .) in Linux. */
  isHidden: boolean;
  /** Directory contains a .git folder (Git repository). */
  hasGit: boolean;
  /** Git status: 'new' (untracked), 'modified', 'staged', null (unchanged). */
  gitStatus: "new" | "modified" | "staged" | "deleted" | null;
}

/** Pseudo-filesystems that should never be walked when summing sizes. */
const SYSTEM_DIRS = new Set(["/proc", "/sys", "/dev", "/run", "/snap"]);

/** Map a 2-char `git status --porcelain` code to a UI status (null = unchanged). */
function statusFromCode(code: string): DirEntry["gitStatus"] {
  if (code.includes("?")) return "new";
  if (code.includes("M")) return "modified";
  if (code.includes("A")) return "staged";
  if (code.includes("D")) return "deleted";
  return null;
}

/** Compute total size of a directory recursively. Bounded by entries and time. */
function computeDirSize(dirPath: string, maxEntries = 20000, maxDurationMs = 400): number {
  if (SYSTEM_DIRS.has(dirPath)) return 0;
  const start = Date.now();
  let total = 0;
  let count = 0;
  const stack: string[] = [dirPath];
  while (stack.length > 0) {
    if (count >= maxEntries) break;
    if (Date.now() - start > maxDurationMs) break;
    const current = stack.pop()!;
    if (SYSTEM_DIRS.has(current)) continue;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (count >= maxEntries) break;
      if (Date.now() - start > maxDurationMs) break;
      count++;
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!SYSTEM_DIRS.has(full)) stack.push(full);
      } else if (entry.isFile()) {
        try {
          total += fs.statSync(full).size;
        } catch { /* ignore */ }
      }
    }
  }
  return total;
}

export const filesystemService = {
  /** Compute size of a directory's contents recursively. */
  dirSize(dirPath: string): number {
    const safe = safePath(dirPath);
    return computeDirSize(safe);
  },

  /** Compute size via executor when running against a bridged target. */
  async dirSizeWithExecutor(dirPath: string, executor: Executor): Promise<number> {
    const safe = safePath(dirPath);
    const out = await executor.exec(`du -sb ${quoteArg(safe)} | awk '{print $1}'`);
    const size = parseInt(out.stdout.trim(), 10);
    return Number.isFinite(size) ? size : computeDirSize(safe);
  },

  /**
   * Resolve owner/group names for every direct child of `dirPath` in a single
   * exec. `find -printf` returns the resolved username/group (or numeric
   * id when there's no passwd/group entry), so we avoid one `stat` per file.
   * Returns a map keyed by entry name; empty map on any failure (fail-open).
   */
  async ownersWithExecutor(dirPath: string, executor: Executor): Promise<Map<string, { owner: string; group: string }>> {
    const map = new Map<string, { owner: string; group: string }>();
    const safe = safePath(dirPath);
    try {
      // Tab-separated: <name>\t<user>\t<group>. -mindepth 1 includes dotfiles
      // but excludes the directory itself.
      const out = await executor.exec(
        `find ${quoteArg(safe)} -maxdepth 1 -mindepth 1 -printf '%f\\t%u\\t%g\\n'`,
        { timeoutMs: 8_000 },
      );
      for (const line of out.stdout.split("\n")) {
        if (!line) continue;
        const tab1 = line.indexOf("\t");
        if (tab1 < 0) continue;
        const tab2 = line.indexOf("\t", tab1 + 1);
        if (tab2 < 0) continue;
        const name = line.slice(0, tab1);
        const owner = line.slice(tab1 + 1, tab2);
        const group = line.slice(tab2 + 1);
        if (name) map.set(name, { owner, group });
      }
    } catch {
      // fail-open: no owner column data
    }
    return map;
  },

  /**
   * Git status for the direct children of `dirPath` (when inside a repo), via
   * the executor — one `git status --porcelain` at the repo root, mapped to the
   * immediate child names of `dirPath`. Powers the new/modified/staged/deleted
   * coloring in the file list on remote targets. Empty map when not a repo or
   * on any error (fail-open).
   */
  async gitStatusWithExecutor(dirPath: string, executor: Executor): Promise<Map<string, DirEntry["gitStatus"]>> {
    const map = new Map<string, DirEntry["gitStatus"]>();
    const safe = safePath(dirPath);
    try {
      // `-c safe.directory='*'`: git runs as the SSH user, not the repo owner,
      // so without it repos under /var/www/* trip the "dubious ownership" guard
      // and the per-file git badges silently vanish. See git.service.ts.
      const cmd = `cd ${quoteArg(safe)} 2>/dev/null && root=$(git -c safe.directory='*' rev-parse --show-toplevel 2>/dev/null) && [ -n "$root" ] && printf 'ROOT=%s\\n' "$root" && git -c safe.directory='*' -C "$root" status --porcelain 2>/dev/null`;
      const out = await executor.exec(cmd, { timeoutMs: 6_000 });
      const lines = out.stdout.split("\n");
      let gitRoot = "";
      const porcelain: string[] = [];
      for (const line of lines) {
        if (line.startsWith("ROOT=")) gitRoot = line.slice(5).trim();
        else if (line.length) porcelain.push(line);
      }
      if (!gitRoot) return map;

      const relDir = path.posix.relative(gitRoot, safe);
      const dirPrefix = relDir ? `${relDir}/` : "";
      for (const line of porcelain) {
        const code = line.substring(0, 2);
        let filePath = line.substring(3).trim();
        const arrow = filePath.indexOf(" -> "); // renames: "old -> new"
        if (arrow >= 0) filePath = filePath.slice(arrow + 4);
        filePath = filePath.replace(/^"|"$/g, ""); // git quotes special chars
        const status = statusFromCode(code);
        if (!status) continue;
        if (dirPrefix && !filePath.startsWith(dirPrefix)) continue;
        const rel = dirPrefix ? filePath.slice(dirPrefix.length) : filePath;
        const child = rel.split("/")[0];
        if (child && !map.has(child)) map.set(child, status);
      }
    } catch {
      // fail-open: no git colors
    }
    return map;
  },

  /** Recursive search by name (case-insensitive substring) starting at dirPath. */
  searchRecursive(dirPath: string, query: string, maxResults = 500, maxEntries = 100000, maxDurationMs = 2000): DirEntry[] {
    const safe = safePath(dirPath);
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const start = Date.now();
    const results: DirEntry[] = [];
    let count = 0;
    const stack: string[] = [safe];
    while (stack.length > 0 && results.length < maxResults && count < maxEntries) {
      // Time budget (like computeDirSize): a `GET /api/files/search?path=/`
      // walk of up to 100k entries would block the event loop for seconds.
      if (Date.now() - start > maxDurationMs) break;
      const current = stack.pop()!;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (results.length >= maxResults || count >= maxEntries) break;
        if (Date.now() - start > maxDurationMs) break;
        count++;
        const full = path.join(current, entry.name);
        if (entry.isSymbolicLink()) continue;
        const isDir = entry.isDirectory();
        if (entry.name.toLowerCase().includes(q)) {
          let stat: fs.Stats;
          try {
            stat = fs.statSync(full);
          } catch {
            continue;
          }
          results.push({
            name: entry.name,
            path: full,
            type: isDir ? "dir" : "file",
            isDir,
            size: stat.size,
            mode: stat.mode.toString(8).slice(-4),
            mtime: stat.mtime,
            isReadable: true,
            isWritable: false,
            isHidden: entry.name.startsWith("."),
            hasGit: false,
            gitStatus: null,
          });
        }
        if (isDir && !entry.name.startsWith(".") && entry.name !== "node_modules") {
          stack.push(full);
        }
      }
    }
    return results;
  },

  /** Recursive search via executor when running against a bridged target. */
  async searchRecursiveWithExecutor(
    dirPath: string,
    query: string,
    executor: Executor,
    maxResults = 500,
  ): Promise<DirEntry[]> {
    const safe = safePath(dirPath);
    const q = query.trim();
    if (!q) return [];
    const out = await executor.exec(`find ${quoteArg(safe)} -iname ${quoteArg(`*${q}*`)}`);
    const paths = out.stdout.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, maxResults);

    if (typeof executor.batchSftp === "function" && paths.length > 0) {
      // The internal batchSftp caps each batch at 80 operations; chunk to stay under it.
      const BATCH_LIMIT = 64;
      const entries: DirEntry[] = [];
      for (let start = 0; start < paths.length; start += BATCH_LIMIT) {
        const chunk = paths.slice(start, start + BATCH_LIMIT);
        const operations = chunk.map((filePath, index) => ({
          id: `stat-${start + index}`,
          op: "stat" as const,
          path: filePath,
        }));
        let results: Awaited<ReturnType<NonNullable<typeof executor.batchSftp>>>;
        try {
          results = await executor.batchSftp(operations);
        } catch {
          continue; // skip a failed chunk rather than 500 the whole search
        }
        const pathById = new Map(operations.map((op) => [op.id, op.path]));
        for (const result of results) {
          if (!result.ok || !result.data) continue;
          const filePath = pathById.get(result.id);
          if (!filePath) continue;
          const raw = result.data as Partial<DirEntry> & { mtime?: string | Date };
          entries.push({
            name: raw.name ?? path.basename(filePath),
            path: raw.path ?? filePath,
            type: raw.type === "dir" || raw.type === "symlink" ? raw.type : "file",
            isDir: raw.type === "dir" || raw.isDir === true,
            size: typeof raw.size === "number" ? raw.size : 0,
            mode: typeof raw.mode === "string" ? raw.mode : "0000",
            mtime: raw.mtime ? new Date(raw.mtime) : new Date(),
            isReadable: raw.isReadable ?? true,
            isWritable: raw.isWritable ?? true,
            isHidden: raw.isHidden ?? path.basename(filePath).startsWith("."),
            hasGit: raw.hasGit ?? false,
            gitStatus: raw.gitStatus ?? null,
          });
        }
      }
      return entries;
    }

    const results: DirEntry[] = [];
    for (const filePath of paths) {
      try {
        const info = await executor.stat(filePath);
        results.push(info);
      } catch {
        // ignore entries that disappeared between find and stat
      }
    }
    return results;
  },

  /** List directory contents. */
  listDir(dirPath: string, opts: { withDirSize?: boolean } = {}): DirEntry[] {
    const safe = safePath(dirPath);

    let rawEntries: fs.Dirent[];
    try {
      rawEntries = fs.readdirSync(safe, { withFileTypes: true });
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") throw new AppError(`Directory not found: ${safe}`, 404, ErrorCodes.NOT_FOUND);
      if (e.code === "EACCES" || e.code === "EPERM") throw new AppError(`Permission denied: ${safe}`, 403, ErrorCodes.FORBIDDEN);
      if (e.code === "ENOTDIR") throw new AppError(`Not a directory: ${safe}`, 400, ErrorCodes.NOT_A_DIRECTORY);
      throw err;
    }

    const gitStatusMap = this._getGitStatusMap(safe);
    log.debug({ dirPath: safe, mapSize: gitStatusMap.size }, "Git status map for listDir");

    return rawEntries.map((entry) => {
      const fullPath = path.join(safe, entry.name);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        stat = fs.lstatSync(fullPath);
      }

      const type: DirEntry["type"] = entry.isSymbolicLink() ? "symlink" : entry.isDirectory() ? "dir" : "file";
      const isHidden = entry.name.startsWith(".");

      let isReadable = false;
      let isWritable = false;
      try { fs.accessSync(fullPath, fs.constants.R_OK); isReadable = true; } catch { /* ignore */ }
      try { fs.accessSync(fullPath, fs.constants.W_OK); isWritable = true; } catch { /* ignore */ }

      let hasGit = false;
      if (type === "dir") {
        try {
          hasGit = fs.existsSync(path.join(fullPath, ".git"));
        } catch {
          hasGit = false;
        }
      }

      const gitStatus = gitStatusMap.get(entry.name) ?? null;
      log.debug({ entryName: entry.name, gitStatus }, "Git status lookup for entry");

      let size = stat.size;
      if (opts.withDirSize && type === "dir") {
        try {
          size = computeDirSize(fullPath);
        } catch { /* ignore */ }
      }

      return {
        name: entry.name,
        path: fullPath,
        type,
        isDir: type === "dir",
        size,
        mode: stat.mode.toString(8).slice(-4),
        mtime: stat.mtime,
        isReadable,
        isWritable,
        isHidden,
        hasGit,
        gitStatus,
      };
    });
  },

  /** Get stat info for a single path. */
  stat(filePath: string): DirEntry {
    const safe = safePath(filePath);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(safe);
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") throw new AppError(`Not found: ${safe}`, 404, ErrorCodes.NOT_FOUND);
      if (e.code === "EACCES" || e.code === "EPERM") throw new AppError(`Permission denied: ${safe}`, 403, ErrorCodes.FORBIDDEN);
      throw err;
    }
    const name = path.basename(safe);
    const type: DirEntry["type"] = stat.isSymbolicLink() ? "symlink" : stat.isDirectory() ? "dir" : "file";
    const isHidden = name.startsWith(".");

    let hasGit = false;
    if (type === "dir") {
      try {
        hasGit = fs.existsSync(path.join(safe, ".git"));
      } catch {
        hasGit = false;
      }
    }

    const parentDir = path.dirname(safe);
    const gitStatusMap = this._getGitStatusMap(parentDir);
    const gitStatus = gitStatusMap.get(name) ?? null;

    return {
      name,
      path: safe,
      type,
      isDir: type === "dir",
      size: stat.size,
      mode: stat.mode.toString(8).slice(-4),
      mtime: stat.mtime,
      isReadable: this._canAccess(safe, fs.constants.R_OK),
      isWritable: this._canAccess(safe, fs.constants.W_OK),
      isHidden,
      hasGit,
      gitStatus,
    };
  },

  /** Read a text file (max 2MB). */
  readText(filePath: string): string {
    const safe = safePath(filePath);
    const stat = fs.statSync(safe);
    if (stat.size > 2 * 1024 * 1024) {
      throw new Error("File too large to read in editor (max 2MB)");
    }
    return fs.readFileSync(safe, "utf-8");
  },

  /** Write text content to a file. */
  writeText(filePath: string, content: string): void {
    const safe = safePath(filePath);
    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(safe), { recursive: true });
    fs.writeFileSync(safe, content, "utf-8");
    log.info({ path: safe }, "File written");
  },

  /** Write binary content to a file. */
  writeBinary(filePath: string, data: Buffer): void {
    const safe = safePath(filePath);
    fs.mkdirSync(path.dirname(safe), { recursive: true });
    fs.writeFileSync(safe, data);
    log.info({ path: safe, size: data.length }, "Binary file written");
  },

  /** Create a directory (recursive). */
  mkdir(dirPath: string): void {
    const safe = safePath(dirPath);
    fs.mkdirSync(safe, { recursive: true });
    log.info({ path: safe }, "Directory created");
  },

  /** Delete a file or empty directory. Use `recursive` for directories with content. */
  delete(targetPath: string, recursive = false): void {
    const safe = safePath(targetPath);
    const stat = fs.statSync(safe);
    if (stat.isDirectory()) {
      fs.rmSync(safe, { recursive, force: false });
    } else {
      fs.unlinkSync(safe);
    }
    log.info({ path: safe, recursive }, "Path deleted");
  },

  /** Rename / move a path within the sandbox. */
  rename(fromPath: string, toPath: string): void {
    const safeFrom = safePath(fromPath);
    const safeTo = safePath(toPath);
    fs.mkdirSync(path.dirname(safeTo), { recursive: true });
    fs.renameSync(safeFrom, safeTo);
    log.info({ from: safeFrom, to: safeTo }, "Path renamed/moved");
  },

  /** Copy a file or directory tree within the sandbox. */
  copyFile(fromPath: string, toPath: string): void {
    const safeFrom = safePath(fromPath);
    const safeTo = safePath(toPath);
    fs.mkdirSync(path.dirname(safeTo), { recursive: true });
    if (fs.existsSync(safeTo)) {
      throw new AppError(`Destination already exists: ${safeTo}`, 409, ErrorCodes.ALREADY_EXISTS);
    }

    fs.cpSync(safeFrom, safeTo, {
      recursive: true,
      errorOnExist: true,
      preserveTimestamps: true,
    });
    log.info({ from: safeFrom, to: safeTo }, "Path copied");
  },

  _getGitStatusMap(dirPath: string): Map<string, DirEntry["gitStatus"]> {
    const map = new Map<string, DirEntry["gitStatus"]>();
    // Cross-server guard: this helper shells out to git ON THE PANEL HOST
    // (execSync). When the request context points at a REMOTE target, running
    // it here would leak the panel host's git status into the remote listing
    // (wrong data across servers). Remote listings get their git badges from
    // `gitStatusWithExecutor` (async, runs on the target); here we bail out
    // with an empty map. NOTE: the spec called for `_withExecutor()`, but no
    // such helper exists and listDir/stat are synchronous — the context-
    // executor check is the equivalent fail-safe.
    const ctx = getContextExecutor();
    if (ctx && ctx.target.id !== LOCAL_TARGET_ID) return map;
    try {
      // Find git root by running git rev-parse --show-toplevel
      let gitRoot = dirPath;
      try {
        gitRoot = execSync("git rev-parse --show-toplevel", {
          cwd: dirPath,
          encoding: "utf-8",
          timeout: 5000,
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
      } catch {
        // Not in a git repo or command failed
        return map;
      }

      const status = execSync("git status --porcelain", {
        cwd: gitRoot,
        encoding: "utf-8",
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const gitFiles = new Map<string, DirEntry["gitStatus"]>();
      status.split("\n").forEach((line) => {
        if (!line.trim()) return;
        const fileStatus = statusFromCode(line.substring(0, 2));
        if (fileStatus) gitFiles.set(line.substring(3).trim(), fileStatus);
      });

      // Calculate relative path from git root to dirPath
      const relDir = path.relative(gitRoot, dirPath);
      const dirPrefix = relDir ? relDir + path.sep : "";

      // Build a map for direct and parent matches
      gitFiles.forEach((fileStatus, gitPath) => {
        // Only include files within the current directory tree
        if (!gitPath.startsWith(dirPrefix) && gitPath !== relDir) {
          return;
        }

        // Remove the directory prefix to get the relative name
        const relativePath = relDir ? gitPath.substring(dirPrefix.length) : gitPath;
        const parts = relativePath.split(path.sep);

        // For "src/file.ts" in /var/www/LUXIPANEL/backend, also map "src" as modified
        for (let i = 1; i <= parts.length; i++) {
          const parentPath = parts.slice(0, i).join(path.sep);
          if (!map.has(parentPath)) map.set(parentPath, fileStatus);
        }
      });
    } catch (err) {
      log.debug({ dir: dirPath, error: (err as Error).message }, "Git status error or not a repo");
    }
    return map;
  },

  _canAccess(p: string, mode: number): boolean {
    try {
      fs.accessSync(p, mode);
      return true;
    } catch {
      return false;
    }
  },
};
