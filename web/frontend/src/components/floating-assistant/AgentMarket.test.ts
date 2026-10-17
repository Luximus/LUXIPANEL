// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { AgentMarket } from "./AgentMarket";
import { AssistantI18nProvider, mergeAssistantMessages } from "./i18n";
import { AgentRequestError } from "./assistant-api/agents";
import type { AssistantAgent, AssistantProject } from "./assistant-api";

const mock = vi.hoisted(() => ({ list: vi.fn(), projects: vi.fn(), put: vi.fn(), remove: vi.fn(), confirm: vi.fn(), scope: "target-a" }));
vi.mock("@/lib/api-client", async original => ({ ...await original<Record<string, unknown>>(), resolveTargetScope: () => mock.scope, scopeHeaders: () => ({}) }));
vi.mock("@/lib/confirm", () => ({ openConfirm: mock.confirm }));
vi.mock("./assistant-api", async original => ({ ...await original<Record<string, unknown>>(),
  assistantAgentsApi: { list: mock.list, updateAssignment: mock.put, removeAssignment: mock.remove },
  assistantProjectsApi: { list: mock.projects },
  assistantAgentRolesApi: { list: async () => [{ id: "dev", name: "Desarrollo" }] },
}));
vi.mock("./use-module-catalog", () => ({ useModuleCatalog: () => undefined }));
vi.mock("./AgentProfileDialog", () => ({ AgentProfileDialog: () => createElement("div", { "data-profile-editor": true }) }));
const projects = [{ id: "root", title: "Raíz" }, { id: "child", parentId: "root", title: "Aplicación" }, { id: "other", title: "Otro" }] as AssistantProject[];
function profile(id: string, membership: "none" | "direct" | "inherited" | "removed" = "none", editable = true): AssistantAgent {
  const assigned = membership === "direct" || membership === "inherited";
  const assignment = assigned ? { projectId: "child", status: "active" as const, inheritedFrom: membership === "inherited" ? "root" : null } : null;
  return { id, name: id, description: "Automatización de servicios", specialty: "Infraestructura", technologies: ["TypeScript", "Linux"], roleId: "dev", teamId: "unchanged-team", providerId: "codex", model: "", systemPrompt: "", allowedTools: null,
    capabilities: { canEditProfile: editable, canDeleteProfile: editable, canAssign: editable && membership !== "direct", canUpdateAssignment: editable && membership === "direct", canRemoveAssignment: editable && membership === "direct", canExecute: assigned },
    context: { projectId: "child", membership, directAssignment: membership === "direct" ? assignment : null, effectiveAssignment: assignment, effectiveConfig: null },
    assignments: assignment ? [assignment] : [], execution: { projectId: "child", error: null },
  };
}
let root: Root, host: HTMLDivElement, records: AssistantAgent[];
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
beforeEach(() => {
  vi.clearAllMocks(); mock.scope = "target-a";
  records = [profile("Disponible"), profile("Miembro", "direct"), profile("Compartido", "direct", false)];
  mock.list.mockImplementation(async () => records); mock.projects.mockResolvedValue(projects); mock.confirm.mockResolvedValue(true);
  mock.put.mockImplementation(async (id: string) => { records = records.map(item => item.id === id ? profile(id, "direct") : item); return { projectId: "child", status: "active" }; });
  mock.remove.mockImplementation(async (id: string) => { records = records.map(item => item.id === id ? profile(id, "removed") : item); });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
async function mount(projectId: string | undefined = "child") {
  await act(async () => root.render(createElement(AssistantI18nProvider, { value: mergeAssistantMessages({}), children: createElement(AgentMarket, { projectId }) })));
}
function article(name: string) { return [...document.querySelectorAll("article")].find(item => item.querySelector("h3")?.textContent === name)!; }
function button(name: string, within: ParentNode = document) { return [...within.querySelectorAll("button")].find(item => item.textContent?.trim() === name)!; }
async function click(name: string, within?: ParentNode) { const item = button(name, within); expect(item).toBeDefined(); await act(async () => item.click()); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { resolve, promise }; }

it("loads the complete contextual catalog and exposes only permitted actions", async () => {
  await mount();
  expect(mock.list).toHaveBeenCalledWith({ contextProjectId: "child" });
  expect(document.querySelectorAll("article")).toHaveLength(3);
  expect(article("Compartido").textContent).toContain("Solo lectura");
  expect(article("Compartido").querySelectorAll("button")).toHaveLength(0);
});
it("searches name, description, specialty and technology and distinguishes no matches", async () => {
  await mount();
  const input = document.querySelector<HTMLInputElement>('input[type="search"]')!;
  for (const query of ["Disponible", "automatizacion", "infraestructura", "typescript", "inexistente"]) {
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, query); input.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(document.querySelectorAll("article").length).toBe(query === "Disponible" ? 1 : query === "inexistente" ? 0 : 3);
  }
  expect(host.textContent).toContain("No hay perfiles que coincidan");
});
it("filters by assignment without excluding shared authorized profiles", async () => {
  await mount();
  const select = document.querySelector<HTMLSelectElement>('select[aria-label="Todas las asignaciones"]')!;
  await act(async () => { select.value = "assigned"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(document.querySelectorAll("article")).toHaveLength(2);
  expect(article("Compartido")).toBeDefined();
});
it("adds a link without editing the global profile or moving its team", async () => {
  await mount(); await click("Incorporar al proyecto", article("Disponible"));
  expect(mock.put).toHaveBeenCalledExactlyOnceWith("Disponible", "child", {});
  expect(article("Disponible").textContent).toContain("Retirar del proyecto");
  expect(records.find(item => item.id === "Disponible")?.teamId).toBe("unchanged-team");
});
it("removes only the assignment after confirmation and refreshes confirmed state", async () => {
  await mount(); await click("Retirar del proyecto", article("Miembro"));
  expect(mock.confirm.mock.calls[0][0]).toContain("Se conservan su perfil y su historial");
  expect(mock.remove).toHaveBeenCalledExactlyOnceWith("Miembro", "child");
  expect(article("Miembro").textContent).toContain("Retirado");
  expect(article("Miembro").textContent).toContain("Incorporar al proyecto");
});
it("does not remove when confirmation is cancelled", async () => {
  mock.confirm.mockResolvedValue(false); await mount(); await click("Retirar del proyecto", article("Miembro"));
  expect(mock.remove).not.toHaveBeenCalled();
});
it("rechecks permissions after confirmation", async () => {
  await mount();
  mock.confirm.mockImplementation(async () => { records = [profile("Miembro", "direct", false)]; return true; });
  await click("Retirar del proyecto", article("Miembro"));
  expect(mock.remove).not.toHaveBeenCalled(); expect(document.querySelector('[role="alert"]')?.textContent).toContain("No tienes permiso");
});
it("prevents double submission and waits for the mutation before refreshing", async () => {
  const pending = deferred<{ projectId: string; status: string }>(); mock.put.mockReturnValue(pending.promise);
  await mount(); const add = button("Incorporar al proyecto", article("Disponible"));
  await act(async () => { add.click(); add.click(); });
  expect(mock.put).toHaveBeenCalledTimes(1); expect(add.disabled).toBe(true); expect(article("Disponible").textContent).not.toContain("Retirar del proyecto");
  await act(async () => { records = [profile("Disponible", "direct")]; pending.resolve({ projectId: "child", status: "active" }); });
  expect(article("Disponible").textContent).toContain("Retirar del proyecto");
});
it.each([[409, "ASSISTANT_ASSIGNMENT_BUSY", "Hay trabajo"], [0, undefined, "No se pudo confirmar"]])("keeps uncertain or blocked mutations retryable only after review (%s)", async (status, code, message) => {
  mock.remove.mockRejectedValue(new AgentRequestError(status as number, code as string | undefined, "raw error"));
  await mount(); await click("Retirar del proyecto", article("Miembro"));
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(message);
  expect(mock.remove).toHaveBeenCalledTimes(1); expect(host.textContent).not.toContain("Cambios guardados");
  await click("Reintentar"); expect(mock.remove).toHaveBeenCalledTimes(1);
});
it("offers inherited configuration and source management without a misleading remove action", async () => {
  records = [profile("Heredado", "inherited")]; await mount();
  expect(button("Retirar del proyecto")).toBeUndefined(); expect(host.textContent).toContain("Heredado de Raíz");
  await click("Configurar asignación");
  const input = [...document.querySelectorAll("input")].find(item => item.maxLength === 200)!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Revisor"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await click("Guardar cambios"); expect(mock.put).toHaveBeenCalledExactlyOnceWith("Heredado", "child", { jobTitle: "Revisor" });
});
it("discards old catalog results and project selection after target change", async () => {
  const old = deferred<AssistantAgent[]>(); mock.list.mockReturnValueOnce(old.promise); await mount();
  await act(async () => { mock.scope = "target-b"; records = [profile("Nuevo target")]; window.dispatchEvent(new Event("luxipanel:target-changed")); });
  await act(async () => old.resolve([profile("Target anterior")]));
  expect(host.textContent).not.toContain("Target anterior"); expect(mock.list).toHaveBeenLastCalledWith({});
  expect(button("Incorporar al proyecto")).toBeUndefined();
});
it("does not mutate a different target after a delayed confirmation", async () => {
  const confirmation = deferred<boolean>(); mock.confirm.mockReturnValue(confirmation.promise);
  await mount(); await click("Retirar del proyecto", article("Miembro"));
  await act(async () => { mock.scope = "target-b"; window.dispatchEvent(new Event("luxipanel:target-changed")); });
  await act(async () => confirmation.resolve(true)); expect(mock.remove).not.toHaveBeenCalled();
});
it("provides retry for load errors and an empty catalog state", async () => {
  mock.list.mockRejectedValueOnce(new Error("offline")); await mount();
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
  records = []; await click("Reintentar"); expect(host.textContent).toContain("Todavía no hay perfiles");
});
