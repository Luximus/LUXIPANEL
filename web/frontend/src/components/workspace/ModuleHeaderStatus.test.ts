import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ModuleHeaderStatus } from "./ModuleHeaderStatus";

const state = vi.hoisted(() => ({ scope: { root: null as unknown as HTMLElement }, visible: true }));
vi.mock("./view-context", () => ({ useViewContext: () => ({ scope: state.scope }) }));
vi.mock("./module-visibility", () => ({ useModuleVisibility: () => state.visible }));
let root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = `<div class="lxp-workspace-quick-drawer" id="other"><div data-module-header-status-slot></div></div>
    <div class="lxp-workspace-quick-drawer" id="owner"><header><div data-module-header-status-slot></div></header><main></main></div>`;
  state.scope = { root: document.querySelector("#owner main")! }; state.visible = true;
  root = createRoot(state.scope.root);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ""; });
const render = async (label = "Servidor saludable") => act(async () => { root.render(React.createElement(ModuleHeaderStatus, { children: React.createElement("span", { id: "monitor-health" }, label) })); });

it("puts the badge in the owning drawer header without duplicating its id", async () => {
  await render();
  expect(document.querySelector("#owner header #monitor-health")?.textContent).toBe("Servidor saludable");
  expect(document.querySelector("#other #monitor-health")).toBeNull();
  expect(state.scope.root.querySelector("#monitor-health")).toBeNull();
  expect(document.querySelectorAll("#monitor-health")).toHaveLength(1);
});
it("removes the badge when the cached view is hidden and restores it once when reopened", async () => {
  await render(); state.visible = false; await render();
  expect(document.querySelector("#monitor-health")).toBeNull();
  state.visible = true; await render(); expect(document.querySelectorAll("#monitor-health")).toHaveLength(1);
  await render("Healthy server"); expect(document.querySelector("#monitor-health")?.textContent).toBe("Healthy server");
});
it("cleans up the portal when the module is removed", async () => {
  await render(); await act(async () => root.render(null));
  expect(document.querySelector("#monitor-health")).toBeNull();
});
