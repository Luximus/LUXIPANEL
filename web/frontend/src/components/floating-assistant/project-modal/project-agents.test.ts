// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as api from "../assistant-api";
import { ProjectModal } from "../ProjectModal";
import { ProjectAgentsDialog } from "../ProjectAgentsDialog";
import { AssistantSettingsModal } from "../AssistantSettingsModal";
import { AssistantI18nProvider, mergeAssistantMessages } from "../i18n";
import { projectAgentScope, projectForAgent } from "./agent-scope";
import { toPayload, emptyDraft } from "../agents-tab/draft";
import "../AgentsTab";

vi.mock("../assistant-api", async (original) => ({
  ...await original<typeof api>(),
  assistantAgentsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
  assistantProjectsApi: { list: vi.fn(), update: vi.fn() },
  assistantAgentTeamsApi: { list: vi.fn() },
  assistantAgentRolesApi: { list: vi.fn() },
  assistantModulesApi: { list: vi.fn() },
  fetchAssociatableConnections: vi.fn().mockResolvedValue([]),
  fetchTerminalSnippetFilterOptions: vi.fn().mockResolvedValue({ ok: false, categories: [], tags: [] }),
  fetchGraphAvailability: vi.fn().mockResolvedValue({ available: false }),
}));
vi.mock("../GeneralTab", () => ({ GeneralTab: () => null }));
vi.mock("../StructurePanel", () => ({ StructurePanel: () => null }));

const project = (id: string, teamId?: string, parentId?: string): api.AssistantProject => ({
  id, title: `Proyecto ${id}`, teamId, parentId, provider: "codex", path: `/project/${id}`, instructions: "", icon: "Folder",
});
const alpha = { ...project("alpha", "team-a"), leaderAgentId: "leader-a" };
const child = project("child", undefined, alpha.id);
const nested = project("nested", undefined, child.id);
const beta = project("beta", "team-b");
const projects = [alpha, child, nested, beta];
const agent = (id: string, teamId: string, projectIds: string[]): api.AssistantAgent => ({
  ...toPayload(emptyDraft()), capabilities: { canEditProfile: true, canDeleteProfile: true, canAssign: true, canUpdateAssignment: false, canRemoveAssignment: false, canExecute: false }, id, name: `Agente ${id}`, description: "Agente de prueba", teamId, projectIds,
} as api.AssistantAgent);
const agents = [agent("leader-a", "team-a", [child.id]), agent("worker-a", "team-a", [nested.id]), agent("leader-b", "team-b", [alpha.id])];
let root: Root | undefined;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

beforeEach(() => {
  vi.mocked(api.assistantAgentsApi.list).mockReset().mockResolvedValue(agents);
  vi.mocked(api.assistantProjectsApi.list).mockReset().mockResolvedValue(projects);
  vi.mocked(api.assistantAgentTeamsApi.list).mockResolvedValue([
    { id: "team-a", name: "Equipo Alpha" }, { id: "team-b", name: "Equipo Beta" }, { id: "empty", name: "Sin proyecto" },
  ] as api.AgentTeam[]);
  vi.mocked(api.assistantAgentRolesApi.list).mockResolvedValue([]);
  vi.mocked(api.assistantModulesApi.list).mockResolvedValue([]);
  vi.mocked(api.assistantAgentsApi.create).mockResolvedValue(agents[0]);
  vi.mocked(api.assistantAgentsApi.update).mockResolvedValue(agents[0]);
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  vi.clearAllMocks();
  document.body.replaceChildren();
});

async function mount(element: ReturnType<typeof createElement>) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(createElement(AssistantI18nProvider, { value: mergeAssistantMessages({}), children: element })));
  // Flush lazy imports and their initial data effects.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
}
function button(label: string) {
  const found = [...document.querySelectorAll("button")].find((el) => el.textContent?.trim() === label || el.title === label);
  expect(found, `Botón ${label}`).toBeDefined();
  return found!;
}
async function click(label: string) { await act(async () => button(label).click()); }
async function fill(input: HTMLInputElement, text: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("resolves the project tree without requiring a global team and fails closed for bad ancestors", () => {
  expect(projectAgentScope(nested, projects)?.root.id).toBe(alpha.id);
  expect(projectAgentScope(nested, projects)?.projects.map(p => p.id)).toEqual([alpha.id, child.id, nested.id]);
  expect(projectAgentScope(child, [child])).toBeNull();
  expect(projectAgentScope(child, [{ ...alpha, parentId: child.id }, child])).toBeNull();
  expect(projectAgentScope(project("empty"), [])?.root.id).toBe("empty");
});

it("does not reroute a profile to its global team or first attached project", () => {
  expect(projectForAgent(agents[2], projects, alpha.id)).toBeNull();
  expect(projectForAgent(agents[0], projects, nested.id)).toBeNull();
});

it("defaults to project membership, includes inherited agents and separates the Market", async () => {
  vi.mocked(api.assistantAgentsApi.list).mockResolvedValue([
    { ...agents[0], context: { projectId: child.id, membership: "direct" } },
    { ...agents[1], context: { projectId: child.id, membership: "inherited" } },
    { ...agents[2], context: { projectId: child.id, membership: "none" } },
  ] as api.AssistantAgent[]);
  await mount(createElement(ProjectModal, { project: child, allProjects: projects, initialTab: "agents", onClose: vi.fn(), onSaved: vi.fn() }));
  expect(api.assistantAgentsApi.list).toHaveBeenCalledWith({ contextProjectId: child.id });
  const names = () => [...document.querySelectorAll("article h3")].map(el => el.textContent);
  expect(names()).toEqual(["Agente leader-a", "Agente worker-a"]);
  const source = [...document.querySelectorAll("select")].find(el => el.value === "project")!;
  expect(source).toBeDefined();
  await act(async () => { source.value = "market"; source.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(names()).toEqual(["Agente leader-b"]);
  await act(async () => { source.value = "project"; source.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(names()).toEqual(["Agente leader-a", "Agente worker-a"]);
});

it("creates a reusable profile without implicitly assigning it or moving a team", async () => {
  await mount(createElement(ProjectModal, { project: child, allProjects: projects, initialTab: "agents", onClose: vi.fn(), onSaved: vi.fn() }));
  await click("Crear perfil");
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  const input = document.querySelector('input[maxlength="120"]') as HTMLInputElement;
  expect(input).not.toBeNull(); await fill(input, "Especialista");
  await click("Crear agente");
  const payload = vi.mocked(api.assistantAgentsApi.create).mock.calls[0][0];
  expect(payload.name).toBe("Especialista");
  expect(payload).not.toHaveProperty("teamId");
  expect(payload).not.toHaveProperty("projectIds");
  expect(api.assistantProjectsApi.update).not.toHaveBeenCalled();
});

it("opens a single global profile editor from a chip and preserves assignment fields on save", async () => {
  await mount(createElement(ProjectAgentsDialog, { projectId: alpha.id, agentId: agents[2].id, locale: "es", onClose: vi.fn(), onLaunchAgent: vi.fn() }));
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  expect(document.body.textContent).toContain("Editar perfil global");
  const input = [...document.querySelectorAll("input")].find(el => el.value === agents[2].name)!;
  expect(input).toBeDefined(); await fill(input, "Agente actualizado"); await click("Guardar cambios");
  const payload = vi.mocked(api.assistantAgentsApi.update).mock.calls[0][1];
  expect(payload.name).toBe("Agente actualizado"); expect(payload).not.toHaveProperty("teamId"); expect(payload).not.toHaveProperty("projectIds");
});

it("generic links offer an explicit project and subproject selector", async () => {
  await mount(createElement(ProjectAgentsDialog, { locale: "es", onClose: vi.fn(), onLaunchAgent: vi.fn() }));
  expect(document.body.textContent).toContain("Selecciona un proyecto");
  expect(document.body.textContent).toContain(child.title);
  const select = document.querySelector("select")!;
  await act(async () => { select.value = nested.id; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(api.assistantAgentsApi.list).toHaveBeenLastCalledWith({ contextProjectId: nested.id });
});

it("keeps profile management out of advanced settings", async () => {
  await mount(createElement(AssistantSettingsModal, { open: true, section: "general", locale: "es", config: null, dataTableI18n: null, onClose: vi.fn(), onSectionChange: vi.fn(), onConfigChange: vi.fn() }));
  const labels = [...document.querySelectorAll("nav button")].map(el => el.textContent?.trim());
  expect(labels).toContain("General"); expect(labels).not.toContain("Agentes"); expect(labels).toHaveLength(4);
});

function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function ReopenableDialog({ onClose }: { onClose(): void }) {
  const [request, setRequest] = useState<number | null>(0), [next, setNext] = useState(1);
  return createElement("div", null,
    createElement("button", { onClick: () => { setRequest(next); setNext(next + 1); } }, "Reabrir"),
    request !== null && createElement(ProjectAgentsDialog, { key: request, projectId: alpha.id, agentId: agents[2].id, locale: "es", onClose: () => { onClose(); setRequest(null); }, onLaunchAgent: vi.fn() }),
  );
}
it("waits outside a drawer for a delayed profile, then opens exactly one editor", async () => {
  const pending = deferred<api.AssistantAgent[]>();
  vi.mocked(api.assistantAgentsApi.list).mockReturnValueOnce(pending.promise);
  await mount(createElement(ProjectAgentsDialog, { agentId: agents[2].id, locale: "es", onClose: vi.fn(), onLaunchAgent: vi.fn() }));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.querySelector('[role="status"]')?.textContent).toContain("Cargando catálogo");
  await act(async () => pending.resolve(agents));
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  expect([...document.querySelectorAll("input")].some(input => input.value === agents[2].name)).toBe(true);
});
it.each(["Escape", "close button"])("cancels pending profile loading with %s and ignores the old response on reopening", async method => {
  const old = deferred<api.AssistantAgent[]>(), fresh = deferred<api.AssistantAgent[]>();
  vi.mocked(api.assistantAgentsApi.list).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  const close = vi.fn(); await mount(createElement(ReopenableDialog, { onClose: close }));
  await act(async () => {
    if (method === "Escape") window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    else document.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!.click();
  });
  expect(close).toHaveBeenCalledTimes(1); await click("Reabrir");
  await act(async () => old.resolve(agents));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await act(async () => fresh.resolve(agents));
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
});
it("ignores a late failure from a closed editor", async () => {
  const pending = deferred<api.AssistantAgent[]>();
  vi.mocked(api.assistantAgentsApi.list).mockReturnValueOnce(pending.promise);
  await mount(createElement(ReopenableDialog, { onClose: vi.fn() }));
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  await click("Reabrir"); const editor = document.querySelector('[role="dialog"]');
  await act(async () => pending.reject(new Error("Old request")));
  expect(document.querySelector('[role="dialog"]')).toBe(editor); expect(document.querySelector('[role="alert"]')).toBeNull();
});
it("denies profile editing when the server does not grant that capability", async () => {
  vi.mocked(api.assistantAgentsApi.list).mockResolvedValue([{ ...agents[2], capabilities: { ...agents[2].capabilities!, canEditProfile: false } }]);
  await mount(createElement(ProjectAgentsDialog, { agentId: agents[2].id, locale: "es", onClose: vi.fn(), onLaunchAgent: vi.fn() }));
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("No tienes permiso");
  expect(document.querySelector('input[maxlength="120"]')).toBeNull();
});
it("closes profile editing when the target changes", async () => {
  const close = vi.fn(); await mount(createElement(ReopenableDialog, { onClose: close }));
  await act(async () => window.dispatchEvent(new Event("luxipanel:target-changed")));
  expect(close).toHaveBeenCalledTimes(1); expect(document.querySelector('[role="dialog"]')).toBeNull();
});
