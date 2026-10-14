// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";

const records = vi.hoisted(() => new Map<string, Record<string, unknown>>());
vi.mock("../../../shared/data-store/make-kv-store.js", () => ({
  makeKvStore: () => () => ({
    get: async (id: string) => records.get(id) ?? null,
    set: async (id: string, value: Record<string, unknown>) => {
      const doc = { ...value, id };
      records.set(id, doc);
      return doc;
    },
    list: async () => [...records.values()],
  }),
}));

import { pathSlug, projectMapRepository } from "./project-map.repository.js";
import type { Executor } from "../../../shared/executor/index.js";
import type { ProjectMap } from "../services/project-map/project-map.service.js";

const executor = {} as Executor;
const map = { project: { name: "App", type: "Web", summary: "Summary" }, tabs: [], provider: "claude", generatedAt: "2026-01-01" } as ProjectMap;

describe("project map locale cache", () => {
  it("separates generated maps and child reuse by locale", async () => {
    records.clear();
    await projectMapRepository.save(executor, "/srv/app", { ...map, project: { ...map.project, summary: "Résumé" } }, "fr");
    await projectMapRepository.save(executor, "/srv/app", { ...map, project: { ...map.project, summary: "Summary" } }, "en");
    await projectMapRepository.save(executor, "/srv/app/child", map, "fr");
    expect((await projectMapRepository.get(executor, "/srv/app", "fr"))?.map.project.summary).toBe("Résumé");
    expect((await projectMapRepository.get(executor, "/srv/app", "en"))?.map.project.summary).toBe("Summary");
    expect(await projectMapRepository.get(executor, "/srv/app", "ja")).toBeNull();
    expect((await projectMapRepository.listUnder(executor, "/srv/app", "fr")).map((doc) => doc.path)).toEqual(["/srv/app/child"]);
    expect(await projectMapRepository.listUnder(executor, "/srv/app", "en")).toEqual([]);
  });

  it("reads old Spanish maps only for Spanish", async () => {
    records.clear();
    records.set(pathSlug("/srv/legacy"), { path: "/srv/legacy", map });
    expect(await projectMapRepository.get(executor, "/srv/legacy", "es")).toMatchObject({ path: "/srv/legacy" });
    expect(await projectMapRepository.get(executor, "/srv/legacy", "en")).toBeNull();
  });
});
