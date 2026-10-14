// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, Record<string, unknown>>>();
vi.mock("../../../shared/data-store/index.js", () => ({
  dataStore: (_executor: unknown, _module: string, collection: string) => {
    const rows = collections.get(collection) ?? new Map<string, Record<string, unknown>>();
    collections.set(collection, rows);
    return {
      async list() { return [...rows.values()]; },
      async create(row: Record<string, unknown>) {
        // Same explicit-id contract as dataStore: an empty string is still explicit.
        const id = row.id !== undefined ? String(row.id) : `generated-${rows.size + 1}`;
        const saved = { ...row, id };
        rows.set(id, saved);
        return saved;
      },
      async update(id: string, patch: Record<string, unknown>) {
        const row = rows.get(id);
        if (!row) return null;
        const saved = { ...row, ...patch };
        rows.set(id, saved);
        return saved;
      },
      async delete(id: string) { return rows.delete(id); },
      async transaction(fn: (current: Record<string, Record<string, unknown>>) => Promise<{ next: Record<string, Record<string, unknown>>; result: unknown }>) {
        const { next, result } = await fn(Object.fromEntries(rows));
        rows.clear();
        for (const [id, row] of Object.entries(next)) rows.set(id, row);
        return result;
      },
    };
  },
}));

import { serverAlertsRepository } from "./server-alerts.repository.js";

beforeEach(() => collections.clear());

describe("server alert row identity", () => {
  it("gives scheduled notifications a usable generated id", async () => {
    const row = await serverAlertsRepository.createScheduled({ title: "mantenimiento", body: "hoy", scheduleAt: "2026-10-01T00:00:00Z", cron: null, recurring: false, enabled: true, signals: null, lastFiredAt: null });
    expect(row.id).toBe("generated-1");
    expect((await serverAlertsRepository.updateScheduled(row.id, { enabled: false }))?.enabled).toBe(false);
    expect(await serverAlertsRepository.deleteScheduled(row.id)).toBe(true);
  });

  it("gives metric rules a usable generated id", async () => {
    const row = await serverAlertsRepository.createRule({ name: "cpu", metric: "cpu", op: ">=", threshold: 90, service: null, enabled: true, cooldownMinutes: 30, lastFiredAt: null });
    expect(row.id).toBe("generated-1");
    expect((await serverAlertsRepository.updateRule(row.id, { enabled: false }))?.enabled).toBe(false);
    expect(await serverAlertsRepository.deleteRule(row.id)).toBe(true);
  });

  it("repairs legacy records saved under an empty id", async () => {
    collections.set("scheduled", new Map([["", { id: "", title: "antigua", body: "aviso", enabled: true }]]));
    const [row] = await serverAlertsRepository.listScheduled();
    expect(row?.id).toBeTruthy();
    expect(row?.id).not.toBe("");
    expect((await serverAlertsRepository.listScheduled())[0]?.id).toBe(row?.id);
  });
});
