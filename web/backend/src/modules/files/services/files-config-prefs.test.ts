// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";

const buckets = new Map<string, Map<string, Record<string, unknown>>>();
vi.mock("../../../shared/data-store/index.js", () => ({
  dataStore: (executor: { target: { id: string } }, module: string, collection: string) => {
    const bucketId = `${executor.target.id}:${module}:${collection}`;
    const bucket = buckets.get(bucketId) ?? new Map<string, Record<string, unknown>>();
    buckets.set(bucketId, bucket);
    return {
      get: async (id: string) => bucket.get(String(id)) ?? null,
      set: async (id: string, value: Record<string, unknown>) => { bucket.set(String(id), value); return value; },
      transaction: async (fn: (current: Record<string, Record<string, unknown>>) => Promise<{ next: Record<string, Record<string, unknown>>; result: unknown }>) => {
        const current = Object.fromEntries(bucket);
        const { next, result } = await fn(current);
        bucket.clear();
        for (const [id, value] of Object.entries(next)) bucket.set(id, value);
        return result;
      },
    };
  },
}));

const { filesConfigService } = await import("./files-config.service.js");
const { filesPrefsService } = await import("./files-prefs.service.js");
const executor = (id: string) => ({ target: { id, name: id } }) as never;

describe("files policy and personal preferences", () => {
  it("keeps policies per server and clamps values to environment ceilings", async () => {
    const first = executor("config-first");
    const second = executor("config-second");
    const ceiling = filesConfigService.ceilings();
    await filesConfigService.patch(first, { uploadMaxBytes: ceiling.uploadMaxBytes + 1024, sharingEnabled: false });
    expect((await filesConfigService.get(first)).uploadMaxBytes).toBe(ceiling.uploadMaxBytes);
    expect((await filesConfigService.get(first)).sharingEnabled).toBe(false);
    expect((await filesConfigService.get(second)).sharingEnabled).toBe(true);
  });

  it("keeps user settings on their server when the legacy mode endpoint updates only mode", async () => {
    const first = executor("prefs-first");
    const second = executor("prefs-second");
    await filesPrefsService.patch(first, 4, { favoriteRoots: ["/srv/site"], treeExpansionMode: "single", shortcuts: { save: "Ctrl+Alt+S" } });
    await filesPrefsService.setMode(first, 4, "client");
    expect(await filesPrefsService.get(first, 4)).toMatchObject({ mode: "client", favoriteRoots: ["/srv/site"], treeExpansionMode: "single", shortcuts: { save: "Ctrl+Alt+S" } });
    expect(await filesPrefsService.get(first, 5)).toMatchObject({ treeExpansionMode: "multiple" });
    expect(await filesPrefsService.get(second, 4)).toMatchObject({ mode: "developer", treeExpansionMode: "multiple" });
  });
});
