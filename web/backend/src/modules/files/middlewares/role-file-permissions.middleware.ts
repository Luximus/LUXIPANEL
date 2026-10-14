// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { RequestHandler } from "express";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { canAccessPath } from "../../../shared/auth/role-permissions.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { getExecutor, quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { safePath } from "../services/filesystem.service.js";
import type { SessionUser } from "../../../shared/types/index.js";

const log = createModuleLogger("file-perm-mw");

/**
 * EXPLICIT whitelist of body/query keys that carry filesystem paths. Every
 * route payload field that names a path MUST be listed here — the middleware
 * never infers "looks like a path" by value, so a key missing from this list
 * is a sandbox bypass (that's how `archive`/`sources`/`destDir` slipped past
 * the guard on /api/files/extract and /compress).
 */
const PATH_KEYS = [
  "path", "target", "source", "src", "dst", "from", "to", "directory",
  // Tree search root (GET /api/files/search?base=&q=) — same guard as `path`.
  "base",
  // Archive endpoints (operations.controller): compress {sources[], dest},
  // extract {archive, destDir}. Upload uses query {dest, filename→joined}.
  "archive", "sources", "dest", "destDir", "root",
] as const;

function collectPaths(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectPaths(item));
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return PATH_KEYS.flatMap((key) => collectPaths(obj[key]));
  }
  return [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((item) => item.trim().length > 0))];
}

export async function assertCanonicalFilePathPermission(executor: Executor, user: SessionUser, targetPath: string, operation: "read" | "write"): Promise<void> {
  if (!canAccessPath(user, targetPath, operation)) throw new ForbiddenError(`Path access denied for ${targetPath}`);
  // -m resolves symlinks in existing ancestors while tolerating a destination
  // that has not been created yet. Evaluate the real target on the connected box.
  const out = await executor.exec(quoteCmd("realpath", ["-m", "--", targetPath]));
  const resolved = out.stdout.trim();
  if (out.exitCode !== 0 || !resolved.startsWith("/")) throw new ForbiddenError("Could not resolve file path");
  safePath(resolved);
  if (!canAccessPath(user, resolved, operation)) throw new ForbiddenError(`Path access denied for ${resolved}`);
}

export function enforceFilePathPermission(operation: "read" | "write"): RequestHandler {
  return (req, res, next) => {
    const user = res.locals.user;
    if (!user) {
      next(new ForbiddenError("Authentication required"));
      return;
    }

    const paths = unique([
      ...collectPaths(req.query),
      ...collectPaths(req.body),
    ]);

    for (const path of paths) {
      if (!canAccessPath(user, path, operation)) {
        log.warn({ url: req.originalUrl, path, operation, username: user.username, kind: user.kind, fileAccess: user.permissions?.fileAccess }, "DENY path");
        next(new ForbiddenError(`Path access denied for ${path}`));
        return;
      }
    }
    if (paths.length === 0) { next(); return; }
    const executor = getExecutor(req);
    void Promise.all(paths.map((path) => assertCanonicalFilePathPermission(executor, user, path, operation)))
      .then(() => next(), next);
  };
}
