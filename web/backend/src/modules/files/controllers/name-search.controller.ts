// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Name-search controller — recursive search by file/folder name for the
 * sidebar tree (`GET /api/files/search?base=&q=&limit=`).
 *
 * Shares its route with the legacy `?path=&q=` search: when `base` is absent
 * this handler calls `next()` so the older `browserController.search` (still
 * used by the search & replace panel) keeps working unchanged.
 */

import type { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { apiErrorMessage } from "../../../shared/i18n/errors.js";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MIN_QUERY_LENGTH,
  nameSearchService,
} from "../services/name-search.service.js";

function parseLimit(raw: unknown, locale: unknown): number {
  if (raw === undefined || raw === null || raw === "") return DEFAULT_LIMIT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new ValidationError(apiErrorMessage(locale, "validation"), [
      { field: "limit", message: apiErrorMessage(locale, "invalidFormat") },
    ]);
  }
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT);
}

export const nameSearchController = {
  /** GET /api/files/search?base=/var/www&q=foo&limit=100 */
  search: asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const base = req.query["base"];
    // Legacy `?path=&q=` callers fall through to browserController.search.
    if (base === undefined) {
      next();
      return;
    }
    if (typeof base !== "string" || base.trim().length === 0) {
      throw new ValidationError(apiErrorMessage(res.locals.locale, "validation"), [
        { field: "base", message: apiErrorMessage(res.locals.locale, "required") },
      ]);
    }

    const rawQuery = req.query["q"];
    const q = typeof rawQuery === "string" ? rawQuery.trim() : "";
    if (q.length < MIN_QUERY_LENGTH) {
      throw new ValidationError(apiErrorMessage(res.locals.locale, "validation"), [
        { field: "q", message: apiErrorMessage(res.locals.locale, "minimum", MIN_QUERY_LENGTH) },
      ]);
    }

    const limit = parseLimit(req.query["limit"], res.locals.locale);
    const executor = getExecutor(req);
    const result = await nameSearchService.search(executor, { base: base.trim(), q, limit });
    res.json(result);
  }),
};
