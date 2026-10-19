// @vitest-environment happy-dom
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { AssistantProject } from "./assistant-api";
import { ProjectModal } from "./ProjectModal";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const parent = { id: "parent", title: "Parent", path: "/project", icon: "Folder", instructions: "", provider: "codex" } as AssistantProject;
const child = { ...parent, id: "child", title: "Child", path: "/project/child", parentId: parent.id } as AssistantProject;

vi.mock("./project-modal/ProjectModalView", async () => {
  const { createElement } = await import("react");
  return { ProjectModalView: (props: { project: AssistantProject | null; covered?: boolean; layer?: number; onOpenDrawer: (project: AssistantProject) => void; onClose: () => void }) =>
    createElement("div", { "data-drawer": props.project?.id, "data-covered": String(!!props.covered), "data-layer": props.layer },
      createElement("button", { type: "button", onClick: () => props.onOpenDrawer(child) }, "Open child"),
      createElement("button", { type: "button", onClick: props.onClose }, "Close")) };
});

let host: HTMLDivElement;
let root: Root;
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
});

it("keeps the original project mounted beneath a selected project drawer", async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(ProjectModal, {
    project: parent, allProjects: [parent, child], onClose: vi.fn(), onSaved: vi.fn(),
  })));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-drawer="parent"] button')!.click());
  expect([...host.querySelectorAll("[data-drawer]")].map((node) => [node.getAttribute("data-drawer"), node.getAttribute("data-covered"), node.getAttribute("data-layer")]))
    .toEqual([["parent", "true", "0"], ["child", "false", "1"]]);
  await act(async () => host.querySelector<HTMLButtonElement>('[data-drawer="child"] button:last-child')!.click());
  expect([...host.querySelectorAll("[data-drawer]")].map((node) => node.getAttribute("data-drawer"))).toEqual(["parent"]);
});
