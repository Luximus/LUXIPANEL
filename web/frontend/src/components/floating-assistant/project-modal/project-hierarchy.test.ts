// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import type { AssistantProject } from "../assistant-api";
import { hierarchyIds, hierarchyRoot, mayReparent, rankForInsertion, sortedSiblings } from "./project-hierarchy";

function item(id: string, path: string, parentId?: string, sortOrder?: number): AssistantProject {
  return { id, title: id, icon: "Folder", path, instructions: "", provider: "codex", parentId, sortOrder };
}

describe("project hierarchy", () => {
  const root = item("root", "/workspace");
  const web = item("web", "/workspace/web", "root");
  const mobile = item("mobile", "/workspace/mobile", "root");
  const api = item("api", "/workspace/web/api", "web");
  const unrelated = item("other", "/elsewhere");
  const projects = [root, web, mobile, api, unrelated];

  it("shows the same complete tree from a root or nested project", () => {
    expect(hierarchyRoot(api, projects).id).toBe(root.id);
    expect(hierarchyIds(hierarchyRoot(api, projects), projects)).toEqual(new Set(["root", "web", "mobile", "api"]));
  });

  it("blocks cycles and paths outside the selected parent", () => {
    expect(mayReparent(web, api, root, projects)).toBe(false);
    expect(mayReparent(mobile, web, root, projects)).toBe(false);
    expect(mayReparent(api, root, root, projects)).toBe(true);
    expect(mayReparent(unrelated, root, root, projects)).toBe(false);
  });

  it("persists sibling order with one new rank", () => {
    const rank = rankForInsertion(web, root.id, mobile.id, projects);
    expect(rank).not.toBeNull();
    const updated = projects.map((entry) => entry.id === web.id ? { ...entry, sortOrder: rank! } : entry);
    expect(sortedSiblings(root.id, updated).map((entry) => entry.id)).toEqual(["web", "mobile"]);
    expect(rankForInsertion(mobile, root.id, null, updated)).toBeGreaterThan(rank!);
  });

  it("allows ordering existing children even when an older root has no directory", () => {
    const blank = item("blank", "");
    const child = item("child", "/somewhere", blank.id);
    expect(mayReparent(child, blank, blank, [blank, child])).toBe(true);
  });
});
