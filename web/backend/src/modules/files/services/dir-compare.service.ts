// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Folder comparison (#6) — diff two directory trees by content hash.
 *
 * Useful for staging↔production: lists files that are new / modified / removed
 * between two roots (and counts the identical ones). Hashing runs on the client
 * server via `find … | xargs sha256sum`, so it works on any tree the executor
 * can reach. The visual diff (#6 "Ver diferencias") and the copy actions are
 * done client-side by reusing `/api/files/read` and `/api/files/copy`.
 */

import path from "node:path";
import { quoteArg, type Executor } from "../../../shared/executor/index.js";
import { safePath } from "./filesystem.service.js";

export type CompareStatus = "added" | "removed" | "modified";

export interface CompareEntry {
  /** Path relative to the compared roots. */
  path: string;
  status: CompareStatus;
  /** Absolute path on the `from` (base) side. */
  fromPath: string;
  /** Absolute path on the `to` (other) side. */
  toPath: string;
}

export interface CompareResult {
  entries: CompareEntry[];
  counts: { added: number; removed: number; modified: number; same: number };
  truncated: boolean;
}

const HASH_TIMEOUT_MS = 30_000;
const MAX_FILES = 20_000;
const MAX_ENTRIES = 3_000;

/** sha256 of every file under `dir` → Map<relativePath, hash>. */
async function hashTree(executor: Executor, dir: string): Promise<Map<string, string>> {
  // `find … -print0 | xargs -0 sha256sum` → "<hash>  <abs path>" per line.
  // Prune VCS/dependency dirs; head bounds the output.
  const cmd =
    `find ${quoteArg(dir)} -type f ` +
    `-not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/vendor/*' ` +
    `-print0 2>/dev/null | xargs -0 sha256sum 2>/dev/null | head -n ${MAX_FILES}`;
  const out = await executor.exec(cmd, { timeoutMs: HASH_TIMEOUT_MS });
  const map = new Map<string, string>();
  const prefix = dir.replace(/\/+$/, "") + "/";
  for (const line of out.stdout.split("\n")) {
    if (!line) continue;
    const sep = line.indexOf("  ");
    if (sep < 0) continue;
    const hash = line.slice(0, sep);
    const abs = line.slice(sep + 2);
    const rel = abs.startsWith(prefix) ? abs.slice(prefix.length) : abs;
    if (rel) map.set(rel, hash);
  }
  return map;
}

export const dirCompareService = {
  async compare(executor: Executor, fromDir: string, toDir: string): Promise<CompareResult> {
    const from = safePath(fromDir);
    const to = safePath(toDir);
    const [left, right] = await Promise.all([hashTree(executor, from), hashTree(executor, to)]);

    const entries: CompareEntry[] = [];
    const counts = { added: 0, removed: 0, modified: 0, same: 0 };
    const rels = new Set<string>([...left.keys(), ...right.keys()]);

    for (const rel of rels) {
      const l = left.get(rel);
      const r = right.get(rel);
      const fromPath = path.posix.join(from, rel);
      const toPath = path.posix.join(to, rel);
      if (l !== undefined && r !== undefined) {
        if (l === r) { counts.same += 1; continue; }
        counts.modified += 1;
        if (entries.length < MAX_ENTRIES) entries.push({ path: rel, status: "modified", fromPath, toPath });
      } else if (l !== undefined) {
        counts.removed += 1; // only in `from`
        if (entries.length < MAX_ENTRIES) entries.push({ path: rel, status: "removed", fromPath, toPath });
      } else {
        counts.added += 1; // only in `to`
        if (entries.length < MAX_ENTRIES) entries.push({ path: rel, status: "added", fromPath, toPath });
      }
    }

    const order: Record<CompareStatus, number> = { modified: 0, added: 1, removed: 2 };
    entries.sort((a, b) => (order[a.status] - order[b.status]) || a.path.localeCompare(b.path));
    const truncated = counts.added + counts.removed + counts.modified > entries.length;
    return { entries, counts, truncated };
  },
};
