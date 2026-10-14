// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Mass replace with preview (#10) — find/replace across a directory tree.
 *
 * Built on the content-search engine (candidate file discovery via grep) and
 * the snapshot engine (a mini-backup is captured before every file is written,
 * so "Aplicar" is always reversible from the change history).
 *
 * Matching is line-scoped with a JS RegExp so the preview and the apply use
 * IDENTICAL semantics (grep only prunes which files to read). Multiline
 * patterns are out of scope — migrations (domains, paths, endpoints, app names)
 * are line-local.
 */

import path from "node:path";
import type { Executor } from "../../../shared/executor/index.js";
import { invalidateDir, invalidateFile, invalidateStat } from "../../../shared/files-cache/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { contentSearchService } from "./content-search.service.js";
import { snapshotService } from "./snapshot.service.js";

export type ReplaceMode = "text" | "regex";

export interface ReplaceLine {
  line: number;
  before: string;
  after: string;
}

export interface FileReplacements {
  path: string;
  name: string;
  replacements: ReplaceLine[];
}

export interface ReplacePreview {
  files: FileReplacements[];
  totalReplacements: number;
  /** True when the candidate-file or per-file cap trimmed the result. */
  truncated: boolean;
}

export interface ReplaceApplyResult {
  filesChanged: number;
  totalReplacements: number;
  truncated: boolean;
}

export interface ReplaceOptions {
  path: string;
  search: string;
  replacement: string;
  mode?: ReplaceMode;
  caseSensitive?: boolean;
  /** Cap on files processed (preview reads each one). */
  maxFiles?: number;
}

const DEFAULT_MAX_FILES = 100;
const MAX_FILES_CAP = 500;
const MAX_LINES_PER_FILE = 200;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MAX_REGEX_PATTERN_LEN = 1000;

/**
 * Reject user-supplied regex patterns that are trivially catastrophic. The
 * replace engine runs the pattern against every line of up to 500 files,
 * synchronously on the panel's event loop, so a backtracking bomb (`(a+)+`,
 * `([a-z]*)*`, `(.+)+$`, …) would hang the whole backend. Node has no built-in
 * regex timeout, so we validate the pattern up front:
 *   • bound its length, and
 *   • reject nested unbounded quantifiers (a group containing `*`/`+`/`{n,}`
 *     that is itself quantified with `*`/`+`/`{n,}`) — the classic exponential
 *     ReDoS shape.
 */
function assertSafeUserRegex(pattern: string): void {
  if (pattern.length > MAX_REGEX_PATTERN_LEN) {
    throw new ValidationError(`El patrón de búsqueda es demasiado largo (máx. ${MAX_REGEX_PATTERN_LEN} caracteres).`);
  }
  // A parenthesised subexpression that contains an unbounded quantifier and is
  // itself immediately followed by an unbounded quantifier.
  if (/\([^()]*(?:[*+]|\{\d+,\})[^()]*\)(?:[*+]|\{\d+,\})/.test(pattern)) {
    throw new ValidationError(
      "El patrón contiene cuantificadores anidados que pueden causar retroceso catastrófico. Simplifícalo.",
    );
  }
}

/** Build the line matcher shared by preview and apply (preview === apply). */
export function buildMatcher(opts: ReplaceOptions): { re: RegExp } {
  const flags = "g" + (opts.caseSensitive ? "" : "i");
  if (opts.mode === "regex") {
    assertSafeUserRegex(opts.search);
    try {
      return { re: new RegExp(opts.search, flags) };
    } catch (err) {
      throw new ValidationError(`Expresión regular inválida: ${(err as Error).message}`);
    }
  }
  return { re: new RegExp(escapeRegExp(opts.search), flags) };
}

/**
 * Apply the replacement to one line. Returns the new line and match count.
 * The replacement string keeps native `$1`/`$&` backref handling (String.replace).
 */
export function replaceLine(line: string, re: RegExp, replacement: string): { after: string; count: number } {
  re.lastIndex = 0;
  const matches = line.match(re);
  const count = matches ? matches.length : 0;
  if (count === 0) return { after: line, count: 0 };
  re.lastIndex = 0;
  return { after: line.replace(re, replacement), count };
}

async function candidateFiles(executor: Executor, opts: ReplaceOptions, maxFiles: number): Promise<{ paths: string[]; truncated: boolean }> {
  const search = await contentSearchService.search(executor, {
    path: opts.path,
    query: opts.search,
    mode: opts.mode ?? "text",
    caseSensitive: opts.caseSensitive,
    maxResults: 5000,
  });
  const paths = search.files.map((f) => f.path);
  return { paths: paths.slice(0, maxFiles), truncated: search.truncated || paths.length > maxFiles };
}

async function readText(executor: Executor, filePath: string): Promise<string> {
  const raw = await executor.readFile(filePath, "utf-8");
  return typeof raw === "string" ? raw : raw.toString("utf-8");
}

export const replaceService = {
  /** Compute a per-line before/after preview without writing anything. */
  async preview(executor: Executor, opts: ReplaceOptions): Promise<ReplacePreview> {
    if (!opts.search) return { files: [], totalReplacements: 0, truncated: false };
    const maxFiles = Math.min(opts.maxFiles ?? DEFAULT_MAX_FILES, MAX_FILES_CAP);
    const { paths, truncated } = await candidateFiles(executor, opts, maxFiles);
    const { re } = buildMatcher(opts);

    const files: FileReplacements[] = [];
    let total = 0;
    for (const filePath of paths) {
      let content: string;
      try {
        content = await readText(executor, filePath);
      } catch {
        continue;
      }
      const lines = content.split("\n");
      const reps: ReplaceLine[] = [];
      for (let i = 0; i < lines.length; i++) {
        const { after, count } = replaceLine(lines[i]!, re, opts.replacement);
        if (count > 0) {
          total += count;
          if (reps.length < MAX_LINES_PER_FILE) {
            reps.push({ line: i + 1, before: lines[i]!.slice(0, 1000), after: after.slice(0, 1000) });
          }
        }
      }
      if (reps.length > 0) files.push({ path: filePath, name: path.basename(filePath), replacements: reps });
    }
    return { files, totalReplacements: total, truncated };
  },

  /** Apply the replacement, snapshotting each file before it is rewritten. */
  async apply(executor: Executor, opts: ReplaceOptions): Promise<ReplaceApplyResult> {
    if (!opts.search) return { filesChanged: 0, totalReplacements: 0, truncated: false };
    const maxFiles = Math.min(opts.maxFiles ?? DEFAULT_MAX_FILES, MAX_FILES_CAP);
    const { paths, truncated } = await candidateFiles(executor, opts, maxFiles);
    const { re } = buildMatcher(opts);

    let filesChanged = 0;
    let total = 0;
    for (const filePath of paths) {
      let content: string;
      try {
        content = await readText(executor, filePath);
      } catch {
        continue;
      }
      const lines = content.split("\n");
      let fileCount = 0;
      const newLines = lines.map((line) => {
        const { after, count } = replaceLine(line, re, opts.replacement);
        fileCount += count;
        return after;
      });
      if (fileCount === 0) continue;
      const newContent = newLines.join("\n");
      if (newContent === content) continue;
      // Safe-changes: capture the pre-replace state before overwriting.
      await snapshotService.capture(executor, filePath, "replace");
      await executor.writeFile(filePath, newContent, { encoding: "utf-8" });
      void invalidateDir(executor, filePath);
      void invalidateFile(executor, filePath);
      void invalidateStat(executor, filePath);
      filesChanged += 1;
      total += fileCount;
    }
    return { filesChanged, totalReplacements: total, truncated };
  },
};
