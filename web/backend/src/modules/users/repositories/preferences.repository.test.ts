// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — preferencesRepository over an in-memory fake dataStore.
 * Verifies GET-default (no doc), create, and partial-merge upsert (the merge
 * that backs PUT /api/preferences/ui).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory single-collection fake mirroring the dataStore surface the
// repository uses: get / update (merge) / create (auto id + timestamps).
const rows = new Map<string, Record<string, unknown>>();

vi.mock("../../../shared/data-store/index.js", () => ({
  dataStore: () => ({
    async get(id: string | number) {
      return rows.get(String(id)) ?? null;
    },
    async update(id: string | number, patch: Record<string, unknown>) {
      const cur = rows.get(String(id));
      if (!cur) return null;
      const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
      rows.set(String(id), next);
      return next;
    },
    async create(data: Record<string, unknown>) {
      const id = data["userId"];
      const created = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      rows.set(String(id), created);
      return created;
    },
  }),
}));

import { preferencesRepository } from "./preferences.repository.js";

describe("preferencesRepository", () => {
  beforeEach(() => {
    rows.clear();
  });

  it("returns undefined when the user has no sidecar yet (GET default source)", async () => {
    expect(await preferencesRepository.findByUserId(7)).toBeUndefined();
  });

  it("creates a doc on first upsert and reads it back", async () => {
    await preferencesRepository.upsert(7, { theme: "dark" });
    const row = await preferencesRepository.findByUserId(7);
    expect(row?.userId).toBe(7);
    expect(row?.data).toEqual({ theme: "dark" });
  });

  it("merges a partial patch into the existing blob (PUT partial + merge)", async () => {
    await preferencesRepository.upsert(7, { theme: "dark", language: "es" });
    // Second patch only touches language → theme must survive.
    const updated = await preferencesRepository.upsert(7, { language: "en" });
    expect(updated.data).toEqual({ theme: "dark", language: "en" });
  });
});
