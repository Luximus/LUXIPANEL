// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-file version history (#8).
 *
 * Merges two timelines for a single file:
 *   • Git commits (when the file lives in a repo) via `git log --follow`.
 *   • LUXIPANEL snapshots (the safe-changes mini-backups) for that exact path.
 *
 * Read-only here: the frontend reuses existing endpoints to act on an entry —
 * snapshot diff/restore/download (`/api/files/snapshots/:id/*`) and, for git
 * revisions, `git-show` content fed into the Monaco diff + a normal write
 * (which itself snapshots) to restore.
 */

import path from "node:path";
import type { Executor } from "../../../shared/executor/index.js";
import { gitCmd } from "../../../shared/system/git-cmd.js";
import { dirOf } from "../../../shared/utils/posix-path.js";
import { safePath } from "./filesystem.service.js";
// B-13: `gitRoot` used to be duplicated here WITHOUT the `safePath(top)`
// re-sandbox, so a repo rooted outside ALLOWED_BASES that merely contains an
// allowed subdir would still be walked. The canonical (safe) one is reused.
import { gitRoot } from "./git.service.js";
import { snapshotService } from "./snapshot.service.js";
import type { SnapshotOp } from "../models/snapshot.model.js";

export type HistorySource = "git" | "snapshot";

export interface HistoryEntry {
  source: HistorySource;
  /** ISO timestamp used for the merged ordering. */
  date: string;
  label: string;
  author?: string;
  /** Git commit subject. */
  subject?: string;
  /** Git commit hash (full). */
  rev?: string;
  /** Snapshot id (for the snapshot endpoints). */
  snapshotId?: string;
  /** Snapshot kind (file/dir/absent/skipped). */
  kind?: string;
}

export interface FileHistory {
  entries: HistoryEntry[];
  gitRoot: string | null;
  relPath: string | null;
}

const GIT_LOG_LIMIT = 50;
// Accept either a hex commit SHA (history entries) or a symbolic `HEAD`
// reference with optional `~N`/`^N` ancestry suffixes (the diff baseline the
// assistant/Files editor requests with rev="HEAD"). Without `HEAD` here,
// gitShow throws "Revisión inválida" for every diff → the caller falls back to
// an empty baseline and the whole file renders as added.
const REV_RE = /^(?:HEAD(?:[~^]\d*)*|[0-9a-f]{7,40})$/i;

const OP_LABELS: Record<SnapshotOp, string> = {
  edit: "Edición (snapshot)",
  delete: "Borrado (snapshot)",
  move: "Movido (snapshot)",
  replace: "Reemplazo (snapshot)",
  copy: "Copia (snapshot)",
  chmod: "Permisos (snapshot)",
  restore: "Restauración (snapshot)",
};


/** Path of `safe` relative to git work-tree `root`, or just its basename. */
function relTo(root: string, safe: string): string {
  const top = root.replace(/\/+$/, "");
  return safe.startsWith(top + "/") ? safe.slice(top.length + 1) : path.posix.basename(safe);
}


export const fileHistoryService = {
  async history(executor: Executor, filePath: string): Promise<FileHistory> {
    const safe = safePath(filePath);

    // Snapshots for this exact path.
    const snaps = await snapshotService.list(executor, safe);
    const entries: HistoryEntry[] = snaps.map((s) => ({
      source: "snapshot" as const,
      date: s.capturedAt,
      label: OP_LABELS[s.op] ?? s.op,
      snapshotId: s.id,
      kind: s.kind,
    }));

    // Git history (best effort).
    const root = await gitRoot(executor, dirOf(safe));
    let rel: string | null = null;
    if (root) {
      rel = relTo(root, safe);
      try {
        const out = await executor.exec(
          gitCmd(["-C", root, "log", "--follow", `-n${GIT_LOG_LIMIT}`, "--format=%H|%aI|%an|%s", "--", rel]),
          { timeoutMs: 12_000 },
        );
        for (const line of out.stdout.split("\n")) {
          if (!line.trim()) continue;
          const parts = line.split("|");
          if (parts.length < 4) continue;
          const rev = parts[0]!;
          const date = parts[1]!;
          const author = parts[2]!;
          const subject = parts.slice(3).join("|");
          entries.push({ source: "git", date, label: "Commit", author, subject, rev });
        }
      } catch {
        /* not fatal */
      }
    }

    entries.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return { entries, gitRoot: root, relPath: rel };
  },

  /** Content of a file at a git revision (for diff/restore). */
  async gitShow(executor: Executor, filePath: string, rev: string): Promise<string> {
    if (!REV_RE.test(rev)) throw new Error("Revisión inválida");
    const safe = safePath(filePath);
    const root = await gitRoot(executor, dirOf(safe));
    if (!root) throw new Error("El archivo no está en un repositorio Git");
    const rel = relTo(root, safe);
    const out = await executor.exec(gitCmd(["-C", root, "show", `${rev}:${rel}`]), { timeoutMs: 12_000 });
    if (out.exitCode !== 0) {
      // Distinguish "the file simply does not exist at this revision" (a newly
      // created file → empty baseline is correct, the whole file IS new) from a
      // genuine failure on a tracked file (timeout, lock, permission). Only the
      // former should yield an empty baseline; throwing on the latter lets the
      // caller fall back to the plain editor instead of a bogus all-added diff.
      const exists = await executor.exec(gitCmd(["-C", root, "cat-file", "-e", `${rev}:${rel}`]), { timeoutMs: 8_000 });
      if (exists.exitCode !== 0) return "";
      throw new Error("No se pudo leer esa versión del archivo");
    }
    return out.stdout;
  },
};
