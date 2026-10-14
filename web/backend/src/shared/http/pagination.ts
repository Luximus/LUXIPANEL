// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `?limit=` / `?page=` parsing — normalized once (B-31).
 *
 * Every list endpoint rolled its own
 * `Math.min(parseInt(String(req.query.limit ?? "N"), 10), CAP)`, with a
 * different default and cap per controller — and at least one (mail contacts)
 * with NO cap at all, so `?limit=1e9` was accepted verbatim. `parseInt` also
 * yields `NaN` for garbage input, which then flows into repositories as a slice
 * bound. This helper always returns a finite integer inside `[1, maxLimit]`.
 */

const MIN_LIMIT = 1;

export interface PageQueryOptions {
  /** Used when the param is absent or unparseable. */
  defaultLimit: number;
  /** Hard upper bound — a client can never ask for more. */
  maxLimit: number;
  /** Extra query keys accepted as aliases of `limit` (e.g. `pageSize`). */
  aliases?: readonly string[];
}

export interface PageQuery {
  limit: number;
  /** 1-based page number (>= 1). */
  page: number;
  /** `(page - 1) * limit`, for repositories that take an offset. */
  offset: number;
}

/** Coerce one query value to a finite integer, or `null`. */
function toInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(raw), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parse `limit`/`page` from an Express-style query bag, clamped to
 * `[1, maxLimit]`. Never returns `NaN`.
 */
export function parsePageQuery(
  query: Record<string, unknown> | undefined,
  opts: PageQueryOptions,
): PageQuery {
  const q = query ?? {};
  let raw = toInt(q["limit"]);
  for (const alias of opts.aliases ?? []) {
    if (raw !== null) break;
    raw = toInt(q[alias]);
  }
  const limit = Math.min(Math.max(raw ?? opts.defaultLimit, MIN_LIMIT), opts.maxLimit);
  const page = Math.max(toInt(q["page"]) ?? 1, 1);
  return { limit, page, offset: (page - 1) * limit };
}
