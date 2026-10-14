// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Notifications repository — file-backed via dataStore.
 *
 * Layout on the connected server:
 *   ${NOTIFICATIONS_DIR}/notifications.json
 *
 * `NOTIFICATIONS_DIR` is set in the panel `.env`; when unset it falls back
 * to `${LUXIPANEL_CONFIG_DIR}/notifications`.
 *
 * The repo intentionally trims older entries on insert so the JSON file
 * cannot grow without bound on a long-lived install. The cap is high
 * enough (5 000) that filters/pagination still feel "complete" to admins.
 */

import { dataStore } from "../../../shared/data-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type {
  Notification,
  NewNotification,
  NotificationSource,
} from "../models/notification.model.js";

const MODULE = "notifications";
const COLLECTION = "notifications";
const MAX_ROWS = 5000;
// Only run the (whole-collection) trim every N inserts instead of on every
// single row: a chatty install would otherwise pay a full list + per-row
// rewrite for each notification. Process-local counter — the file can drift up
// to MAX_ROWS + TRIM_EVERY between trims, which is harmless.
const TRIM_EVERY = 50;
let _insertsSinceTrim = 0;

function store(executor?: Executor | null) {
  return dataStore<Notification>(executor, MODULE, COLLECTION, {
    idStrategy: "uuid",
    // dataStore writes its own createdAt/updatedAt — we want to control
    // createdAt explicitly so SSE consumers always agree with the
    // persisted ordering. Disabling auto-timestamps lets the service set
    // them once.
    timestamps: false,
  });
}

/**
 * Ownership match for bulk ops: a `null` `userId` matches everything (global
 * scope); otherwise a row belongs to the user when it is global (`userId ===
 * null`) or owned by that user.
 */
function matchesUser(row: Notification, userId: number | null): boolean {
  return userId === null || row.userId === null || row.userId === userId;
}
function visibleFor(row: Notification, userId: number | null): boolean {
  return matchesUser(row, userId) && (userId === null || row.userId !== null || !(row.hiddenBy ?? []).includes(userId));
}
function readFor(row: Notification, userId: number | null): boolean {
  return row.read || (userId !== null && row.userId === null && (row.readBy ?? []).includes(userId));
}

/** Newest-first comparator on the ISO `createdAt` string. */
function byCreatedAtDesc(a: Notification, b: Notification): number {
  return b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0;
}

export interface ListFilters {
  /** Restrict to a single user (null = global only, undefined = both). */
  userId?: number | null;
  /** Only unread rows when true. */
  unreadOnly?: boolean;
  /** Restrict by source bucket. */
  source?: NotificationSource | "all";
  /** Restrict by free-form module string. */
  module?: string;
  /** 1-based page (default 1). */
  page?: number;
  /** Page size — clamped to [1, 100]. */
  pageSize?: number;
}

export interface PagedNotifications {
  data: Notification[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
}

export const notificationsRepository = {
  async create(entry: NewNotification & { id?: string }, executor?: Executor | null): Promise<Notification> {
    const now = new Date().toISOString();
    // Solo fijar `id` cuando el llamante lo aporta: `""` cuenta como id explícito
    // para dataStore (`data.id !== undefined`) y la fila nacía SIN uuid → no
    // clicable ni marcable como leída (bug detectado 2026-08-26).
    const row: Omit<Notification, "id"> & { id?: string } = {
      ...(entry.id ? { id: entry.id } : {}),
      source: entry.source,
      module: entry.module ?? null,
      severity: entry.severity ?? "info",
      title: entry.title,
      message: entry.message,
      link: entry.link ?? null,
      target: entry.target ?? null,
      userId: entry.userId ?? null,
      read: false,
      readAt: null,
      createdAt: now,
      metadata: entry.metadata ?? null,
    };
    // `id` opcional: dataStore (idStrategy uuid) lo genera cuando falta.
    const created = await store(executor).create(row as Notification);
    // Trim only every N inserts — keeps the JSON file size predictable on
    // chatty installs (e.g. many SSL renewals + auth events) without paying a
    // full list + rewrite for every single row.
    if (++_insertsSinceTrim >= TRIM_EVERY) {
      _insertsSinceTrim = 0;
      await this.trim(MAX_ROWS, executor);
    }
    return created as Notification;
  },

  /** Read a single notification by id (null if missing). */
  async get(id: string, executor?: Executor | null): Promise<Notification | null> {
    return (await store(executor).get(id)) as Notification | null;
  },

  async list(filters: ListFilters, executor?: Executor | null): Promise<PagedNotifications> {
    const all = await store(executor).list();
    const visible = all.filter((row) => {
      if (filters.userId !== undefined) {
        if (filters.userId === null && row.userId !== null) return false;
        if (filters.userId !== null && row.userId !== null && row.userId !== filters.userId) return false;
        if (filters.userId !== null && row.userId === null && (row.hiddenBy ?? []).includes(filters.userId)) return false;
      }
      if (filters.source && filters.source !== "all" && row.source !== filters.source) return false;
      if (filters.module && row.module !== filters.module) return false;
      if (filters.unreadOnly && readFor(row, filters.userId ?? null)) return false;
      return true;
    });

    const sorted = visible.sort(byCreatedAtDesc);
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const total = sorted.length;
    const data = sorted.slice(offset, offset + pageSize).map((row) => ({ ...row, read: readFor(row, filters.userId ?? null) }));
    const scopedUnread = sorted.reduce((acc, row) => acc + (readFor(row, filters.userId ?? null) ? 0 : 1), 0);
    return { data, total, unread: scopedUnread, page, pageSize };
  },

  async unreadCount(userId: number | null, executor?: Executor | null): Promise<number> {
    const all = await store(executor).list();
    // `userId === null` ⇒ global count (matchesUser is always true).
    return all.filter((row) => visibleFor(row, userId) && !readFor(row, userId)).length;
  },

  async markReadForUser(id: string, userId: number, executor?: Executor | null): Promise<Notification | null> {
    return store(executor).transaction(async (current) => {
      const row = current[id];
      if (!row || !visibleFor(row, userId)) return { next: current, result: null };
      const next = row.userId === null
        ? { ...row, readBy: [...new Set([...(row.readBy ?? []), userId])] }
        : { ...row, read: true, readAt: new Date().toISOString() };
      current[id] = next;
      return { next: current, result: { ...next, read: true } };
    });
  },

  async markRead(id: string, executor?: Executor | null): Promise<Notification | null> {
    const updated = await store(executor).update(id, {
      read: true,
      readAt: new Date().toISOString(),
    });
    return (updated as Notification | null) ?? null;
  },

  async markAllRead(userId: number | null, executor?: Executor | null): Promise<number> {
    return store(executor).transaction(async (current) => {
      const now = new Date().toISOString();
      let changed = 0;
      const next: Record<string, Notification> = {};
      for (const [key, row] of Object.entries(current)) {
        if (!readFor(row, userId) && visibleFor(row, userId)) {
          next[key] = row.userId === null && userId !== null
            ? { ...row, readBy: [...new Set([...(row.readBy ?? []), userId])] }
            : { ...row, read: true, readAt: now } as Notification;
          changed++;
        } else {
          next[key] = row as Notification;
        }
      }
      return { next, result: changed };
    });
  },

  async delete(id: string, executor?: Executor | null): Promise<boolean> {
    return store(executor).delete(id);
  },

  async deleteForUser(id: string, userId: number, executor?: Executor | null): Promise<boolean> {
    return store(executor).transaction(async (current) => {
      const row = current[id];
      if (!row || !visibleFor(row, userId)) return { next: current, result: false };
      if (row.userId === null) current[id] = { ...row, hiddenBy: [...new Set([...(row.hiddenBy ?? []), userId])] };
      else delete current[id];
      return { next: current, result: true };
    });
  },

  async deleteAll(userId: number | null, executor?: Executor | null): Promise<number> {
    return store(executor).transaction(async (current) => {
      const next: Record<string, Notification> = {};
      let removed = 0;
      for (const [key, row] of Object.entries(current)) {
        if (visibleFor(row, userId)) {
          removed++;
          if (row.userId === null && userId !== null) {
            next[key] = { ...row, hiddenBy: [...new Set([...(row.hiddenBy ?? []), userId])] };
          }
          continue;
        }
        next[key] = row as Notification;
      }
      return { next, result: removed };
    });
  },

  /** Keep at most `max` newest rows so the JSON sidecar never explodes.
   *  Runs as a single transaction — one read + one rewrite — instead of a
   *  per-overflow-row delete (each of which rewrote the whole sidecar). */
  async trim(max: number, executor?: Executor | null): Promise<void> {
    await store(executor).transaction(async (current) => {
      const rows = Object.values(current) as Notification[];
      if (rows.length <= max) return { next: current, result: undefined };
      const keep = new Set(rows.sort(byCreatedAtDesc).slice(0, max).map((r) => r.id));
      const next: Record<string, Notification> = {};
      for (const [key, row] of Object.entries(current)) {
        if (keep.has((row as Notification).id)) next[key] = row as Notification;
      }
      return { next, result: undefined };
    });
  },
};
