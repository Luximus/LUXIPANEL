// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Content search engine (Fase 0.2) — recursive grep over the client server.
 *
 * Backs the "buscar texto dentro de archivos" feature (#9) and feeds mass
 * replace (#10) and the exposed-secrets / malware scans (#3, #12). Everything
 * runs through the request `Executor` so it lands on the connected server.
 *
 * Implementation: GNU `grep -rnI` piped into `head` so the pipeline always
 * exits 0 (grep's "no match" exit 1 is masked) and the result set is bounded.
 */

import path from "node:path";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { safePath } from "./filesystem.service.js";

/** Search modes: free text / regex, plus canned scanners for common targets. */
export type SearchMode =
  | "text"
  | "regex"
  | "email"
  | "url"
  | "apikey"
  | "import"
  | "function"
  | "endpoint"
  | "variable";

export interface ContentMatch {
  line: number;
  text: string;
}

export interface FileMatches {
  path: string;
  name: string;
  matches: ContentMatch[];
}

export interface ContentSearchResult {
  files: FileMatches[];
  totalMatches: number;
  /** True when the match cap was hit and results were trimmed. */
  truncated: boolean;
  engine: "grep";
}

export interface ContentSearchOptions {
  path: string;
  /** Required for "text"/"regex"; ignored by the canned scanners. */
  query?: string;
  mode?: SearchMode;
  caseSensitive?: boolean;
  /** Hard cap on total matches returned (default 500). */
  maxResults?: number;
  /** Directories pruned from the walk. */
  excludeDirs?: string[];
  /** Only scan files matching these globs (grep `--include`); empty = all. */
  includeFiles?: string[];
  /** Skip files matching these globs (grep `--exclude`). */
  excludeFiles?: string[];
}

const DEFAULT_EXCLUDES = [".git", "node_modules", "vendor", ".cache", "dist", "build", ".next"];
const DEFAULT_MAX_RESULTS = 500;
const MAX_RESULTS_CAP = 5000;
const MAX_MATCHES_PER_FILE = 100;
const GREP_TIMEOUT_MS = 25_000;

// POSIX ERE patterns (no \d/\w/\s — use bracket classes for portability).
// `forceCase: false` runs case-insensitive (emails/urls/keys are case-noisy).
const PRESET_PATTERNS: Partial<Record<SearchMode, { pattern: string; forceInsensitive?: boolean }>> = {
  email: { pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", forceInsensitive: true },
  url: { pattern: "https?://[^[:space:]\"'<>]+", forceInsensitive: true },
  apikey: {
    pattern: "(api[_-]?key|secret|token|passwd|password|access[_-]?key|bearer|AKIA[0-9A-Z]{16})",
    forceInsensitive: true,
  },
  import: { pattern: "^[[:space:]]*(import|require|use|from|include|using)[[:space:](]" },
  function: { pattern: "(function|def|func|fn|sub)[[:space:]]+[A-Za-z_]" },
  endpoint: {
    pattern: "(\\.(get|post|put|delete|patch)\\(|@(Get|Post|Put|Delete|Patch|Route|RequestMapping))",
  },
  variable: { pattern: "((const|let|var)[[:space:]]+[A-Za-z_]|\\$[A-Za-z_])" },
};

/** Build the grep argv (without the trailing `| head`). Exposed for tests. */
export function buildGrepArgs(safe: string, opts: ContentSearchOptions): string[] {
  const mode = opts.mode ?? "text";
  const args = ["-rnI", "--binary-files=without-match"];

  const preset = PRESET_PATTERNS[mode];
  const caseInsensitive = preset?.forceInsensitive ? true : !opts.caseSensitive;
  if (caseInsensitive) args.push("-i");

  let pattern: string;
  if (preset) {
    args.push("-E");
    pattern = preset.pattern;
  } else if (mode === "regex") {
    args.push("-E");
    pattern = opts.query ?? "";
  } else {
    args.push("-F"); // literal text
    pattern = opts.query ?? "";
  }

  for (const dir of opts.excludeDirs ?? DEFAULT_EXCLUDES) {
    args.push(`--exclude-dir=${dir}`);
  }
  for (const glob of opts.excludeFiles ?? []) {
    args.push(`--exclude=${glob}`);
  }
  for (const glob of opts.includeFiles ?? []) {
    args.push(`--include=${glob}`);
  }
  args.push("-e", pattern, safe);
  return args;
}

/** Parse `path:line:text` grep output into per-file groups (bounded). */
export function parseGrepOutput(stdout: string, maxResults: number): ContentSearchResult {
  const byFile = new Map<string, FileMatches>();
  let total = 0;
  let truncated = false;
  const lineRe = /^(.*?):(\d+):(.*)$/;

  for (const raw of stdout.split("\n")) {
    if (!raw) continue;
    if (total >= maxResults) {
      truncated = true;
      break;
    }
    const m = lineRe.exec(raw);
    if (!m) continue;
    const filePath = m[1]!;
    const lineNo = Number(m[2]);
    const text = m[3] ?? "";
    let group = byFile.get(filePath);
    if (!group) {
      group = { path: filePath, name: path.basename(filePath), matches: [] };
      byFile.set(filePath, group);
    }
    if (group.matches.length < MAX_MATCHES_PER_FILE) {
      group.matches.push({ line: lineNo, text: text.slice(0, 1000) });
    }
    total += 1;
  }

  return { files: [...byFile.values()], totalMatches: total, truncated, engine: "grep" };
}

export const contentSearchService = {
  /** Run a recursive content search and return matches grouped by file. */
  async search(executor: Executor, opts: ContentSearchOptions): Promise<ContentSearchResult> {
    const safe = safePath(opts.path);
    const mode = opts.mode ?? "text";
    const needsQuery = mode === "text" || mode === "regex";
    if (needsQuery && !(opts.query ?? "").trim()) {
      return { files: [], totalMatches: 0, truncated: false, engine: "grep" };
    }

    const maxResults = Math.min(opts.maxResults ?? DEFAULT_MAX_RESULTS, MAX_RESULTS_CAP);
    const args = buildGrepArgs(safe, { ...opts, mode });
    // `| head` bounds the output AND masks grep's exit-1-on-no-match (pipeline
    // exit code is head's 0), so exec never sees a "failed" command for an
    // empty result set. Fetch one extra line to detect truncation.
    const cmd = `${quoteCmd("grep", args)} | head -n ${maxResults + 1}`;
    const out = await executor.exec(cmd, { timeoutMs: GREP_TIMEOUT_MS });
    return parseGrepOutput(out.stdout, maxResults);
  },
};
