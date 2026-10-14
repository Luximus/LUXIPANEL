// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";

const records = new Map<string, Record<string, unknown>>();
vi.mock("../../../shared/data-store/index.js", () => ({
  dataStore: () => ({
    get: async (id: string) => records.get(String(id)) ?? null,
    list: async () => [...records.values()],
    set: async (id: string, data: Record<string, unknown>) => { const r = { ...data, id, updatedAt: "now" }; records.set(String(id), r); return r; },
    delete: async (id: string) => records.delete(String(id)),
  }),
}));

const { fileMetaService } = await import("./file-meta.service.js");
const { ALLOWED_BASES, setAllowedBases } = await import("./filesystem.service.js");

const exec = { target: { id: "r", name: "R" } } as never;
beforeEach(() => { records.clear(); setAllowedBases(["/srv"]); });
void ALLOWED_BASES;

describe("fileMetaService", () => {
  it("returns an empty record when none", async () => {
    const m = await fileMetaService.get(exec, "/srv/app/.env");
    expect(m).toEqual({ id: "/srv/app/.env", path: "/srv/app/.env", tags: [], comment: "" });
  });

  it("upserts tags + comment, dedups and caps tag length", async () => {
    const m = await fileMetaService.set(exec, "/srv/app/.env", ["Sensible", "Sensible", " Producción "], "No tocar");
    expect(m.tags).toEqual(["Sensible", "Producción"]);
    expect(m.comment).toBe("No tocar");
    const back = await fileMetaService.get(exec, "/srv/app/.env");
    expect(back.tags).toEqual(["Sensible", "Producción"]);
  });

  it("deletes the entry when tags and comment are both empty", async () => {
    await fileMetaService.set(exec, "/srv/app/x", ["Backup"], "");
    expect(records.size).toBe(1);
    await fileMetaService.set(exec, "/srv/app/x", [], "   ");
    expect(records.size).toBe(0);
  });

  it("lists all annotated files", async () => {
    await fileMetaService.set(exec, "/srv/a", ["Importante"], "");
    await fileMetaService.set(exec, "/srv/b", [], "nota");
    const all = await fileMetaService.listAll(exec);
    expect(all).toHaveLength(2);
  });
});
