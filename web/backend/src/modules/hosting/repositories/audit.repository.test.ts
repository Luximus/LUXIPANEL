// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tests for the hosting audit repository — in-memory fake dataStore.
 * Verifies: append assigns uuid + createdAt + normalized severity; findByAccount
 * filters by accountId, sorts newest-first, and clamps the limit.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory store keyed by collection. Mirrors the dataStore create/query API
// the repository relies on (uuid ids, auto createdAt).
const docs: Record<string, unknown[]> = {};
let uuidCounter = 0;

vi.mock("../../../shared/data-store/index.js", () => ({
  dataStore: (_executor: unknown, mod: string, col: string) => {
    const key = `${mod}:${col}`;
    docs[key] ??= [];
    return {
      async create(data: Record<string, unknown>) {
        const created = {
          ...data,
          id: data["id"] ?? `uuid-${++uuidCounter}`,
          createdAt: data["createdAt"] || new Date(Date.now() + uuidCounter * 1000).toISOString(),
        };
        docs[key]!.push(created);
        return created;
      },
      async query(pred: (d: unknown) => boolean) {
        return docs[key]!.filter(pred);
      },
      async list() {
        return [...docs[key]!];
      },
    };
  },
}));

import { hostingAuditRepository } from "./audit.repository.js";

describe("hostingAuditRepository", () => {
  beforeEach(() => {
    for (const k of Object.keys(docs)) delete docs[k];
    uuidCounter = 0;
  });

  it("append assigns a string id + createdAt and returns the normalized entry", async () => {
    const entry = await hostingAuditRepository.append({
      accountId: 7,
      eventType: "ACCOUNT_CREATED",
      severity: "info",
      actor: "alice",
      context: { plan: "pro" },
    });
    expect(typeof entry.id).toBe("string");
    expect(entry.accountId).toBe(7);
    expect(entry.eventType).toBe("ACCOUNT_CREATED");
    expect(entry.severity).toBe("info");
    expect(entry.actor).toBe("alice");
    expect(entry.context).toEqual({ plan: "pro" });
    expect(entry.createdAt).toBeTruthy();
  });

  it("normalizes an unknown severity to info and a missing context to {}", async () => {
    const entry = await hostingAuditRepository.append({
      accountId: 1,
      eventType: "WEIRD",
      severity: "bogus",
    });
    expect(entry.severity).toBe("info");
    expect(entry.context).toEqual({});
    expect(entry.actor).toBe("");
  });

  it("findByAccount returns only the matching account, newest first", async () => {
    await hostingAuditRepository.append({ accountId: 1, eventType: "A" });
    await hostingAuditRepository.append({ accountId: 2, eventType: "OTHER" });
    await hostingAuditRepository.append({ accountId: 1, eventType: "B" });

    const rows = await hostingAuditRepository.findByAccount(1);
    expect(rows.map((r) => r.eventType)).toEqual(["B", "A"]);
    expect(rows.every((r) => r.accountId === 1)).toBe(true);
  });

  it("findByAccount clamps the limit to 1..100", async () => {
    for (let i = 0; i < 5; i++) {
      await hostingAuditRepository.append({ accountId: 9, eventType: `E${i}` });
    }
    expect((await hostingAuditRepository.findByAccount(9, 2)).length).toBe(2);
    expect((await hostingAuditRepository.findByAccount(9, 0)).length).toBe(1);
    expect((await hostingAuditRepository.findByAccount(9, 999)).length).toBe(5);
  });

  it("matches accountId even when the stored value is a string", async () => {
    // kv-store may surface numeric fields as strings — repo coerces via Number().
    docs["hosting:audit-log"] = [
      { id: "x", accountId: "3", eventType: "S", severity: "info", actor: "", context: null, createdAt: new Date().toISOString() },
    ];
    const rows = await hostingAuditRepository.findByAccount(3);
    expect(rows.length).toBe(1);
    expect(rows[0]!.accountId).toBe(3);
  });
});
