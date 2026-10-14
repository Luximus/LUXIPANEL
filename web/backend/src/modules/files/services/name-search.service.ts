// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Recursive search by NAME over the connected server (folder-tree search).
 *
 * The sidebar tree only knows about the nodes it has already expanded, so its
 * client-side filter can't find anything inside a folder the user never
 * opened. This service does the real walk on the client server through the
 * request `Executor` — never the panel host's fs.
 *
 * Implementation: a single `find` pruning `node_modules`/`.git`, piped into
 * `head` so the pipeline always exits 0 and the result set stays bounded.
 * Entry type comes from GNU `find -printf '%y\t%p\n'`; targets whose `find`
 * lacks `-printf` (busybox/BSD) fall back to a POSIX `-exec printf` variant,
 * chosen by a probe inside the same command so it costs one round-trip.
 */

import path from "node:path";
import { quoteArg, type Executor } from "../../../shared/executor/index.js";
import { safePath } from "./filesystem.service.js";

export interface NameSearchItem {
  path: string;
  name: string;
  type: "file" | "dir";
}

export interface NameSearchResult {
  items: NameSearchItem[];
  /** True when the limit was hit and the list was trimmed. */
  truncated: boolean;
  base: string;
}

export interface NameSearchOptions {
  /** Absolute root the walk starts from. */
  base: string;
  /** Substring matched case-insensitively against the entry name. */
  q: string;
  /** Hard cap on returned entries (default 100, capped at 500). */
  limit?: number;
}

export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 500;
export const MIN_QUERY_LENGTH = 2;
const FIND_TIMEOUT_MS = 15_000;
const PRUNED_DIRS = ["node_modules", ".git"];

/**
 * Neutralize fnmatch metacharacters so `q` is matched as a literal substring
 * (`-iname` globs, so an unescaped `*`/`?`/`[` would change the semantics).
 * Shell safety is handled separately by `quoteArg`.
 */
export function escapeGlob(value: string): string {
  return value.replace(/[\\*?[\]]/g, (ch) => `\\${ch}`);
}

/**
 * Build the shell command for the search. Exposed for tests.
 *
 * `safeBase` must already have gone through `safePath`; `query` is quoted with
 * `quoteArg`, so quotes/`$()`/backticks inside it stay inert.
 */
export function buildFindCommand(safeBase: string, query: string, limit: number): string {
  const base = quoteArg(safeBase);
  const pattern = quoteArg(`*${escapeGlob(query)}*`);
  const pruneExpr = [
    "'('",
    PRUNED_DIRS.map((dir) => `-name ${quoteArg(dir)}`).join(" -o "),
    "')'",
    "-prune",
  ].join(" ");
  // One extra line so the caller can tell "exactly `limit`" from "truncated".
  const head = `head -n ${limit + 1}`;

  const gnu =
    `find ${base} -mindepth 1 ${pruneExpr} -o -iname ${pattern} ` +
    `-printf '%y\\t%p\\n' 2>/dev/null | ${head}`;
  const posix =
    `find ${base} -mindepth 1 ${pruneExpr} -o -iname ${pattern} ` +
    `'(' -type d -exec printf 'd\\t%s\\n' '{}' ';' ` +
    `-o -exec printf 'f\\t%s\\n' '{}' ';' ')' 2>/dev/null | ${head}`;

  // Probe `-printf` support on a path that always exists, so the fallback is
  // picked on the target itself instead of costing a second SSH round-trip.
  return `if find /dev/null -maxdepth 0 -printf '' >/dev/null 2>&1; then ${gnu}; else ${posix}; fi`;
}

/** Parse `<type>\t<path>` lines into bounded, typed items. Exposed for tests. */
export function parseFindOutput(stdout: string, limit: number, base: string): NameSearchResult {
  const items: NameSearchItem[] = [];
  let truncated = false;

  for (const raw of stdout.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line) continue;
    const tab = line.indexOf("\t");
    if (tab <= 0) continue;
    const kind = line.slice(0, tab);
    const entryPath = line.slice(tab + 1).trim();
    if (!entryPath || entryPath === base) continue;
    if (items.length >= limit) {
      truncated = true;
      break;
    }
    items.push({
      path: entryPath,
      name: path.posix.basename(entryPath),
      type: kind === "d" ? "dir" : "file",
    });
  }

  return { items, truncated, base };
}

export const nameSearchService = {
  /**
   * Recursive name search from `base` on the connected server.
   *
   * Throws `ForbiddenError` (via `safePath`) when `base` escapes the sandbox.
   * The caller is responsible for rejecting queries shorter than
   * `MIN_QUERY_LENGTH` with a typed 400.
   */
  async search(executor: Executor, opts: NameSearchOptions): Promise<NameSearchResult> {
    const safe = safePath(opts.base);
    const query = opts.q.trim();
    const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

    if (query.length < MIN_QUERY_LENGTH) {
      return { items: [], truncated: false, base: safe };
    }

    const cmd = buildFindCommand(safe, query, limit);
    const out = await executor.exec(cmd, { timeoutMs: FIND_TIMEOUT_MS });
    return parseFindOutput(out.stdout ?? "", limit, safe);
  },
};
