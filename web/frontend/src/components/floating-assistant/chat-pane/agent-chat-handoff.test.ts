// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useChatPane, type ChatPaneProps, type ChatPaneVM } from "./use-chat-pane";
import { chatUiState } from "../chat-ui-state";
import { ChatSidebar } from "./ChatSidebar";

const legacy = vi.hoisted(() => ({ id: "legacy", title: "Buzón antiguo", provider: "claude", projectId: null, agentId: "agent", preview: "", messageCount: 0 }));
const conversationApi = vi.hoisted(() => ({
  list: vi.fn(async (...args: Parameters<typeof import("../assistant-api/conversations").assistantConversationsApi.list>) => ({ items: args[6]?.agentId ? [legacy] : [], total: 1, summary: { agents: { agent: 1 }, projects: {} } })),
  get: vi.fn(async () => legacy),
  messages: vi.fn(async () => ({ items: [], total: 0, hasMore: false })),
  session: vi.fn(async () => ({ sessionId: null })),
  context: vi.fn(async () => ({ enabled: false })),
  markReviewed: vi.fn(async () => {}),
}));

vi.mock("../assistant-api", async original => ({
  ...await original<Record<string, unknown>>(),
  assistantProjectsApi: { list: vi.fn().mockResolvedValue([
    { id: "root", title: "Root", teamId: "team" }, { id: "child", title: "Child", parentId: "root" },
  ]) },
  assistantAgentsApi: { list: vi.fn().mockResolvedValue([{ id: "agent", teamId: "team", name: "Mateo", providerId: "claude", model: "" }]) },
  assistantAgentRolesApi: { list: vi.fn().mockResolvedValue([]) },
  assistantConversationsApi: conversationApi,
}));
vi.mock("../assistant-api/conversations", async original => ({
  ...await original<Record<string, unknown>>(),
  assistantConversationsApi: conversationApi,
}));

it("keeps an incoming agent and child on initial mount and provider activation", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  const root = createRoot(host);
  let vm!: ChatPaneVM;
  function Probe(props: ChatPaneProps) { vm = useChatPane(props); return null; }
  const props: ChatPaneProps = { provider: "claude", mode: "api", active: true, openProjectId: "child", openAgentId: "agent", openNonce: 1 };
  try {
    await act(async () => { root.render(createElement(Probe, props)); });
    expect(vm.currentAgentId).toBe("agent");
    expect(vm.currentProjectId).toBe("child");
    expect(vm.selectedModel).toBe("");
    expect(chatUiState.getPane("claude").currentAgentId).toBe("agent");
    await act(async () => { root.render(createElement(Probe, { ...props, active: false })); });
    chatUiState.patchPane("claude", { activeId: null, currentAgentId: null, currentProjectId: null });
    await act(async () => { root.render(createElement(Probe, { ...props, openNonce: 2 })); });
    expect(vm.currentAgentId).toBe("agent");
    expect(vm.currentProjectId).toBe("child");
    expect(vm.selectedModel).toBe("");
  } finally { await act(async () => root.unmount()); }
});

it("does not lose the team sidebar when late metadata opens a loaded legacy mailbox", async () => {
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
    await act(async () => { vm.toggleConvAgentGroup("agent"); });
    expect(vm.convos.some(c => c.id === legacy.id)).toBe(true);
    await act(async () => { await vm.openConversation(legacy.id); });
    expect(vm.currentProjectId).toBe("child");
    expect(vm.activeMeta?.projectId).toBeNull();
    expect(vm.currentAgentId).toBe("agent");
    expect(host.querySelectorAll("[data-agent-group]")).toHaveLength(1);
  } finally { await act(async () => root.unmount()); }
});
