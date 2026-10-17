// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Browser controller — list directories and get file info.
 */

import { z } from "zod";
import path from "node:path";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor, LOCAL_TARGET_ID, mapFsError } from "../../../shared/executor/index.js";
import { filesystemService } from "../services/index.js";
import { permissionsService } from "../services/index.js";
import { ALLOWED_BASES } from "../services/filesystem.service.js";
import { directoryPage } from "../services/directory-page.js";
import { FILE_ACTION_IDS, canAccessPath } from "../../../shared/auth/role-permissions.js";
import {
  readCachedDir, writeCachedDir,
  readCachedDirSize, readCachedDirSizes, writeCachedDirSize,
  readCachedStat, writeCachedStat,
  readCachedSearch, writeCachedSearch,
  recordVisit, readVisits,
} from "../../../shared/files-cache/index.js";

const listSchema = z.object({
  path: z.string().min(1),
  withDirSize: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  sortKey: z.enum(["name", "type", "size", "modified"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  showHidden: z.enum(["true", "false"]).optional(),
  query: z.string().max(1000).optional(),
});

const statSchema = z.object({
  path: z.string().min(1),
});

const searchSchema = z.object({
  path: z.string().min(1),
  q: z.string().min(1),
});

// The body key is `path` (an array) so the path-sandbox and role-permission
// middlewares — which collect string/array values under the `path` key —
// validate every entry just like the single-path endpoints.
const dirSizesSchema = z.object({
  path: z.array(z.string().min(1)).min(1).max(1000),
});

function normalizeListEntry(entry: any, parentPath: string) {
  if (typeof entry === "string") {
    const entryPath = path.posix.join(parentPath, entry);
    return {
      name: entry,
      path: entryPath,
      type: "file",
      isDir: false,
      size: 0,
      mode: "0000",
      mtime: new Date(),
      isReadable: true,
      isWritable: true,
      isHidden: entry.startsWith("."),
      hasGit: false,
      gitStatus: null,
    };
  }
  const entryPath = typeof entry?.path === "string" && entry.path
    ? entry.path
    : path.posix.join(parentPath, String(entry?.name ?? ""));
  const fallbackName = path.posix.basename(entryPath);
  const normalizedName = typeof entry?.name === "string" && entry.name.trim().length > 0
    ? entry.name
    : fallbackName;
  // No resolvable name → not a listable entry; the caller drops these.
  if (!normalizedName) return null;
  const type = entry?.type === "dir" || entry?.isDir
    ? "dir"
    : entry?.type === "symlink"
      ? "symlink"
      : "file";
  return {
    ...entry,
    name: normalizedName,
    path: entryPath,
    type,
    isDir: type === "dir",
    size: typeof entry?.size === "number" ? entry.size : 0,
    mode: typeof entry?.mode === "string" ? entry.mode : "0000",
    mtime: entry?.mtime ? new Date(entry.mtime) : new Date(),
    isReadable: entry?.isReadable ?? true,
    isWritable: entry?.isWritable ?? true,
    isHidden: entry?.isHidden ?? (normalizedName || "").startsWith("."),
    hasGit: entry?.hasGit ?? false,
    gitStatus: entry?.gitStatus ?? null,
  };
}

export const browserController = {
  /** GET /api/files/list?path=/var/www — list directory contents.
   *
   *  Cache-aside via per-target Redis: a hit returns in one `redis-cli` exec
   *  round-trip (~50-100 ms) vs the live SFTP `readdir` (~300-2000 ms on
   *  large dirs). Cache is invalidated on every panel-driven mutation; TTL
   *  bounds drift from out-of-band changes. `withDirSize=true` skips cache
   *  because per-dir size requires a recursive walk we don't store. */
  list: asyncHandler(async (req: Request, res: Response) => {
    const parsed = listSchema.parse(req.query);
    const withDirSize = parsed.withDirSize === "true" || parsed.withDirSize === "1";
    const executor = getExecutor(req);

    if (!withDirSize) {
      const cached = await readCachedDir<NonNullable<ReturnType<typeof normalizeListEntry>>>(executor, parsed.path);
      if (cached) {
        res.json({ ok: true, path: parsed.path, ...directoryPage(cached, parsed), fromCache: true });
        return;
      }
    }

    let entries: Awaited<ReturnType<typeof executor.readdir>>;
    try {
      entries = await executor.readdir(parsed.path);
    } catch (err) {
      // Permission/absence → typed 403/404 instead of a generic 500.
      throw mapFsError(err, parsed.path);
    }
    const normalized = Array.isArray(entries)
      ? entries
          .map((entry) => normalizeListEntry(entry, parsed.path))
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      : [];

    // Owner/group + git status for the whole directory, each in one exec
    // (fail-open → column/colors simply omitted).
    const [owners, gitMap] = await Promise.all([
      filesystemService.ownersWithExecutor(parsed.path, executor).catch(() => null),
      filesystemService.gitStatusWithExecutor(parsed.path, executor).catch(() => null),
    ]);
    const enriched = normalized.map((entry) => {
      const o = owners?.get(entry.name);
      const gs = gitMap?.get(entry.name) ?? null;
      return {
        ...entry,
        ...(o ? { owner: o.owner, group: o.group } : {}),
        ...(gs ? { gitStatus: gs } : {}),
      };
    });

    const data = withDirSize
      ? enriched
      : enriched.map((entry) => entry.type === "dir" ? { ...entry, size: 0 } : entry);

    if (!withDirSize) {
      // Fire-and-forget; never blocks the response.
      void writeCachedDir(executor, parsed.path, data);
    }
    res.json({ ok: true, path: parsed.path, ...directoryPage(data, parsed) });
  }),

  /** GET /api/files/search?path=/var/www&q=foo — recursive search by name.
   *
   *  Cache-aside per `(path, q)`. Recursive `find -name` over large trees
   *  is expensive; we accept short TTL staleness (60 s) because granular
   *  invalidation by content change isn't feasible — any descendant write
   *  could affect the result set. */
  search: asyncHandler(async (req: Request, res: Response) => {
    const { path, q } = searchSchema.parse({ path: req.query["path"], q: req.query["q"] });
    const executor = getExecutor(req);
    const cached = await readCachedSearch(executor, path, q);
    if (cached) {
      res.json({ ok: true, path, query: q, data: cached, fromCache: true });
      return;
    }
    const results = executor.target.id === LOCAL_TARGET_ID
      ? filesystemService.searchRecursive(path, q)
      : await filesystemService.searchRecursiveWithExecutor(path, q, executor);
    void writeCachedSearch(executor, path, q, results as unknown[]);
    res.json({ ok: true, path, query: q, data: results });
  }),

  /** GET /api/files/dir-size?path=/var/www — compute total directory size.
   *
   *  Recursive `du`-style walks are expensive (seconds to minutes on large
   *  trees), so we cache the result per-target with a longer TTL than the
   *  listing cache: total bytes drift slowly even when individual files
   *  churn, and a slightly stale size is harmless in the UI. */
  dirSize: asyncHandler(async (req: Request, res: Response) => {
    const { path } = statSchema.parse({ path: req.query["path"] });
    const executor = getExecutor(req);
    const cached = await readCachedDirSize(executor, path);
    if (cached !== null) {
      res.json({ ok: true, data: { path, size: cached }, fromCache: true });
      return;
    }
    const size = executor.target.id === LOCAL_TARGET_ID
      ? filesystemService.dirSize(path)
      : await filesystemService.dirSizeWithExecutor(path, executor);
    void writeCachedDirSize(executor, path, size);
    res.json({ ok: true, data: { path, size } });
  }),

  /** POST /api/files/dir-sizes  body { path: string[] } — batch cache read.
   *
   *  Returns `{ sizes: { <path>: bytes | null } }` reading every path from the
   *  per-target Redis in a single `MGET`. `null` means "not cached yet" — the
   *  file browser then computes those misses lazily (bounded concurrency) via
   *  the per-path `GET /api/files/dir-size`, which runs the recursive `du` and
   *  warms the cache. This endpoint never runs `du` itself, so it stays fast
   *  regardless of how large the listed directories are. */
  dirSizes: asyncHandler(async (req: Request, res: Response) => {
    const { path: paths } = dirSizesSchema.parse({ path: req.body?.path });
    const executor = getExecutor(req);
    // Per-path tolerant permission filter (NOT the all-or-nothing route
    // middleware): paths the caller can't read are dropped silently and
    // reported as null, so one denied entry never 403s the whole batch. The
    // single-path GET /api/files/dir-size still enforces via middleware.
    const user = res.locals.user;
    const allowed: string[] = [];
    const sizes: Record<string, number | null> = {};
    for (const p of paths) {
      if (user && canAccessPath(user, p, "read")) allowed.push(p);
      else sizes[p] = null;
    }
    if (allowed.length > 0) {
      Object.assign(sizes, await readCachedDirSizes(executor, allowed));
    }
    res.json({ ok: true, data: { sizes } });
  }),

  /** GET /api/files/path-suggest?path=/var/ww — autocomplete the path bar.
   *
   *  Splits the partial into <parent>/<prefix>, lists the parent's
   *  subdirectories matching the prefix, and ranks them by visit count
   *  (most-visited first, then alphabetically) so the top suggestion is the
   *  folder the user opens most. Permission on the typed path is enforced by
   *  the route middleware. Fail-open → empty list. */
  pathSuggest: asyncHandler(async (req: Request, res: Response) => {
    const { path: partial } = statSchema.parse({ path: req.query["path"] });
    const executor = getExecutor(req);

    const norm = partial.replace(/\/{2,}/g, "/");
    let parent: string;
    let prefix: string;
    if (norm.endsWith("/")) {
      parent = norm.replace(/\/+$/, "") || "/";
      prefix = "";
    } else {
      const idx = norm.lastIndexOf("/");
      parent = idx <= 0 ? "/" : norm.slice(0, idx);
      prefix = norm.slice(idx + 1);
    }

    let entries: Awaited<ReturnType<typeof executor.readdir>>;
    try {
      entries = await executor.readdir(parent);
    } catch {
      res.json({ ok: true, data: { parent, prefix, suggestions: [] } });
      return;
    }

    const lower = prefix.toLowerCase();
    const dirs = (Array.isArray(entries) ? entries : [])
      .filter((e) => e.isDir && typeof e.name === "string" && (!lower || e.name.toLowerCase().startsWith(lower)))
      .map((e) => ({ name: e.name, path: `${parent === "/" ? "" : parent}/${e.name}` }));

    const visits = await readVisits(executor, dirs.map((d) => d.path));
    dirs.sort((a, b) => (visits[b.path] ?? 0) - (visits[a.path] ?? 0) || a.name.localeCompare(b.name));

    const suggestions = dirs.slice(0, 12).map((d) => ({ name: d.name, path: d.path, visits: visits[d.path] ?? 0 }));
    res.json({ ok: true, data: { parent, prefix, suggestions } });
  }),

  /** POST /api/files/visit  body { path } — record a directory visit (INCR).
   *  Fire-and-forget; feeds the autocomplete ranking. */
  visit: asyncHandler(async (req: Request, res: Response) => {
    const { path } = statSchema.parse({ path: req.body?.path });
    const executor = getExecutor(req);
    void recordVisit(executor, path);
    res.json({ ok: true });
  }),

  /** GET /api/files/stat?path=/var/www/index.html — get file metadata + permissions.
   *
   *  Two SFTP calls (`stat` + permissions probe) per request; cache the
   *  composite result. Invalidated by chmod/chown/write/delete/rename of
   *  the same path. */
  stat: asyncHandler(async (req: Request, res: Response) => {
    const { path } = statSchema.parse({ path: req.query["path"] });
    const executor = getExecutor(req);
    const cached = await readCachedStat<Record<string, unknown>>(executor, path);
    if (cached) {
      res.json({ ok: true, data: cached, fromCache: true });
      return;
    }
    let info: Awaited<ReturnType<typeof executor.stat>>;
    try {
      info = await executor.stat(path);
    } catch (err) {
      throw mapFsError(err, path);
    }
    const permissions = executor.target.id === LOCAL_TARGET_ID
      ? permissionsService.getPermissions(path)
      : await permissionsService.getPermissionsWithExecutor(path, executor);
    const data = { ...info, permissions };
    void writeCachedStat(executor, path, data);
    res.json({ ok: true, data });
  }),

  /** GET /api/files/allowed-bases — sandbox base dirs + the caller's effective
   *  file-access policy (so the UI opens at an allowed path, not "/"). */
  allowedBases: asyncHandler(async (_req: Request, res: Response) => {
    const user = res.locals.user;
    const fa = user?.permissions?.fileAccess;
    const allowAll = user?.kind === "admin" || Boolean(fa?.allowAll);
    const allowPaths: string[] = Array.isArray(fa?.allowPaths) ? fa!.allowPaths : [];
    // Effective default: explicit defaultPath → first allowed path → "/" when
    // the user has unrestricted access.
    const defaultPath = (fa?.defaultPath && fa.defaultPath.trim())
      ? fa.defaultPath.trim()
      : (allowPaths[0] ?? (allowAll ? "/" : null));
    // The caller's effective file action permissions (so the UI can hide every
    // button/feature it can't use). Admins implicitly have all of them.
    const granted: string[] = Array.isArray(user?.permissions?.actions) ? (user!.permissions!.actions as string[]) : [];
    const actions = user?.kind === "admin" || granted.includes("files.*")
      ? FILE_ACTION_IDS
      : FILE_ACTION_IDS.filter((a) => granted.includes(a));
    res.json({ ok: true, data: { bases: ALLOWED_BASES, allowAll, allowPaths, defaultPath, actions } });
  }),

  /** GET /api/files/tree?path=/var — list only subdirectories (for sidebar menu). */
  tree: asyncHandler(async (req: Request, res: Response) => {
    const { path } = listSchema.parse({ path: req.query["path"] });
    const executor = getExecutor(req);
    let entries: Awaited<ReturnType<typeof executor.readdir>>;
    try {
      entries = await executor.readdir(path);
    } catch (err) {
      throw mapFsError(err, path);
    }
    const dirs = entries.filter((e) => e.isDir).sort((a, b) => a.name.localeCompare(b.name));
    res.json({ ok: true, path, data: dirs });
  }),
};
