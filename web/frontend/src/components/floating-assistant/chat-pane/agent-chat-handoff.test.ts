// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useChatPane, type ChatPaneProps, type ChatPaneVM } from "./use-chat-pane";
import { chatUiState } from "../chat-ui-state";
import { ChatSidebar } from "./ChatSidebar";
import { ChatMain } from "./ChatMain";
import { chatEngine } from "../chat-engine";
import { assistantAgentsApi } from "../assistant-api";

const staged = { name: "contexto.txt", mimeType: "text/plain", dataBase64: "UVQ=" };
const legacy = vi.hoisted(() => ({ id: "legacy", title: "Buzón antiguo", provider: "claude", projectId: null, agentId: "agent", preview: "", messageCount: 0 }));
const conversationApi = vi.hoisted(() => ({
  activity: vi.fn(async () => [{ id: "worker-chat", agentId: "worker", unreviewed: true, unreadCount: 3, running: true }]),
  list: vi.fn(async (...args: Parameters<typeof import("../assistant-api/conversations").assistantConversationsApi.list>) => ({ items: args[6]?.agentId ? [legacy] : [], total: 1, summary: { agents: { agent: 1 }, projects: {} } })),
  get: vi.fn(async (): Promise<import("../assistant-api/conversations").ConversationMeta> => legacy),
  messages: vi.fn(async (): Promise<{ items: import("../assistant-api/conversations").ConversationMessage[]; total: number; hasMore: boolean }> => ({ items: [], total: 0, hasMore: false })),
  session: vi.fn(async () => ({ sessionId: null })),
  context: vi.fn(async () => ({ enabled: false })),
  markReviewed: vi.fn(async () => {}),
}));

vi.mock("../assistant-api", async original => ({
  ...await original<Record<string, unknown>>(),
  assistantProjectsApi: { list: vi.fn().mockResolvedValue([
    { id: "root", title: "Root", teamId: "team", leaderAgentId: "agent" }, { id: "child", title: "Child", parentId: "root" },
  ]) },
  assistantAgentsApi: { list: vi.fn().mockImplementation(async (query: { contextProjectId?: string; projectId?: string } = {}) => {
    const projectId = query.contextProjectId ?? query.projectId;
    return [{ id: "agent", teamId: "team", name: "Oscar", providerId: "claude", model: "" }, { id: "worker", teamId: "different-global-team", relation: "shared", name: "Sofía", roleId: "dev", providerId: "claude", model: "agent-model" }, { id: "other-provider", teamId: "team", name: "Ana", roleId: "dev", providerId: "codex", model: "" }].map(agent => ({ ...agent,
      assignments: [{ projectId: "root", status: "active", source: "explicit" }],
      capabilities: { canExecute: true }, context: projectId ? { projectId, membership: projectId === "root" ? "direct" : "inherited" } : null,
    }));
  }) },
  assistantAgentRolesApi: { list: vi.fn().mockResolvedValue([{ id: "dev", name: "Desarrollo" }]) },
  assistantConversationsApi: conversationApi,
}));
vi.mock("../assistant-api/conversations", async original => ({
  ...await original<Record<string, unknown>>(),
  assistantConversationsApi: conversationApi,
}));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, tasks: [], items: [], runs: [], leader: null }), { headers: { "Content-Type": "application/json" } })));
});
afterEach(() => vi.unstubAllGlobals());

it("keeps an incoming agent and child on initial mount and provider activation", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  const root = createRoot(host);
  let vm!: ChatPaneVM;
  function Probe(props: ChatPaneProps) { vm = useChatPane(props); return null; }
  const props: ChatPaneProps = { provider: "claude", mode: "api", active: true, openProjectId: "child", openAgentId: "agent", openAgentDraft: { text: "Borrador entre proveedores", attachments: [staged] }, openNonce: 1 };
  try {
    await act(async () => { root.render(createElement(Probe, props)); });
    expect(vm.currentAgentId).toBe("agent");
    expect(vm.currentProjectId).toBe("child");
    expect(vm.selectedModel).toBe("");
    expect(vm.draft).toBe("Borrador entre proveedores");
    expect(vm.attachments).toEqual([staged]);
    expect(chatUiState.getPane("claude").currentAgentId).toBe("agent");
    await act(async () => { root.render(createElement(Probe, { ...props, active: false })); });
    chatUiState.patchPane("claude", { activeId: null, currentAgentId: null, currentProjectId: null });
    await act(async () => { root.render(createElement(Probe, { ...props, openNonce: 2 })); });
    expect(vm.currentAgentId).toBe("agent");
    expect(vm.currentProjectId).toBe("child");
    expect(vm.selectedModel).toBe("");
  } finally { await act(async () => root.unmount()); }
});

it("keeps the selected agent and draft as read-only history when its assignment is removed", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  chatUiState.patchPane("claude", { activeId: null, currentProjectId: "child", currentAgentId: "worker", draft: "Borrador conservado", attachments: [] });
  const list = vi.mocked(assistantAgentsApi.list), original = list.getMockImplementation()!;
  let removed = false;
  list.mockImplementation(async query => (await original(query)).map(agent => !removed || agent.id !== "worker" ? agent : {
    ...agent, capabilities: { ...agent.capabilities!, canExecute: false },
    context: { ...agent.context!, membership: "removed", effectiveAssignment: null, effectiveConfig: null },
    assignments: [{ projectId: "root", status: "removed", source: "explicit" }],
  }));
  const host = document.createElement("div"), root = createRoot(host);
  let vm!: ChatPaneVM;
  function Probe() {
    vm = useChatPane({ provider: "claude", mode: "api", active: true });
    return createElement(ChatMain, { vm, attachmentImages: new Map() });
  }
  try {
    await act(async () => root.render(createElement(Probe)));
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.readOnly).toBe(false);
    removed = true;
    await act(async () => window.dispatchEvent(new Event("lxp:assistant:agents-updated")));
    expect(vm.currentProjectId).toBe("child"); expect(vm.currentAgentId).toBe("worker");
    expect(vm.draft).toBe("Borrador conservado");
    expect(vm.projectTeamAgents.some(agent => agent.id === "worker")).toBe(false);
    expect(vm.historicalProjectAgents.some(agent => agent.id === "worker")).toBe(true);
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.readOnly).toBe(true);
    expect(host.textContent).toContain("Histórico: no disponible para nuevos chats");
  } finally { await act(async () => root.unmount()); list.mockImplementation(original); }
});

it("opens an existing chat from the sidebar and keeps its messages and team visible", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  chatUiState.patchPane("claude", { activeId: null, currentProjectId: "child", currentAgentId: "agent" });
  const host = document.createElement("div");
  const root = createRoot(host);
  let vm!: ChatPaneVM;
  function Probe() {
    vm = useChatPane({ provider: "claude", mode: "api", active: true });
    return createElement("div", null, createElement(ChatSidebar, { vm }), createElement(ChatMain, { vm, attachmentImages: new Map() }));
  }
  try {
    await act(async () => root.render(createElement(Probe)));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(vm.convos.some(c => c.id === legacy.id)).toBe(true);
    conversationApi.messages.mockResolvedValueOnce({ items: [
      { role: "user", content: "Consulta anterior del proyecto", ts: "2026-10-17T12:00:00Z" },
      { role: "assistant", content: "Respuesta guardada del agente", ts: "2026-10-17T12:01:00Z" },
    ], total: 2, hasMore: false });
    const row = [...host.querySelectorAll<HTMLElement>('[data-selected-project-convos] p')]
      .find(element => element.textContent?.includes(legacy.title));
    expect(row).toBeTruthy();
    await act(async () => row!.click());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(vm.activeId).toBe(legacy.id);
    expect(vm.chatLoading).toBe(false);
    expect(vm.turns.map(turn => turn.text)).toEqual(["Consulta anterior del proyecto", "Respuesta guardada del agente"]);
    expect(host.querySelector('[data-agent-shortcut]')).toBeNull();
    await vi.waitFor(() => expect(host.textContent).toContain("Respuesta guardada del agente"));
    expect(vm.currentProjectId).toBe("child");
    expect(vm.activeMeta?.projectId).toBeNull();
    expect(vm.currentAgentId).toBe("agent");
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.readOnly).toBe(true);
    expect(host.textContent).toContain("Histórico: no disponible para nuevos chats");
    expect(host.querySelector("[data-agent-group]")).toBeNull();
    expect(host.querySelector("[data-selected-project-convos]")?.textContent).toContain("Buzón antiguo");
  } finally { await act(async () => root.unmount()); }
});

it.each(["agent", "worker", null])("returns from a project chat with agent %s while loading and ignores the late result", async (agentId) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  chatUiState.patchPane("claude", { activeId: null, currentProjectId: "child", currentAgentId: "agent" });
  const host = document.createElement("div"), root = createRoot(host);
  let vm!: ChatPaneVM;
  let resolveHistory!: (value: Awaited<ReturnType<typeof conversationApi.messages>>) => void;
  const history = new Promise<Awaited<ReturnType<typeof conversationApi.messages>>>(resolve => { resolveHistory = resolve; });
  let opening!: Promise<void>;
  function Probe() {
    vm = useChatPane({ provider: "claude", mode: "api", active: true });
    return createElement(ChatMain, { vm, attachmentImages: new Map() });
  }
  try {
    await act(async () => root.render(createElement(Probe)));
    conversationApi.get.mockResolvedValueOnce({ ...legacy, id: "loading-chat", projectId: "child", agentId });
    conversationApi.messages.mockImplementationOnce(() => history);
    await act(async () => { opening = vm.openConversation("loading-chat"); });
    expect(vm.currentAgentId).toBe(agentId);
    expect(vm.chatLoading).toBe(true);
    await act(async () => { vm.setDraft("Seguir después"); vm.setAttachments([staged]); });
    const back = host.querySelector<HTMLButtonElement>('[data-search-target="chat-all-agents"]');
    expect(back).not.toBeNull();
    await act(async () => back!.click());
    expect(vm.chatLoading).toBe(false);
    expect(vm.activeId).toBeNull();
    expect(host.querySelectorAll('[data-agent-shortcut]')).toHaveLength(3);
    await act(async () => {
      resolveHistory({ items: [{ role: "assistant", content: "Respuesta tardía", ts: "2026-10-18" }], total: 1, hasMore: false });
      await opening;
    });
    expect(vm.activeId).toBeNull();
    expect(vm.currentAgentId).toBeNull();
    expect(vm.currentProjectId).toBe("child");
    expect(vm.chatLoading).toBe(false);
    expect(vm.draft).toBe("Seguir después");
    expect(vm.attachments).toEqual([staged]);
    expect(host.querySelectorAll('[data-agent-shortcut]')).toHaveLength(3);
    expect(host.textContent).not.toContain("Respuesta tardía");
  } finally { resolveHistory?.({ items: [], total: 0, hasMore: false }); await act(async () => root.unmount()); }
});

it("does not insert an open agent mailbox or stale project rows into loose chats", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  chatUiState.patchPane("claude", { activeId: null, currentProjectId: "child", currentAgentId: "agent" });
  const host = document.createElement("div");
  const root = createRoot(host);
  let vm!: ChatPaneVM;
  function Probe() {
    vm = useChatPane({ provider: "claude", mode: "api", active: true });
    return createElement(ChatSidebar, { vm });
  }
  try {
    await act(async () => root.render(createElement(Probe)));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    await act(async () => { await vm.openConversation(legacy.id); });
    expect(vm.sidebarConvos.some(c => c.id === legacy.id)).toBe(true);
    await act(async () => { vm.setCurrentProjectId(null); });
    expect(vm.sidebarConvos).toEqual([]);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(vm.activeMeta?.id).toBe(legacy.id);
    expect(vm.sidebarConvos).toEqual([]);
    expect(host.querySelector('[data-selected-project-convos]')?.textContent).not.toContain(legacy.title);
    expect(conversationApi.list).toHaveBeenLastCalledWith("", 15, 0, undefined, undefined, false,
      expect.objectContaining({ projectIds: ["none"], summaryScope: "filtered" }));
    const loose = { ...legacy, id: "normal", title: "Consulta general", agentId: null };
    await act(async () => vm.setConvos([legacy, loose, { ...loose, id: "foreign", projectId: "other" }]));
    expect(vm.sidebarConvos.map(c => c.id)).toEqual(["normal"]);
    // Going back still finds the agent's unchanged legacy history.
    await act(async () => vm.setCurrentProjectId("child"));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(vm.sidebarConvos.some(c => c.id === legacy.id)).toBe(true);
    expect(legacy.projectId).toBeNull();
  } finally { await act(async () => root.unmount()); }
});


it("excludes other agents and open agent metadata when viewing unassigned project history", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  chatUiState.patchPane("claude", { activeId: null, currentProjectId: "child", currentAgentId: "agent" });
  const host = document.createElement("div");
  const root = createRoot(host);
  let vm!: ChatPaneVM;
  function Probe() { vm = useChatPane({ provider: "claude", mode: "api", active: true }); return createElement(ChatSidebar, { vm }); }
  try {
    await act(async () => root.render(createElement(Probe)));
    await act(async () => { await vm.openConversation(legacy.id); });
    await act(async () => vm.setCurrentAgentId(null));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(vm.activeMeta?.id).toBe(legacy.id);
    expect(vm.sidebarConvos).toEqual([]);
    expect(conversationApi.list).toHaveBeenLastCalledWith("", 15, 0, undefined, undefined, false,
      expect.objectContaining({ projectIds: ["child", "root"], summaryScope: "filtered" }));
    const general = { ...legacy, id: "normal", title: "Consulta general", agentId: null, projectId: "child" };
    await act(async () => vm.setConvos([legacy, general, { ...general, id: "foreign-agent", agentId: "worker" }, { ...general, id: "foreign-project", projectId: "other" }]));
    expect(vm.sidebarConvos.map(c => c.id)).toEqual(["normal"]);
    expect(host.querySelector('[data-selected-project-convos]')?.textContent).not.toContain(legacy.title);
  } finally { await act(async () => root.unmount()); }
});

it("offers Stop when the open chat is still running on the server without a local stream", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  chatUiState.patchPane("claude", { activeId: null, currentProjectId: "child", currentAgentId: "agent" });
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const stop = vi.spyOn(chatEngine, "stop").mockImplementation(() => {});
  let vm!: ChatPaneVM;
  function Probe() {
    vm = useChatPane({ provider: "claude", mode: "api", active: true });
    return createElement(ChatMain, { vm: { ...vm, streaming: false, backgroundRunning: true }, attachmentImages: new Map() });
  }
  try {
    await act(async () => root.render(createElement(Probe)));
    await act(async () => { await vm.openConversation(legacy.id); });
    const button = host.querySelector<HTMLButtonElement>('[aria-label="Stop"]');
    expect(button).not.toBeNull();
    expect(button!.disabled).toBe(false);
    await act(async () => button!.click());
    expect(stop).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledWith(vm.chatKey);
  } finally { stop.mockRestore(); await act(async () => root.unmount()); host.remove(); }
});

it("selects a member in PromptBar, filters nested history and preserves that member for a new project chat", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  chatUiState.patchPane("claude", { activeId: null, currentProjectId: "child", currentAgentId: null });
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const onLaunchAgent = vi.fn();
  let vm!: ChatPaneVM;
  function Probe() {
    vm = useChatPane({ provider: "claude", mode: "api", active: true, onLaunchAgent });
    return createElement("div", null, createElement(ChatSidebar, { vm }), createElement(ChatMain, { vm, attachmentImages: new Map() }));
  }
  const choose = async (name: string) => {
    const select = host.querySelector<HTMLButtonElement>('[data-picker="agent"]')!;
    await act(async () => select.click());
    const option = [...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(el => el.textContent?.includes(name));
    expect(option, name).toBeTruthy();
    await act(async () => option!.click());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  };
  try {
    await act(async () => root.render(createElement(Probe)));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(host.querySelector('[data-picker="agent"]')?.textContent).toContain("Todos los agentes");
    expect(host.querySelector('.lxp-chat-start .lxp-chat-greeting-logo img')?.getAttribute("data-lxp-logo-role")).toBe("sidebar");
    await choose("[Líder] Oscar");
    expect(host.querySelector('[data-agent-shortcut]')).toBeNull();
    expect(host.querySelector('.lxp-chat-start-actions')).not.toBeNull();
    expect(host.querySelector('.lxp-chat-start .lxp-chat-greeting-logo img')?.getAttribute("alt")).toBe("Oscar");
    expect(host.querySelector('.lxp-chat-start .lxp-chat-greeting-logo img')?.getAttribute("data-lxp-logo-role")).toBeNull();
    expect(host.querySelector('[title="Salir del agente"]')).toBeNull();
    expect(host.querySelector('.lxp-chat-composer-meta')?.textContent).toContain("Oscar");
    expect(vm.currentAgentId).toBe("agent");
    expect(vm.currentProjectId).toBe("child");
    expect(onLaunchAgent).not.toHaveBeenCalled();
    expect(vm.historyAgentId).toBe("agent");
    expect(conversationApi.list).toHaveBeenCalledWith("", 15, 0, undefined, undefined, undefined, expect.objectContaining({ agentId: "agent", projectIds: ["child", "root"], summaryScope: "filtered" }));
    await act(async () => { await vm.openConversation(legacy.id); });
    expect(vm.activeMeta?.agentId).toBe("agent");
    await act(async () => { vm.setDraft("Revisar con el equipo"); vm.setAttachments([staged]); });
    const backToAgents = host.querySelector<HTMLButtonElement>('[data-search-target="chat-all-agents"]');
    expect(backToAgents?.textContent).toContain("Todos los agentes");
    await act(async () => backToAgents!.click());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(vm.activeId).toBeNull();
    expect(vm.currentAgentId).toBeNull();
    expect(vm.currentProjectId).toBe("child");
    expect(vm.draft).toBe("Revisar con el equipo");
    expect(vm.attachments).toEqual([staged]);
    expect(chatUiState.getPane("claude")).toMatchObject({ activeId: null, currentAgentId: null, currentProjectId: "child" });
    expect(host.querySelectorAll('[data-agent-shortcut]')).toHaveLength(3);
    expect(host.querySelector('[data-search-target="chat-all-agents"]')).toBeNull();
    await choose("[Desarrollo] Sofía");
    expect(host.querySelector('[data-search-target="chat-all-agents"]')).not.toBeNull();
    expect(vm.draft).toBe("Revisar con el equipo");
    expect(vm.attachments).toEqual([staged]);
    expect(vm.activeId).toBeNull();
    expect(vm.headerAgent?.id).toBe("worker");
    expect(legacy.agentId).toBe("agent");
    expect(legacy.projectId).toBeNull();
    expect(vm.currentAgentId).toBe("worker");
    expect(vm.selectedModel).toBe("");
    expect(vm.currentProjectId).toBe("child");
    await act(async () => vm.looseTreeActions.onNewProjectChat("root"));
    expect(vm.currentAgentId).toBe("worker");
    expect(vm.currentProjectId).toBe("root");
    await act(async () => host.querySelector<HTMLButtonElement>('[data-search-target="new-chat"]')!.click());
    expect(vm.currentAgentId).toBe("worker");
    await act(async () => { vm.setDraft("Mensaje para otro proveedor"); vm.setAttachments([staged]); });
    await choose("[Desarrollo] Ana");
    expect(onLaunchAgent).toHaveBeenCalledWith(expect.objectContaining({ id: "other-provider", providerId: "codex" }), "root", { text: "Mensaje para otro proveedor", attachments: [staged] });
    await choose("Todos los agentes");
    expect(host.querySelector('.lxp-chat-start .lxp-chat-greeting-logo img')?.getAttribute("data-lxp-logo-role")).toBe("sidebar");
    expect(vm.currentAgentId).toBeNull();
    expect(vm.draft).toBe("Mensaje para otro proveedor");
    expect(vm.attachments).toEqual([staged]);
    expect(vm.historyAgentId).toBeUndefined();
    expect(host.querySelector('[data-picker="agent"]')?.textContent).toContain("Todos los agentes");
    expect(vm.sidebarConvos.every(c => !c.agentId)).toBe(true);
    expect(conversationApi.list).toHaveBeenLastCalledWith("", 15, 0, undefined, undefined, false,
      expect.objectContaining({ projectIds: ["child", "root"], summaryScope: "filtered" }));
    expect(host.querySelector('[data-agent-group]')).toBeNull();
    expect(host.querySelector('[data-selected-project-convos]')).not.toBeNull();
    // Cards are shortcuts to the same picker, never send/mark-read actions.
    expect(host.querySelector('.lxp-chat-start-actions')).toBeNull();
    expect(host.querySelectorAll('[data-agent-shortcut]')).toHaveLength(3);
    expect(host.querySelector('[data-agent-shortcut="worker"]')?.textContent).toContain("En ejecución");
    const reviewCalls = conversationApi.markReviewed.mock.calls.length;
    await act(async () => host.querySelector<HTMLButtonElement>('[data-agent-shortcut="worker"]')!.click());
    expect(vm.currentAgentId).toBe("worker");
    expect(vm.currentProjectId).toBe("root");
    expect(vm.draft).toBe("Mensaje para otro proveedor");
    expect(vm.attachments).toEqual([staged]);
    expect(host.querySelector('[data-picker="agent"]')?.textContent).toContain("Sofía");
    expect(host.querySelector('[data-agent-shortcut]')).toBeNull();
    expect(host.querySelector('.lxp-chat-start-actions')).not.toBeNull();
    expect(conversationApi.markReviewed.mock.calls.length).toBe(reviewCalls);
    await choose("Todos los agentes");
    expect(host.querySelectorAll('[data-agent-shortcut]')).toHaveLength(3);
    onLaunchAgent.mockClear();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-agent-shortcut="other-provider"]')!.click());
    expect(onLaunchAgent).toHaveBeenCalledWith(expect.objectContaining({ id: "other-provider" }), "root", { text: "Mensaje para otro proveedor", attachments: [staged] });
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it("moves context to the header and cycles execution from the focused draft without sending", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  chatUiState.patchPane("codex", { activeId: null, currentProjectId: "child", currentAgentId: null, draft: "Conservar texto", attachments: [staged] });
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host); let vm!: ChatPaneVM;
  function Probe() { vm = useChatPane({ provider: "codex", mode: "api", active: true }); return createElement(ChatMain, { vm, attachmentImages: new Map() }); }
  try {
    await act(async () => root.render(createElement(Probe)));
    const input = host.querySelector("textarea")!; input.focus();
    expect(host.querySelector('.lxp-chat-composer-meta [data-picker="project"]')).not.toBeNull();
    expect(host.querySelector('.lxp-chat-composer-meta [data-picker="agent"]')).not.toBeNull();
    expect(host.querySelector('.prompt-bar__bar [data-picker="project"]')).toBeNull();
    expect(host.querySelector('[data-picker="approval"]')).toBeNull();
    expect(host.querySelector('[data-picker="speed"]')).not.toBeNull();
    for (const expected of ["auto", "plan", "manual"]) {
      const key = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
      await act(async () => input.dispatchEvent(key));
      expect(key.defaultPrevented).toBe(true); expect(document.activeElement).toBe(input);
      expect(vm.approvalMode).toBe(expected); expect(input.value).toBe("Conservar texto");
      expect(vm.attachments).toEqual([staged]); expect(vm.activeId).toBeNull();
    }
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    await act(async () => input.dispatchEvent(tab)); expect(tab.defaultPrevented).toBe(false);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-picker="speed"]')!.click());
    const fast = [...host.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(el => el.textContent?.includes("Fast"));
    expect(fast).toBeTruthy(); await act(async () => fast!.click());
    expect(vm.conversationOptions.snapshot().speed).toBe("fast");
  } finally { await act(async () => root.unmount()); host.remove(); }
});


it("does not invent historical members from a shared legacy team or descendant assignments", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  chatUiState.patchPane("claude", { activeId: null, currentProjectId: "root", currentAgentId: null, draft: "", attachments: [] });
  const list = vi.mocked(assistantAgentsApi.list), original = list.getMockImplementation()!;
  list.mockImplementation(async query => [...await original(query), ...["legacy-only", "child-only", "removed-here"].map(id => ({
    id, name: id, providerId: "claude", teamId: "team", model: "",
    context: { projectId: "root", membership: id === "removed-here" ? "removed" : "none" },
    capabilities: { canExecute: false },
    assignments: [{ projectId: id === "removed-here" ? "root" : "child", status: id === "removed-here" ? "removed" : "active", source: "legacy" }],
  } as import("../assistant-api").AssistantAgent))]);
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host); let vm!: ChatPaneVM;
  function Probe() { vm = useChatPane({ provider: "claude", mode: "api", active: true }); return createElement(ChatMain, { vm, attachmentImages: new Map() }); }
  try {
    await act(async () => root.render(createElement(Probe)));
    expect(vm.historicalProjectAgents.map(agent => agent.id)).toEqual(["removed-here"]);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-picker="agent"]')!.click());
    const options = [...document.querySelectorAll('[role="option"]')].map(node => node.textContent);
    expect(options.some(text => text?.includes("legacy-only"))).toBe(false);
    expect(options.some(text => text?.includes("child-only"))).toBe(false);
    expect(options.some(text => text?.includes("removed-here"))).toBe(true);
    expect(vm.projectTeamAgents.map(agent => agent.id).sort()).toEqual(["agent", "other-provider", "worker"]);
  } finally { await act(async () => root.unmount()); host.remove(); list.mockImplementation(original); }
});
