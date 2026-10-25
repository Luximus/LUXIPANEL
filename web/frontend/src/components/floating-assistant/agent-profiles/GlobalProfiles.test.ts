import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GlobalProfiles, GlobalProfileEditor } from "./GlobalProfiles";
import { emptyGlobalManifest } from "./types";

const mock = vi.hoisted(() => ({ list: vi.fn(), catalog: vi.fn(), save: vi.fn(), import: vi.fn(), projects: vi.fn(), scope: "A" }));
vi.mock("./api", () => ({ profilesApi: mock }));
vi.mock("@/lib/api-client", () => ({ resolveTargetScope: () => mock.scope, scopeHeaders: () => ({}) }));
vi.mock("../assistant-api", () => ({ assistantProjectsApi: { list: mock.projects } }));
vi.mock("../AgentProfileDialog", () => ({ AgentProfileDialog: (props: { projectId: string }) => h("div", { "data-private-project": props.projectId }) }));
vi.mock("../AgentAvatar", () => ({ AgentAvatar: () => h("span", { "aria-label": "Avatar" }) }));
vi.mock("../use-module-catalog", () => ({ useModuleCatalog: () => undefined }));
vi.mock("@/components/ui/ModalShell", () => ({ ModalShell: ({ children }: { children: React.ReactNode }) => h("div", { role: "dialog" }, children) }));
let root: Root, host: HTMLDivElement;
const manifest = () => ({ ...emptyGlobalManifest(), name: "API specialist", technologies: ["TypeScript"], allowedTools: ["files.read"] });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
beforeEach(() => {
  vi.clearAllMocks(); mock.scope = "A";
  mock.projects.mockResolvedValue([{ id: "p1", title: "Project A" }]);
  mock.catalog.mockResolvedValue([{ id: "public", version: "1.0.0", author: "Example", manifest: manifest() }]);
  mock.list.mockResolvedValue({ profiles: [{ id: "local", revision: 1, manifest: manifest() }], capabilities: { canPublish: true } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const button = (label: string) => [...host.querySelectorAll("button")].find(el => el.textContent === label)!;
it("exposes only portable fields and tools in the global editor", async () => {
  const onSave = vi.fn();
  await act(async () => root.render(h(GlobalProfileEditor, { value: manifest(), onSave, locale: "es", busy: false })));
  expect(host.textContent).toContain("Conocimientos");
  expect(host.textContent).not.toMatch(/Modelo|Jerarquía|Servidor|Proveedor/);
  await act(async () => button("Herramientas").click());
  expect(host.textContent).toContain("files.read");
  await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(onSave.mock.calls[0][0]).toMatchObject({ name: "API specialist", allowedTools: ["files.read"] });
  for (const key of ["model", "providerId", "projectIds", "credential", "teamId"]) expect(onSave.mock.calls[0][0]).not.toHaveProperty(key);
});
it("requires a project and reuses the import identity after an unconfirmed response", async () => {
  mock.import.mockRejectedValueOnce(new Error("Resultado sin confirmar")).mockResolvedValue({ id: "private-a" });
  await act(async () => root.render(h(GlobalProfiles, { mode: "bazaar", locale: "es" })));
  expect(button("Importar al proyecto").disabled).toBe(true);
  const select = host.querySelector("select")!;
  await act(async () => { select.value = "p1"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  await act(async () => button("Importar al proyecto").click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("sin confirmar");
  await act(async () => button("Importar al proyecto").click());
  expect(mock.import).toHaveBeenCalledTimes(2);
  expect(mock.import.mock.calls[0][0]).toEqual(mock.import.mock.calls[1][0]);
  expect(host.querySelector("[data-private-project]")?.getAttribute("data-private-project")).toBe("p1");
});
it("does not display a response from another target", async () => {
  let resolve!: (value: unknown) => void;
  mock.catalog.mockReturnValue(new Promise(done => { resolve = done; }));
  await act(async () => root.render(h(GlobalProfiles, { mode: "bazaar", locale: "es" })));
  mock.scope = "B";
  await act(async () => resolve([{ id: "old", version: "1.0.0", author: "Old", manifest: manifest() }]));
  expect(host.textContent).not.toContain("API specialist");
});
