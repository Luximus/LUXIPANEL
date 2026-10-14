// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Smart cleanup (#11).
 *
 * Scans a directory tree for space hogs and junk, classifying each candidate as
 * `safe` (regenerable — node_modules/vendor/build/cache), `review` (probably
 * deletable but check first — logs, backups, db dumps, heavy images) or `keep`
 * (large but unclassified — manual review). Deletion reuses the normal
 * `DELETE /api/files` endpoint (which snapshots first), so this service is
 * read-only. AI advice is offered from the UI via the assistant seed.
 */

import path from "node:path";
import { quoteArg, type Executor } from "../../../shared/executor/index.js";
import { safePath } from "./filesystem.service.js";

export type CleanupClass = "safe" | "review" | "keep";

export interface CleanupItem {
  path: string;
  name: string;
  kind: "dir" | "file";
  sizeBytes: number;
  classification: CleanupClass;
  reason: string;
  category: string;
}

export interface CleanupResult {
  items: CleanupItem[];
  /** Sum of safe + review sizes (potential reclaim). */
  reclaimableBytes: number;
  truncated: boolean;
}

const SCAN_TIMEOUT_MS = 30_000;
const MAX_ITEMS = 400;
const BIG_FILE_MB = 10;

// Regenerable directory names → category + reason.
const REGEN_DIRS: Record<string, { category: string; reason: string }> = {
  node_modules: { category: "deps", reason: "Dependencias Node — regenerable con npm/pnpm install" },
  vendor: { category: "deps", reason: "Dependencias PHP — regenerable con composer install" },
  ".cache": { category: "cache", reason: "Caché — se regenera sola" },
  __pycache__: { category: "cache", reason: "Caché de Python (bytecode) — se regenera" },
  dist: { category: "build", reason: "Salida de build — regenerable" },
  build: { category: "build", reason: "Salida de build — regenerable" },
  ".next": { category: "build", reason: "Build de Next.js — regenerable" },
  ".output": { category: "build", reason: "Build de Nuxt — regenerable" },
  ".nuxt": { category: "build", reason: "Caché de Nuxt — regenerable" },
};

/**
 * Parse `<size>\t<path>` lines (as emitted by `du -sb` / `find -printf`),
 * skipping blanks and lines without a tab. Size defaults to 0 when unparseable.
 */
function parseSizePathLines(stdout: string): Array<{ sizeBytes: number; path: string }> {
  const out: Array<{ sizeBytes: number; path: string }> = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    out.push({ sizeBytes: Number(line.slice(0, tab)) || 0, path: line.slice(tab + 1) });
  }
  return out;
}

function classifyBigFile(name: string): { classification: CleanupClass; category: string; reason: string } {
  const n = name.toLowerCase();
  if (/\.(sql|dump|sql\.gz)$/.test(n)) return { classification: "review", category: "dump", reason: "Volcado de base de datos" };
  if (/\.(zip|tar|tar\.gz|tgz|rar|7z|bz2)$/.test(n)) return { classification: "review", category: "archive", reason: "Archivo comprimido / backup" };
  if (/\.(log|log\.\d+)$/.test(n)) return { classification: "review", category: "logs", reason: "Log grande" };
  if (/\.(jpg|jpeg|png|gif|webp|bmp|tiff?|psd)$/.test(n)) return { classification: "review", category: "image", reason: "Imagen pesada" };
  return { classification: "keep", category: "other", reason: "Archivo grande — revísalo manualmente" };
}

export const cleanupService = {
  async scan(executor: Executor, target: string): Promise<CleanupResult> {
    const safe = safePath(target);
    const items: CleanupItem[] = [];
    let truncated = false;

    // 1) Regenerable dirs (pruned so we don't descend/double-count), with sizes.
    try {
      const names = Object.keys(REGEN_DIRS);
      const nameExpr = names.map((n) => `-name ${quoteArg(n)}`).join(" -o ");
      const cmd =
        `find ${quoteArg(safe)} -maxdepth 5 -type d \\( ${nameExpr} \\) -prune -print0 2>/dev/null ` +
        `| xargs -0 du -sb 2>/dev/null | head -n 200`;
      const out = await executor.exec(cmd, { timeoutMs: SCAN_TIMEOUT_MS });
      for (const { sizeBytes, path: p } of parseSizePathLines(out.stdout)) {
        const base = path.posix.basename(p);
        const meta = REGEN_DIRS[base];
        if (!meta) continue;
        items.push({ path: p, name: base, kind: "dir", sizeBytes, classification: "safe", reason: meta.reason, category: meta.category });
        if (items.length >= MAX_ITEMS) { truncated = true; break; }
      }
    } catch { /* non-fatal */ }

    // 2) Big files (outside the regenerable dirs we already counted).
    if (items.length < MAX_ITEMS) {
      try {
        const cmd =
          `find ${quoteArg(safe)} -type f -size +${BIG_FILE_MB}M ` +
          `-not -path '*/node_modules/*' -not -path '*/vendor/*' -not -path '*/.cache/*' ` +
          `-printf '%s\\t%p\\n' 2>/dev/null | sort -rn | head -n ${MAX_ITEMS - items.length}`;
        const out = await executor.exec(cmd, { timeoutMs: SCAN_TIMEOUT_MS });
        for (const { sizeBytes, path: p } of parseSizePathLines(out.stdout)) {
          const name = path.posix.basename(p);
          const cls = classifyBigFile(name);
          items.push({ path: p, name, kind: "file", sizeBytes, classification: cls.classification, reason: cls.reason, category: cls.category });
          if (items.length >= MAX_ITEMS) { truncated = true; break; }
        }
      } catch { /* non-fatal */ }
    }

    const order: Record<CleanupClass, number> = { safe: 0, review: 1, keep: 2 };
    items.sort((a, b) => (order[a.classification] - order[b.classification]) || (b.sizeBytes - a.sizeBytes));
    const reclaimableBytes = items
      .filter((i) => i.classification !== "keep")
      .reduce((sum, i) => sum + i.sizeBytes, 0);
    return { items, reclaimableBytes, truncated };
  },
};
