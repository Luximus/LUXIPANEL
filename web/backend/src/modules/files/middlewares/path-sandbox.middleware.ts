// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Path sandbox middleware — validates that path query/body params are safe.
 *
 * Rejects requests with obviously malicious path segments before they reach
 * the service layer. The service layer does the authoritative safePath() check;
 * this middleware acts as a fast early-exit guard.
 */

import type { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../../../shared/errors/index.js";

/** Patterns that are never allowed in paths, regardless of sandbox. */
const BLOCKED_PATTERNS = [
  /\.\.[/\\]/, // traversal
  /\0/,        // null byte
  /^\/proc\//,
  /^\/sys\//,
  /^\/dev\//,
];

function isPathSafe(p: string): boolean {
  return !BLOCKED_PATTERNS.some((pattern) => pattern.test(p));
}

/** Validate all path-related fields in query, body, and params. */
export function pathSandbox(req: Request, _res: Response, next: NextFunction): void {
  const pathFields = [
    req.query["path"],
    // Tree search root (GET /api/files/search?base=&q=).
    req.query["base"],
    req.query["from"],
    req.query["to"],
    // SECURITY: the upload endpoint takes the destination via query dest+filename
    // (see upload.controller.ts: path.join(query.dest, query.filename)). These
    // were NOT previously checked, so "../" in either escaped the sandbox.
    req.query["dest"],
    req.query["filename"],
    req.body?.path,
    req.body?.from,
    req.body?.to,
    req.body?.dest,
    req.body?.root,
    req.body?.filename,
    req.body?.destDir,
    req.body?.archive,
    req.body?.sources,
  ].flat();

  for (const field of pathFields) {
    if (typeof field === "string" && !isPathSafe(field)) {
      next(new ForbiddenError("Path contains forbidden patterns"));
      return;
    }
  }

  next();
}
