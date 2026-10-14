// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-file metadata — tags (#23) + internal comment (#24).
 *
 * Lightweight, team-oriented metadata keyed by absolute path, stored in the
 * per-server sidecar (`files/file-meta.json`) via dataStore. No filesystem
 * mutation — purely panel-side annotations. An entry with no tags and no
 * comment is removed (keeps the sidecar tidy).
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import { safePath } from "./filesystem.service.js";
import type { Executor } from "../../../shared/executor/index.js";

export interface FileMeta {
  /** Absolute path (also the record id). */
  id: string;
  path: string;
  tags: string[];
  comment: string;
  updatedAt?: string;
}

const MAX_TAGS = 20;
const MAX_TAG_LEN = 40;
const MAX_COMMENT = 2000;

const store = makeKvStore<FileMeta>({ module: "files", collection: "file-meta" });

function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  for (const t of tags) {
    const s = String(t ?? "").trim().slice(0, MAX_TAG_LEN);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export const fileMetaService = {
  /** Metadata for a path (empty record when none). */
  async get(executor: Executor, path: string): Promise<FileMeta> {
    const safe = safePath(path);
    const rec = await store(executor).get(safe);
    return rec ?? { id: safe, path: safe, tags: [], comment: "" };
  },

  /** Upsert tags + comment. Deletes the entry when both are empty. */
  async set(executor: Executor, path: string, tags: unknown, comment: unknown): Promise<FileMeta> {
    const safe = safePath(path);
    const cleanTagList = cleanTags(tags);
    const cleanComment = String(comment ?? "").slice(0, MAX_COMMENT);
    const s = store(executor);
    if (cleanTagList.length === 0 && !cleanComment.trim()) {
      await s.delete(safe);
      return { id: safe, path: safe, tags: [], comment: "" };
    }
    return s.set(safe, { id: safe, path: safe, tags: cleanTagList, comment: cleanComment });
  },

  /** All annotated files (for the "tagged files" overview). */
  async listAll(executor: Executor): Promise<FileMeta[]> {
    const all = await store(executor).list();
    return all.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  },
};
