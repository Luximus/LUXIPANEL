import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assistantAgentsApi, assistantAgentRolesApi, assistantConversationsApi, assistantProjectsApi, type AssistantProject } from "../assistant-api";
import { useChatPaneDerived } from "./use-chat-pane-derived";
import type { useChatPaneState } from "./use-chat-pane-state";
import type { ChatPaneActions } from "./vm-types";

const projects = [{ id: "root", title: "Proyecto existente", icon: "folder", path: "/work" }] as AssistantProject[];
const noop = () => {};
const initialState = {
  activeId: null, activeConvMeta: null, agents: [], roles: [], attachments: [],
  chatKey: "new", chatLoading: false, compacting: false, convScope: "loose",
  conversationsSectionOpen: true, convos: [], ct: {}, currentAgentId: null,
  draft: "", leaderConv: null, live: null, modalProject: null, projectsSectionOpen: false,
  search: "", streaming: false, turns: [],
  contentRef: { current: null }, scrollerRef: { current: null },
  textareaRef: { current: null }, stickToBottomRef: { current: true },
  setAgents: noop, setAttachError: noop, setCompacting: noop, setConvos: noop,
  setCtx: noop, setCurrentAgentId: noop, setDraft: noop, setExpandedConvAgents: noop,
  setExpandedConvProjects: noop, setMobileListOpen: noop, setModalProject: noop,
  setRoles: noop, setSlashIndex: noop, setSlashOpen: noop,
};
let root: Root;
let host: HTMLDivElement;

function Harness({ active }: { active: boolean }) {
  const [catalog, setProjects] = useState<AssistantProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const state = { ...initialState, projects: catalog, setProjects, currentProjectId, setCurrentProjectId } as unknown as ReturnType<typeof useChatPaneState>;
  const derived = useChatPaneDerived({ provider: "codex", mode: "cli", active }, state, {} as ChatPaneActions);
  return createElement("div", null, derived.rootProjects.map(p => p.title).join(","));
}

beforeEach(() => {
  vi.spyOn(assistantProjectsApi, "list").mockResolvedValue(projects);
  vi.spyOn(assistantAgentsApi, "list").mockResolvedValue([]);
  vi.spyOn(assistantAgentRolesApi, "list").mockResolvedValue([]);
  vi.spyOn(assistantConversationsApi, "list").mockResolvedValue({ items: [], total: 0, hasMore: false });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

it("loads existing projects for a fresh active chat with the legacy section collapsed", async () => {
  await act(async () => root.render(createElement(Harness, { active: true })));
  expect(assistantProjectsApi.list).toHaveBeenCalledOnce();
  expect(host.textContent).toBe("Proyecto existente");
});

it("waits until an inactive provider pane becomes active", async () => {
  await act(async () => root.render(createElement(Harness, { active: false })));
  expect(assistantProjectsApi.list).not.toHaveBeenCalled();
  await act(async () => root.render(createElement(Harness, { active: true })));
  expect(assistantProjectsApi.list).toHaveBeenCalledOnce();
  expect(host.textContent).toBe("Proyecto existente");
});
