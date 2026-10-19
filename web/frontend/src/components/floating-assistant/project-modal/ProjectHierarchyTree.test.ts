// @vitest-environment happy-dom
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assistantProjectsApi, type AssistantProject } from "../assistant-api";
import { ProjectHierarchyTree } from "./ProjectHierarchyTree";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
function item(id: string, path: string, parentId?: string): AssistantProject {
  return { id, title: id, icon: "Folder", path, instructions: "", provider: "codex", parentId, relation: "owner" };
}
let projects: AssistantProject[];
let host: HTMLDivElement;
let root: Root;
const onNavigate = vi.fn();
const onCreateChild = vi.fn();
const onRefresh = vi.fn();

async function show(projectId: string) {
  await act(async () => root.render(createElement(ProjectHierarchyTree, {
    project: projects.find((project) => project.id === projectId)!, allProjects: projects,
    onNavigate, onCreateChild, onRefresh,
  })));
}

beforeEach(() => {
  projects = [item("root", "/workspace"), item("web", "/workspace/web", "root"),
    item("mobile", "/workspace/mobile", "root"), item("api", "/workspace/web/api", "web"),
    item("other", "/elsewhere")];
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.spyOn(assistantProjectsApi, "list").mockImplementation(async () => projects);
  vi.spyOn(assistantProjectsApi, "update").mockImplementation(async (id, patch) => {
    projects = projects.map((project) => project.id === id ? { ...project, ...patch } : project);
    return projects.find((project) => project.id === id)!;
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); vi.restoreAllMocks(); vi.clearAllMocks();
});

describe("ProjectHierarchyTree", () => {
  it("renders the same hierarchy from the parent and a grandchild", async () => {
    await show("root");
    expect(Array.from(host.querySelectorAll("[data-hierarchy-node]"), (element) => element.getAttribute("data-hierarchy-node")))
      .toEqual(["root", "mobile", "web", "api"]);
    await show("api");
    expect(Array.from(host.querySelectorAll("[data-hierarchy-node]"), (element) => element.getAttribute("data-hierarchy-node")))
      .toEqual(["root", "mobile", "web", "api"]);
    expect(host.textContent).not.toContain("other");
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Crear subproyecto en web"]')!.click());
    expect(onCreateChild).toHaveBeenCalledWith(expect.objectContaining({ id: "web" }));
    await act(async () => host.querySelector<HTMLButtonElement>('[title="Editar mobile"]')!.click());
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: "mobile" }));
  });

  it("reorders siblings and changes level without overwriting the parent on reorder", async () => {
    await show("root");
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Subir web"]')!.click());
    expect(assistantProjectsApi.update).toHaveBeenCalledWith("web", expect.objectContaining({ sortOrder: expect.any(Number) }));
    expect(vi.mocked(assistantProjectsApi.update).mock.calls[0]?.[1]).not.toHaveProperty("parentId");
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Subir de nivel api"]')!.click());
    expect(assistantProjectsApi.update).toHaveBeenCalledWith("api", expect.objectContaining({ parentId: "root" }));
    expect(onRefresh).toHaveBeenCalledTimes(2);
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Eliminar web"]')?.disabled).toBe(false);
  });
});
