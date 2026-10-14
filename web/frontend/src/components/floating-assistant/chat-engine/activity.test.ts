import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ runs: vi.fn(), tasks: vi.fn() }));
vi.mock("../assistant-api", () => ({ listActiveRuns: api.runs, teamApi: { listActive: api.tasks }, assistantConversationsApi: { markReviewed: vi.fn(async () => {}) } }));
vi.mock("./resume-poll", () => ({ startBackgroundPoll: vi.fn(), stopBackgroundPoll: vi.fn() }));
vi.mock("@/lib/assistant-ws", () => ({ markAssistantTeamTaskSeen: vi.fn() }));
import { chatEngine } from "../chat-engine";
import { applyEvent } from "./stream-apply";
import { chats, backgroundActive, backgroundPending, backgroundWorkerRunning, unreviewedBackground } from "./state";

function start() {
  chats.set("chat", { provider: "claude", conversationId: "chat", streaming: true,
    turns: [{ role: "assistant", text: "", pending: true, tools: [], permission: { id: "p", tool: "exec", title: "Approve" } }] });
}
beforeEach(() => { api.runs.mockResolvedValue([]); api.tasks.mockResolvedValue([]); });
afterEach(() => {
  chats.clear(); backgroundActive.clear(); backgroundPending.clear(); backgroundWorkerRunning.clear(); unreviewedBackground.clear();
  chatEngine.setActiveView(null); vi.clearAllMocks();
});
it("clears completed runs and approvals immediately despite an older server mirror", async () => {
  start(); api.runs.mockResolvedValue([{ id: "chat", provider: "claude", cli: false, pendingPermission: true }]);
  await chatEngine.refreshBackgroundRuns();
  expect(chatEngine.hasPendingPermission("chat")).toBe(true);
  applyEvent("chat", { type: "permission_resolved", id: "p", decision: "allow" }, { isCli: false, startedAt: 0 });
  expect(chatEngine.hasPendingPermission("chat")).toBe(false);
  applyEvent("chat", { type: "done" }, { isCli: false, startedAt: 0 });
  chats.set("chat", { ...chats.get("chat")!, streaming: false, unreviewed: false });
  expect(chatEngine.isBackgroundRunning("chat")).toBe(false);
  expect(chatEngine.hasAnyPendingPermission()).toBe(false);
  expect(chatEngine.isUnreviewed("chat", true)).toBe(false);
});
it("coalesces slow reads and cannot resurrect a run that finished during the request", async () => {
  start(); backgroundActive.set("chat", { provider: "claude", cli: false });
  let resolve!: (runs: unknown[]) => void;
  api.runs.mockImplementation(() => new Promise(r => { resolve = r; }));
  const first = chatEngine.refreshBackgroundRuns(), duplicate = chatEngine.refreshBackgroundRuns();
  expect(api.runs).toHaveBeenCalledOnce();
  applyEvent("chat", { type: "done" }, { isCli: false, startedAt: 0 });
  chats.set("chat", { ...chats.get("chat")!, streaming: false });
  resolve([{ id: "chat", cli: false, pendingPermission: true }]);
  await Promise.all([first, duplicate]);
  expect(chatEngine.isBackgroundRunning("chat")).toBe(false);
  expect(chatEngine.hasPendingPermission("chat")).toBe(false);
});
it("keeps the last successful status on failure and marks unseen completion on a valid empty snapshot", async () => {
  api.runs.mockResolvedValue([{ id: "other", cli: false }]); await chatEngine.refreshBackgroundRuns();
  api.runs.mockRejectedValue(new Error("offline")); await chatEngine.refreshBackgroundRuns();
  expect(chatEngine.isBackgroundRunning("other")).toBe(true);
  expect(chatEngine.isUnreviewed("other")).toBe(false);
  api.runs.mockResolvedValue([]); await chatEngine.refreshBackgroundRuns();
  expect(chatEngine.isBackgroundRunning("other")).toBe(false);
  expect(chatEngine.isUnreviewed("other")).toBe(true);
  chatEngine.setActiveView("other");
  expect(chatEngine.isUnreviewed("other")).toBe(false);
});
