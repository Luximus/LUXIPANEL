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
  ...toPayload(emptyDraft()), id, name: `Agente ${id}`, description: "Agente de prueba", teamId, projectIds,
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

it("inherits the root team for nested projects and rejects missing/cyclic ancestry", () => {
  expect(projectAgentScope(nested, projects)?.root.id).toBe(alpha.id);
  expect(projectAgentScope(nested, projects)?.projects.map((p) => p.id)).toEqual([alpha.id, child.id, nested.id]);
  expect(projectAgentScope(child, [child])).toBeNull();
  expect(projectAgentScope(child, [{ ...alpha, parentId: child.id }, child])).toBeNull();
  expect(projectAgentScope(project("empty"), [])).toBeNull();
});

it("routes agent edits by team membership rather than attached resource projects", () => {
  expect(projectForAgent(agents[2], projects, alpha.id)?.id).toBe(beta.id);
  expect(projectForAgent(agents[0], projects, nested.id)?.id).toBe(nested.id);
  expect(projectForAgent(agent("orphan", "missing", [alpha.id]), projects)).toBeNull();
});

it("shows only the project team, shares it with children and launches in the selected child", async () => {
  const launch = vi.fn();
  await mount(createElement(ProjectModal, { project: child, allProjects: projects, initialTab: "agents", onClose: vi.fn(), onSaved: vi.fn(), onLaunchAgent: launch }));
  expect(document.body.textContent).toContain("comparte el equipo de Proyecto alpha");
  expect(document.body.textContent).toContain("Equipo Alpha");
  expect(document.body.textContent).toContain("Agente worker-a");
  expect(document.body.textContent).not.toContain("Equipo Beta");
  expect(document.body.textContent).not.toContain("Agente leader-b");
  expect(document.body.textContent).not.toContain("Sin proyecto");
  expect(document.querySelector('button[title="Nuevo equipo"]')).toBeNull();
  const start = [...document.querySelectorAll("button")].find((el) => el.textContent?.includes("Iniciar chat"))!;
  await act(async () => start.click());
  expect(launch).toHaveBeenCalledWith(agents[0], child.id);
});

it("creates agents in the project team and saves through the project drawer footer", async () => {
  await mount(createElement(ProjectModal, { project: child, allProjects: projects, initialTab: "agents", onClose: vi.fn(), onSaved: vi.fn() }));
  await click("Nuevo agente");
  const name = document.querySelector('input[maxlength="120"]') as HTMLInputElement;
  expect(name).not.toBeNull();
  await fill(name, "Nuevo especialista");
  await click("Crear agente");
  expect(api.assistantAgentsApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Nuevo especialista", teamId: "team-a", projectIds: [child.id], providerId: "codex", parentAgentId: "leader-a" }));
  expect(api.assistantProjectsApi.update).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Equipo Alpha");
});

it("opens agent chips in their owning project and preserves existing resource attachments on save", async () => {
  await mount(createElement(ProjectAgentsDialog, { projectId: alpha.id, agentId: agents[2].id, locale: "es", onClose: vi.fn(), onLaunchAgent: vi.fn() }));
  expect(document.body.textContent).toContain("Proyecto beta");
  const input = [...document.querySelectorAll("input")].find((el) => el.value === agents[2].name)!;
  expect(input).toBeDefined();
  await fill(input, "Agente actualizado");
  await click("Guardar cambios");
  expect(api.assistantAgentsApi.update).toHaveBeenCalledWith(agents[2].id, expect.objectContaining({ teamId: "team-b", projectIds: [alpha.id], name: "Agente actualizado" }));
});

it("opens project selection for legacy agent links without a current project", async () => {
  await mount(createElement(ProjectAgentsDialog, { locale: "es", onClose: vi.fn(), onLaunchAgent: vi.fn() }));
  expect(document.body.textContent).toContain("Selecciona un proyecto");
  await click(beta.title);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
  expect(document.body.textContent).toContain("Equipo Beta");
  expect(document.body.textContent).not.toContain("Equipo Alpha");
});

it("removes the global Agents section from advanced settings", async () => {
  await mount(createElement(AssistantSettingsModal, { open: true, section: "general", locale: "es", config: null, dataTableI18n: null, onClose: vi.fn(), onSectionChange: vi.fn(), onConfigChange: vi.fn() }));
  const labels = [...document.querySelectorAll("nav button")].map((el) => el.textContent?.trim());
  expect(labels).toContain("General");
  expect(labels).not.toContain("Agentes");
  expect(labels).toHaveLength(4);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Mirror AssistantPanel's conditional mount and fresh key for each opening.
function ReopenableDialog({ onClose }: { onClose(): void }) {
  const [request, setRequest] = useState<number | null>(0);
  const [next, setNext] = useState(1);
  return createElement("div", null,
    createElement("button", { onClick: () => { setRequest(next); setNext(next + 1); } }, "Reabrir"),
    request !== null && createElement(ProjectAgentsDialog, {
      key: request, projectId: alpha.id, agentId: agents[2].id, locale: "es",
      onClose: () => { onClose(); setRequest(null); }, onLaunchAgent: vi.fn(),
    }),
  );
}

function observeDrawers() {
  const opened = new Set<Element>();
  const collect = (records: MutationRecord[]) => {
    for (const record of records) for (const node of record.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches('[role="dialog"]')) opened.add(node);
      node.querySelectorAll('[role="dialog"]').forEach((dialog) => opened.add(dialog));
    }
  };
  const observer = new MutationObserver(collect);
  observer.observe(document.body, { childList: true, subtree: true });
  return { count: () => { collect(observer.takeRecords()); return opened.size; }, stop: () => observer.disconnect() };
}

async function closeDrawer(onClose: ReturnType<typeof vi.fn>, count: number) {
  await act(async () => {
    document.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!.click();
    // Wait for the real drawer close callback, including its exit animation.
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(count));
  });
}

it.each(["projects", "agents"] as const)("opens exactly one editor when the %s catalog is delayed", async (catalog) => {
  const pendingProjects = deferred<api.AssistantProject[]>();
  const pendingAgents = deferred<api.AssistantAgent[]>();
  if (catalog === "projects") vi.mocked(api.assistantProjectsApi.list).mockReturnValueOnce(pendingProjects.promise);
  else vi.mocked(api.assistantAgentsApi.list).mockReturnValueOnce(pendingAgents.promise);
  const drawers = observeDrawers();
  try {
    await mount(createElement(ProjectAgentsDialog, { projectId: alpha.id, agentId: agents[2].id, locale: "es", onClose: vi.fn(), onLaunchAgent: vi.fn() }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(drawers.count()).toBe(0);
    expect(document.querySelector('[role="status"]')?.textContent).toContain("Cargando proyecto");
    expect(document.body.textContent).not.toContain("Selecciona un proyecto");

    await act(async () => {
      pendingProjects.resolve(projects);
      pendingAgents.resolve(agents);
    });
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(drawers.count()).toBe(1);
    expect(document.body.textContent).not.toContain("Selecciona un proyecto");
    expect(document.body.textContent).toContain(beta.title);
    expect([...document.querySelectorAll("input")].some((input) => input.value === agents[2].name)).toBe(true);
  } finally { drawers.stop(); }
});

it.each(["Escape", "close button"] as const)("cancels pending agent loading with %s and ignores its response after reopening", async (method) => {
  const oldRequest = deferred<api.AssistantProject[]>();
  const newRequest = deferred<api.AssistantProject[]>();
  vi.mocked(api.assistantProjectsApi.list).mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
  const onClose = vi.fn();
  await mount(createElement(ReopenableDialog, { onClose }));
  await act(async () => {
    if (method === "Escape") window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    else document.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[role="dialog"], [role="status"]')).toBeNull();

  await click("Reabrir");
  await act(async () => oldRequest.resolve(projects));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.querySelector('[role="status"]')?.textContent).toContain("Cargando proyecto");
  await act(async () => newRequest.resolve(projects));
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  expect([...document.querySelectorAll("input")].some((input) => input.value === agents[2].name)).toBe(true);
  await closeDrawer(onClose, 2);
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await click("Reabrir");
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  expect([...document.querySelectorAll("input")].some((input) => input.value === agents[2].name)).toBe(true);
});

it("ignores a late rejection from a closed request while a fresh editor is open", async () => {
  const oldRequest = deferred<api.AssistantProject[]>();
  vi.mocked(api.assistantProjectsApi.list).mockReturnValueOnce(oldRequest.promise);
  const onClose = vi.fn();
  await mount(createElement(ReopenableDialog, { onClose }));
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
  expect(onClose).toHaveBeenCalledTimes(1);
  await click("Reabrir");
  const editor = document.querySelector('[role="dialog"]');
  expect(editor).not.toBeNull();
  await act(async () => oldRequest.reject(new Error("Respuesta de una apertura anterior")));
  expect(document.querySelector('[role="dialog"]')).toBe(editor);
  expect(document.querySelector('[role="alert"]')).toBeNull();
  expect(document.body.textContent).not.toContain("Respuesta de una apertura anterior");
});

it.each(["projects", "agents"] as const)("shows a dismissible %s error without the generic selector and recovers on reopen", async (catalog) => {
  const pendingProjects = deferred<api.AssistantProject[]>();
  const pendingAgents = deferred<api.AssistantAgent[]>();
  if (catalog === "projects") vi.mocked(api.assistantProjectsApi.list).mockReturnValueOnce(pendingProjects.promise);
  else vi.mocked(api.assistantAgentsApi.list).mockReturnValueOnce(pendingAgents.promise);
  const onClose = vi.fn();
  await mount(createElement(ReopenableDialog, { onClose }));
  await act(async () => {
    const error = new Error("No se pudo consultar el catálogo");
    if (catalog === "projects") pendingProjects.reject(error);
    else pendingAgents.reject(error);
  });
  expect(document.querySelector('[role="alert"]')?.textContent).toBe("No se pudo consultar el catálogo");
  expect(document.body.textContent).not.toContain("Selecciona un proyecto");
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  await closeDrawer(onClose, 1);
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await click("Reabrir");
  expect(document.querySelector('[role="alert"]')).toBeNull();
  expect([...document.querySelectorAll("input")].some((input) => input.value === agents[2].name)).toBe(true);
});

it.each(["missing agent", "missing team"] as const)("reports %s on a direct link without offering unrelated projects", async (missing) => {
  vi.mocked(api.assistantAgentsApi.list).mockResolvedValueOnce(missing === "missing agent" ? [] : [
    agent(agents[2].id, "missing-team", [alpha.id]),
  ]);
  await mount(createElement(ProjectAgentsDialog, { projectId: alpha.id, agentId: agents[2].id, locale: "es", onClose: vi.fn(), onLaunchAgent: vi.fn() }));
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("No se pudo localizar el equipo");
  expect(document.body.textContent).not.toContain("Selecciona un proyecto");
  expect(document.body.textContent).not.toContain(alpha.title);
});

it("preserves loading and root-project selection for generic links", async () => {
  const pending = deferred<api.AssistantProject[]>();
  vi.mocked(api.assistantProjectsApi.list).mockReturnValueOnce(pending.promise);
  await mount(createElement(ProjectAgentsDialog, { locale: "es", onClose: vi.fn(), onLaunchAgent: vi.fn() }));
  const selector = document.querySelector('[role="dialog"]');
  expect(selector).not.toBeNull();
  expect(selector?.textContent).toContain("Selecciona un proyecto");
  expect(selector?.querySelector('[role="status"]')?.textContent).toContain("Cargando proyecto");
  expect(api.assistantAgentsApi.list).not.toHaveBeenCalled();
  await act(async () => pending.resolve(projects));
  expect(document.querySelector('[role="dialog"]')).toBe(selector);
  expect(document.body.textContent).toContain(alpha.title);
  expect(document.body.textContent).toContain(beta.title);
  expect(document.body.textContent).not.toContain(child.title);
  await click(beta.title);
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  expect(document.body.textContent).toContain("Equipo Beta");
});

it("preserves the generic selector's empty and error states", async () => {
  vi.mocked(api.assistantProjectsApi.list).mockResolvedValueOnce([]);
  await mount(createElement(ProjectAgentsDialog, { locale: "es", onClose: vi.fn(), onLaunchAgent: vi.fn() }));
  expect(document.body.textContent).toContain("Selecciona un proyecto");
  expect(document.querySelector('[role="status"]')).toBeNull();
  expect(document.querySelector('[role="alert"]')).toBeNull();
  expect(document.body.textContent).toContain(mergeAssistantMessages({}).projectModal.noProjectsRegistered);
  await act(async () => root!.unmount());
  root = undefined;
  vi.mocked(api.assistantProjectsApi.list).mockRejectedValueOnce(new Error("Catálogo no disponible"));
  await mount(createElement(ProjectAgentsDialog, { locale: "es", onClose: vi.fn(), onLaunchAgent: vi.fn() }));
  expect(document.body.textContent).toContain("Selecciona un proyecto");
  expect(document.querySelector('[role="alert"]')?.textContent).toBe("Catálogo no disponible");
});
