// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Messages repository — one collection PER conversation so a busy room never
 * grows a single giant JSON file:
 *
 *   ${LUXIPANEL_CONFIG_DIR}/chat/messages_<convId>.json
 *
 * The collection is trimmed on insert to the newest MAX_ROWS so the sidecar
 * stays bounded on a long-lived install.
 */

import { createHash } from "node:crypto";
import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { ChatMessage } from "../models/chat.model.js";

const MODULE = "chat";
const MAX_ROWS = 1000;

function collectionFor(convId: string): string {
  const safe = convId.replace(/[^A-Za-z0-9._-]/g, "_");
  const name = `messages_${safe}`;
  // kv-store's `safe()` truncates collection names to 64 chars, so two long
  // convIds sharing their first ~52 chars would collapse into the same sidecar.
  // Short names (the common case) keep their existing filename for backward
  // compatibility; only over-long names get a stable hash suffix that stays
  // within 64 chars and stays unique.
  if (name.length <= 64) return name;
  const hash = createHash("sha256").update(convId).digest("hex").slice(0, 16);
  return `messages_${safe.slice(0, 38)}_${hash}`; // 9 + 38 + 1 + 16 = 64
}

function store(executor: Executor | null | undefined, convId: string) {
  return dataStore<ChatMessage>(executor, MODULE, collectionFor(convId), {
    idStrategy: "uuid",
    timestamps: false,
  });
}

/** Oldest-first comparator on the ISO `createdAt` string. */
function byCreatedAtAsc(a: ChatMessage, b: ChatMessage): number {
  return a.createdAt > b.createdAt ? 1 : a.createdAt < b.createdAt ? -1 : 0;
}

export const messagesRepository = {
  async create(executor: Executor, convId: string, msg: ChatMessage): Promise<ChatMessage> {
    const created = (await store(executor, convId).create(msg)) as ChatMessage;
    await this.trim(executor, convId);
    return created;
  },

  async get(executor: Executor | null | undefined, convId: string, id: string): Promise<ChatMessage | null> {
    return (await store(executor, convId).get(id)) as ChatMessage | null;
  },

  async update(
    executor: Executor,
    convId: string,
    id: string,
    patch: Partial<ChatMessage>,
  ): Promise<ChatMessage | null> {
    return (await store(executor, convId).update(id, patch)) as ChatMessage | null;
  },

  /**
   * Newest-first page. When `before` (an ISO createdAt) is given, only rows
   * strictly older than it are returned — a simple cursor for "load earlier".
   */
  async list(
    executor: Executor | null | undefined,
    convId: string,
    opts: { before?: string; limit?: number } = {},
  ): Promise<ChatMessage[]> {
    const all = (await store(executor, convId).list()).sort(byCreatedAtAsc);
    const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
    const filtered = opts.before ? all.filter((m) => m.createdAt < opts.before!) : all;
    // Return the LAST `limit` rows in chronological order (the tail of the thread).
    return filtered.slice(Math.max(0, filtered.length - limit));
  },

  /**
   * EVERY message of a conversation, oldest-first and uncapped — unlike
   * `list()` (a 200-row page), the media drawer must see the whole history to
   * build the attachment index.
   */
  async listAll(executor: Executor | null | undefined, convId: string): Promise<ChatMessage[]> {
    return (await store(executor, convId).list()).sort(byCreatedAtAsc);
  },

  async deleteCollection(executor: Executor, convId: string): Promise<void> {
    // Single read-modify-write clearing every row, instead of K read+write
    // cycles of the whole JSON (one per deleted row).
    await store(executor, convId).transaction(async () => ({ next: {}, result: undefined }));
  },

  /** Keep at most MAX_ROWS newest rows. */
  async trim(executor: Executor, convId: string): Promise<void> {
    // One read-modify-write drops ALL overflow rows at once instead of K
    // separate whole-file rewrites under the per-collection lock.
    await store(executor, convId).transaction(async (current) => {
      const entries = Object.entries(current).sort((a, b) => byCreatedAtAsc(a[1], b[1]));
      if (entries.length <= MAX_ROWS) return { next: current, result: undefined };
      const overflow = entries.slice(0, entries.length - MAX_ROWS);
      const next = { ...current };
      for (const [key] of overflow) delete next[key];
      return { next, result: undefined };
    });
  },
};
