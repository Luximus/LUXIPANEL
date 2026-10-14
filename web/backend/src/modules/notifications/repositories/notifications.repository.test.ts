// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization — the notifications repository over an in-memory dataStore.
 * Locks the observable contract the bell depends on: create defaults, list
 * filtering (source / module / unreadOnly) + user scoping + newest-first
 * pagination, unread counting, mark-read / mark-all-read, delete / delete-all,
 * and the insert-time trim that caps the sidecar size.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const rows = new Map<string, Record<string, unknown>>();
let idSeq = 0;

vi.mock("../../../shared/data-store/index.js", () => ({
  dataStore: () => ({
    async list() {
      return [...rows.values()];
    },
    async create(row: Record<string, unknown>) {
      const id = (row.id as string) || `id${++idSeq}`;
      const r = { ...row, id };
      rows.set(id, r);
      return r;
    },
    async update(id: string, patch: Record<string, unknown>) {
      const cur = rows.get(id);
      if (!cur) return null;
      const r = { ...cur, ...patch };
      rows.set(id, r);
      return r;
    },
    async delete(id: string) {
      return rows.delete(id);
    },
    async transaction(fn: (current: Record<string, unknown>) => Promise<{ next: Record<string, unknown>; result: unknown }>) {
      const current = Object.fromEntries(rows);
      const { next, result } = await fn(current);
      rows.clear();
      for (const [k, v] of Object.entries(next)) rows.set(k, v as Record<string, unknown>);
      return result;
    },
  }),
}));

import { notificationsRepository } from "./notifications.repository.js";
import type { NewNotification } from "../models/notification.model.js";

function base(overrides: Partial<NewNotification> = {}): NewNotification {
  return { source: "system", title: "t", message: "m", ...overrides };
}

/** Create with a controlled createdAt via fake timers so ordering is deterministic. */
async function createAt(iso: string, entry: Partial<NewNotification>) {
  vi.setSystemTime(new Date(iso));
  return notificationsRepository.create(base(entry));
}

beforeEach(() => {
  rows.clear();
  idSeq = 0;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("create — defaults", () => {
  it("fills severity=info, read=false, null module/link/userId/metadata", async () => {
    const row = await notificationsRepository.create(base({ title: "hi", message: "yo" }));
    expect(row).toMatchObject({
      severity: "info",
      read: false,
      readAt: null,
      module: null,
      link: null,
      userId: null,
      metadata: null,
    });
    expect(row.id).toBeTruthy();
    expect(typeof row.createdAt).toBe("string");
  });
});

describe("list — filtering + scoping + pagination", () => {
  beforeEach(async () => {
    await createAt("2026-01-01T00:00:01Z", { source: "system", module: "monitor", title: "a" });
    await createAt("2026-01-01T00:00:02Z", { source: "module", module: "mail", title: "b" });
    await createAt("2026-01-01T00:00:03Z", { source: "security", module: "auth", title: "c", userId: 42 });
  });

  it("filters by source", async () => {
    const { data, total } = await notificationsRepository.list({ source: "module" });
    expect(total).toBe(1);
    expect(data[0].title).toBe("b");
  });

  it("source 'all' is a no-op filter", async () => {
    const { total } = await notificationsRepository.list({ source: "all" });
    expect(total).toBe(3);
  });

  it("filters by module", async () => {
    const { data } = await notificationsRepository.list({ module: "auth" });
    expect(data.map((d) => d.title)).toEqual(["c"]);
  });

  it("userId=null returns only global rows (excludes the user-targeted one)", async () => {
    const { data } = await notificationsRepository.list({ userId: null });
    expect(data.map((d) => d.title).sort()).toEqual(["a", "b"]);
  });

  it("userId=42 returns global + that user's rows", async () => {
    const { data } = await notificationsRepository.list({ userId: 42 });
    expect(data.map((d) => d.title).sort()).toEqual(["a", "b", "c"]);
  });

  it("sorts newest-first and paginates", async () => {
    const page1 = await notificationsRepository.list({ page: 1, pageSize: 2 });
    expect(page1.data.map((d) => d.title)).toEqual(["c", "b"]);
    expect(page1.total).toBe(3);
    const page2 = await notificationsRepository.list({ page: 2, pageSize: 2 });
    expect(page2.data.map((d) => d.title)).toEqual(["a"]);
  });

  it("unreadOnly hides read rows and unread count reflects state", async () => {
    const all = await notificationsRepository.list({});
    await notificationsRepository.markRead(all.data[0].id);
    const res = await notificationsRepository.list({ unreadOnly: true });
    expect(res.total).toBe(2);
    expect(res.unread).toBe(2);
  });
});

describe("unreadCount — matchesUser", () => {
  it("global count ignores ownership; per-user count = global + own unread", async () => {
    await createAt("2026-01-01T00:00:01Z", { title: "g" });
    await createAt("2026-01-01T00:00:02Z", { title: "u42", userId: 42 });
    await createAt("2026-01-01T00:00:03Z", { title: "u7", userId: 7 });
    expect(await notificationsRepository.unreadCount(null)).toBe(3);
    expect(await notificationsRepository.unreadCount(42)).toBe(2); // global + u42
  });
});

describe("markRead / markAllRead", () => {
  it("markRead flips read + sets readAt", async () => {
    const row = await notificationsRepository.create(base());
    const updated = await notificationsRepository.markRead(row.id);
    expect(updated?.read).toBe(true);
    expect(updated?.readAt).toBeTruthy();
  });

  it("markRead on a missing id returns null", async () => {
    expect(await notificationsRepository.markRead("nope")).toBeNull();
  });

  it("markAllRead marks only matching + unread rows and returns the change count", async () => {
    await createAt("2026-01-01T00:00:01Z", { title: "g" });
    await createAt("2026-01-01T00:00:02Z", { title: "u42", userId: 42 });
    await createAt("2026-01-01T00:00:03Z", { title: "u7", userId: 7 });
    const changed = await notificationsRepository.markAllRead(42);
    expect(changed).toBe(2); // global + u42
    expect(await notificationsRepository.unreadCount(7)).toBe(2); // global stays unread for u7
    expect(await notificationsRepository.unreadCount(42)).toBe(0);
  });
});

describe("delete / deleteAll", () => {
  it("delete removes one row", async () => {
    const row = await notificationsRepository.create(base());
    expect(await notificationsRepository.delete(row.id)).toBe(true);
    expect((await notificationsRepository.list({})).total).toBe(0);
  });

  it("deleteAll removes only rows matching the user scope", async () => {
    await createAt("2026-01-01T00:00:01Z", { title: "g" });
    await createAt("2026-01-01T00:00:02Z", { title: "u42", userId: 42 });
    await createAt("2026-01-01T00:00:03Z", { title: "u7", userId: 7 });
    const removed = await notificationsRepository.deleteAll(42); // global + u42
    expect(removed).toBe(2);
    const rest = await notificationsRepository.list({});
    expect(rest.data.map((d) => d.title)).toEqual(["u7", "g"]);
    expect((await notificationsRepository.list({ userId: 42 })).total).toBe(0);
    expect((await notificationsRepository.list({ userId: 7 })).data.map((d) => d.title)).toEqual(["u7", "g"]);
  });
});

describe("global notifications are isolated per user", () => {
  it("reading and hiding a global row leaves another user's bell unchanged", async () => {
    const row = await notificationsRepository.create(base());
    await notificationsRepository.markReadForUser(row.id, 42);
    expect((await notificationsRepository.list({ userId: 42 })).data[0].read).toBe(true);
    expect((await notificationsRepository.list({ userId: 7 })).data[0].read).toBe(false);
    await notificationsRepository.deleteForUser(row.id, 42);
    expect((await notificationsRepository.list({ userId: 42 })).total).toBe(0);
    expect((await notificationsRepository.list({ userId: 7 })).total).toBe(1);
  });
});

describe("trim — caps the sidecar", () => {
  it("keeps only the newest `max` rows, dropping the oldest", async () => {
    await createAt("2026-01-01T00:00:01Z", { title: "oldest" });
    await createAt("2026-01-01T00:00:02Z", { title: "mid" });
    await createAt("2026-01-01T00:00:03Z", { title: "newest" });
    await notificationsRepository.trim(2);
    const { data, total } = await notificationsRepository.list({});
    expect(total).toBe(2);
    expect(data.map((d) => d.title)).toEqual(["newest", "mid"]);
  });
});
