import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { summarizeAgentActivity, useAgentShortcutActivity } from "./use-agent-shortcut-activity";
import { assistantConversationsApi, type ConversationActivity } from "../assistant-api/conversations";

const target = vi.hoisted(() => ({ id: "first" }));
vi.mock("@/lib/api-client", async original => ({ ...await original<Record<string, unknown>>(),
  resolveTargetScope: () => target.id, scopeHeaders: () => ({ "X-Target": target.id }) }));
vi.mock("../chat-engine", () => ({ chatEngine: { subscribe: () => () => {}, getVersion: () => 0,
  get: () => undefined, isBackgroundRunning: () => false, isWorkerTaskRunning: () => false, hasPendingPermission: () => false } }));
afterEach(() => { vi.restoreAllMocks(); target.id = "first"; });

it("refreshes unread counts after review only while the shortcuts are visible", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const api = vi.spyOn(assistantConversationsApi, "activity")
    .mockResolvedValueOnce([{ id: "chat", agentId: "a", unreadCount: 3, unreviewed: true }])
    .mockResolvedValue([{ id: "chat", agentId: "a", unreadCount: 0, unreviewed: false }]);
  let state!: ReturnType<typeof useAgentShortcutActivity>;
  function Probe({ visible }: { visible: boolean }) { state = useAgentShortcutActivity(["project"], ["a"], visible); return null; }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(createElement(Probe, { visible: true })));
    expect(state.activity.get("a")?.unreadCount).toBe(3);
    await act(async () => window.dispatchEvent(new Event("lxp:assistant:conversation-reviewed")));
    expect(state.activity.get("a")?.unreadCount).toBe(0);
    expect(api).toHaveBeenCalledTimes(2);
    await act(async () => root.render(createElement(Probe, { visible: false })));
    await act(async () => window.dispatchEvent(new Event("lxp:assistant:conversation-reviewed")));
    expect(api).toHaveBeenCalledTimes(2);
    await act(async () => root.render(createElement(Probe, { visible: true })));
    expect(api).toHaveBeenCalledTimes(3);
  } finally { await act(async () => root.unmount()); }
});

it("counts messages across chats and prioritizes attention and running over finished results", () => {
  const result = summarizeAgentActivity([
    { id: "1", agentId: "a", unreviewed: true, unreadCount: 4, lastReplyState: "done" },
    { id: "2", agentId: "a", unreviewed: true, unreadCount: 2, lastReplyState: "failed" },
    { id: "3", agentId: "a", running: true },
    { id: "4", agentId: "b", running: true, pendingPermission: true },
    { id: "5", agentId: "b", unreviewed: true }, // old metadata has one known unread reply
    { id: "6", agentId: "c", unreviewed: false, unreadCount: 8, lastReplyState: "failed" },
  ]);
  expect(result.get("a")).toEqual({ state: "running", unreadCount: 6 });
  expect(result.get("b")).toEqual({ state: "waiting", unreadCount: 1 });
  expect(result.get("c")).toEqual({ state: "available", unreadCount: 0 });
});

it("queries legacy activity only for its owners and deduplicates overlapping results", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const row = { id: "owned", agentId: "owner", unreadCount: 2, unreviewed: true };
  const api = vi.spyOn(assistantConversationsApi, "activity")
    .mockResolvedValueOnce([row, { id: "shared-project", agentId: "shared", unreadCount: 1, unreviewed: true }])
    .mockResolvedValueOnce([row]);
  let state!: ReturnType<typeof useAgentShortcutActivity>;
  function Probe() {
    state = useAgentShortcutActivity(["root", "child"], ["owner", "shared"], true, ["owner", "outside"]);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(createElement(Probe)));
    expect(api).toHaveBeenNthCalledWith(1, ["child", "root"], ["owner", "shared"]);
    expect(api).toHaveBeenNthCalledWith(2, ["none"], ["owner"]);
    expect(state.activity.get("owner")?.unreadCount).toBe(2);
    expect(state.activity.get("shared")?.unreadCount).toBe(1);
  } finally { await act(async () => root.unmount()); }
});

it("hides the previous target immediately and ignores its pending response", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let resolveOld!: (rows: ConversationActivity[]) => void;
  const api = vi.spyOn(assistantConversationsApi, "activity").mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce([{ id: "new-target", agentId: "a", unreadCount: 1, unreviewed: true }]);
  let state!: ReturnType<typeof useAgentShortcutActivity>;
  function Probe() { state = useAgentShortcutActivity(["same-project"], ["a"], true); return null; }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(createElement(Probe)));
    target.id = "second";
    await act(async () => window.dispatchEvent(new Event("luxipanel:target-changed")));
    expect(api).toHaveBeenCalledTimes(2);
    await act(async () => resolveOld([{ id: "old-target", agentId: "a", unreadCount: 20, unreviewed: true }]));
    expect(state.activity.get("a")?.unreadCount).toBe(1);
  } finally { await act(async () => root.unmount()); }
});

it("discards late data after changing project and treats failed reads as unknown", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let finish!: (rows: ConversationActivity[]) => void;
  const api = vi.spyOn(assistantConversationsApi, "activity").mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce([{ id: "new-chat", agentId: "b", unreadCount: 2, unreviewed: true }]);
  let state!: ReturnType<typeof useAgentShortcutActivity>;
  function Probe({ project, agent }: { project: string; agent: string }) { state = useAgentShortcutActivity([project], [agent], true); return null; }
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(createElement(Probe, { project: "old", agent: "a" })));
    expect(state.loading).toBe(true);
    await act(async () => root.render(createElement(Probe, { project: "new", agent: "b" })));
    expect(state.activity.get("b")?.unreadCount).toBe(2);
    await act(async () => finish([{ id: "old-chat", agentId: "a", unreviewed: true, unreadCount: 7 }]));
    expect(state.activity.has("a")).toBe(false);
    expect(api).toHaveBeenLastCalledWith(["new"], ["b"]);
    api.mockRejectedValueOnce(new Error("No response"));
    await act(async () => window.dispatchEvent(new Event("lxp:assistant:conversations-updated")));
    expect(state.error).toBe(true);
    expect(state.activity.size).toBe(0);
    api.mockResolvedValueOnce([]);
    await act(async () => window.dispatchEvent(new Event("luxipanel:session-started")));
    expect(state.error).toBe(false);
    expect(state.activity.size).toBe(0);
  } finally { await act(async () => root.unmount()); }
});
