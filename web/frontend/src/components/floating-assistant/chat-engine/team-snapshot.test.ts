// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const io = vi.hoisted(() => ({
  scope: "target-a",
  get: vi.fn(async (_path: string): Promise<{ ok: boolean; status: number; data: unknown }> => ({
    ok: true, status: 200, data: { tasks: [], items: [], feedback: [] },
  })),
}));
vi.mock("@/lib/api-client", async original => {
  const actual = await original<typeof import("@/lib/api-client")>();
  return { ...actual, resolveTargetScope: () => io.scope, api: { ...actual.api, get: io.get } };
});
vi.mock("@/lib/assistant-ws", () => ({ markAssistantTeamTaskSeen: vi.fn() }));
vi.mock("./resume-poll", () => ({ startBackgroundPoll: vi.fn(), stopBackgroundPoll: vi.fn() }));

import { TeamTaskBoard } from "../TeamTaskBoard";
import { assistantMessagesFallback, formatAssistantMessage } from "../i18n";
import type { ConversationTeamTasksSnapshot, TeamTaskDiff, TeamTaskSnapshot } from "../assistant-api/team";
import { chatEngine } from "../chat-engine";
import { chats } from "./state";
import { applyEvent } from "./stream-apply";

const key = "cold-leader";
const labels = assistantMessagesFallback.teamBoard;
const row = (overrides: Partial<TeamTaskSnapshot> = {}): TeamTaskSnapshot => ({
  taskId: "task", leaderConversationId: key, title: "Revisar interfaz",
  assigneeAgentId: "worker", assigneeName: "Revisora", state: "done",
  childConversationId: "worker-chat", planId: null, stepIndex: null,
  pendingPermission: false, error: null, createdAt: "2026-10-17T00:00:00Z",
  startedAt: null, finishedAt: "2026-10-17T00:01:00Z",
  ...overrides,
});
const detailed = (): TeamTaskSnapshot => row({
  artifacts: { filesChangedTotal: 2, insertions: 5, deletions: 1 },
  verify: { state: "passed", attempts: 1 },
  isolation: { mode: "lease", branch: "developer", integrated: true },
});
const snapshot = (task: TeamTaskSnapshot): ConversationTeamTasksSnapshot => ({
  conversationId: key, total: 1, completed: task.state === "done" ? 1 : 0,
  terminal: ["done", "failed", "canceled"].includes(task.state) ? 1 : 0,
  planId: null, plan: null, tasks: [task],
});
const diff: TeamTaskDiff = {
  taskId: "task", branch: "developer", filesChangedTotal: 2,
  filesChanged: [
    { path: "sample.ts", status: "M", insertions: 5, deletions: 1 },
    { path: "sample.test.ts", status: "A", insertions: 0, deletions: 0 },
  ],
  diff: "@@ -1 +1 @@\n-old\n+verified", truncated: false, source: "preview",
};
const jsonResponse = (data: unknown) => ({ ok: true, status: 200, data: JSON.parse(JSON.stringify(data)) });
let stored: ConversationTeamTasksSnapshot;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  io.scope = "target-a";
  stored = snapshot(detailed());
  io.get.mockReset();
  io.get.mockImplementation(async path => {
    if (path.endsWith("/team-tasks")) return jsonResponse(stored);
    if (path.endsWith("/diff")) return jsonResponse({ ok: true, ...diff });
    return jsonResponse({ summary: null, feedback: [], items: [], tasks: [] });
  });
  chats.clear();
  chats.set(key, { provider: "openai", conversationId: key, streaming: false, turns: [] });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  chats.clear();
  vi.restoreAllMocks();
});
async function renderBoard() {
  await act(async () => root.render(createElement(TeamTaskBoard, {
    conversationId: key, tasks: chatEngine.teamTasksOf(key), onOpenChat: vi.fn(), embedded: true,
  })));
}
const diffButton = () => [...host.querySelectorAll<HTMLButtonElement>("button")]
  .find(button => button.textContent?.trim() === labels.viewDiff);

it("opens persisted file differences and shows verification after a cold JSON snapshot", async () => {
  expect(chatEngine.teamTasksOf(key)).toEqual([]);
  await chatEngine.refreshTeamTasks(key);
  expect(io.get).toHaveBeenCalledWith("/api/ai/conversations/cold-leader/team-tasks");
  const [task] = chatEngine.teamTasksOf(key);
  expect(task?.artifacts).toEqual({ filesChangedTotal: 2, insertions: 5, deletions: 1 });
  expect(task?.verify).toEqual({ state: "passed", attempts: 1 });
  expect(task?.isolation).toEqual({ mode: "lease", branch: "developer", integrated: true });
  await renderBoard();
  expect(host.textContent).toContain(formatAssistantMessage(labels.filesChanged, { count: 2 }));
  expect(host.querySelector('[title="passed"]')?.textContent).toContain(labels.verifyPassed);
  expect(host.querySelector('[title="' + labels.branchIntegrated + '"]')?.textContent).toContain("developer");
  expect(diffButton()).toBeDefined();
  await act(async () => diffButton()!.click());
  expect(io.get).toHaveBeenCalledWith("/api/ai/team/tasks/task/diff");
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain("sample.ts");
  expect(dialog?.textContent).toContain("sample.test.ts");
  expect(dialog?.textContent).toContain("+verified");
});

it("keeps old snapshots usable without inventing files, verification or isolation", async () => {
  stored = snapshot(row());
  await chatEngine.refreshTeamTasks(key);
  const [task] = chatEngine.teamTasksOf(key);
  expect(task?.status).toBe("done");
  for (const field of ["artifacts", "verify", "isolation"]) expect(task).not.toHaveProperty(field);
  await renderBoard();
  expect(diffButton()).toBeUndefined();
  expect(host.querySelector('[title="passed"]')).toBeNull();
});

it.each([undefined, false, true])("preserves zero counters and token flags: overBudget=%s", async overBudget => {
  const artifacts: NonNullable<TeamTaskSnapshot["artifacts"]> = {
    filesChangedTotal: 0, insertions: 0, deletions: 0,
    tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimated: false,
      ...(overBudget === undefined ? {} : { overBudget }) },
  };
  stored = snapshot(row({ artifacts, isolation: { mode: "none" } }));
  await chatEngine.refreshTeamTasks(key);
  const [task] = chatEngine.teamTasksOf(key);
  expect(task?.artifacts).toEqual(artifacts);
  expect(task?.isolation).toEqual({ mode: "none" });
  expect(task?.isolation).not.toHaveProperty("integrated");
  await renderBoard();
  expect(diffButton()).toBeUndefined();
});

it.each(["running", "passed", "failed", "skipped"] as const)(
  "retains the recorded verification state without promoting %s to success", async state => {
    const taskState = state === "running" ? "running" : state === "passed" ? "done" : "failed";
    const verify = { state, attempts: state === "skipped" ? 0 : 2 };
    stored = snapshot(row({ state: taskState, verify,
      ...(taskState === "failed" ? { error: "Resultado pendiente de corrección" } : {}) }));
    await chatEngine.refreshTeamTasks(key);
    const [task] = chatEngine.teamTasksOf(key);
    expect(task?.status).toBe(taskState);
    expect(task?.verify).toEqual(verify);
    expect(task?.error).toBe(stored.tasks[0]!.error ?? undefined);
    await renderBoard();
    if (state !== "skipped") expect(host.querySelector('[title="' + state + '"]')).not.toBeNull();
    if (state !== "passed") expect(host.querySelector('[title="passed"]')).toBeNull();
  },
);

it("retains richer live details when an old snapshot omits the optional blocks", async () => {
  await chatEngine.refreshTeamTasks(key);
  const [before] = chatEngine.teamTasksOf(key);
  stored = snapshot(row());
  await chatEngine.refreshTeamTasks(key);
  const [after] = chatEngine.teamTasksOf(key);
  expect(after?.artifacts).toEqual(before?.artifacts);
  expect(after?.verify).toEqual(before?.verify);
  expect(after?.isolation).toEqual(before?.isolation);
});

it("adopts updated recorded details when no newer live event arrived", async () => {
  await chatEngine.refreshTeamTasks(key);
  stored = snapshot(row({
    state: "failed", artifacts: { filesChangedTotal: 0 },
    verify: { state: "failed", attempts: 2 }, isolation: { mode: "worktree", branch: "review" },
  }));
  await chatEngine.refreshTeamTasks(key);
  const [task] = chatEngine.teamTasksOf(key);
  expect(task?.status).toBe("failed");
  expect(task?.artifacts).toEqual({ filesChangedTotal: 0 });
  expect(task?.verify).toEqual({ state: "failed", attempts: 2 });
  expect(task?.isolation).toEqual({ mode: "worktree", branch: "review" });
});

it.each(["target", "conversation", "newer-event"])(
  "ignores stale snapshot details after a %s change", async change => {
    await chatEngine.refreshTeamTasks(key);
    let finish!: (value: ReturnType<typeof jsonResponse>) => void;
    io.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const reading = chatEngine.refreshTeamTasks(key);
    if (change === "target") io.scope = "target-b";
    else if (change === "conversation") chats.set(key, { ...chats.get(key)!, conversationId: "other-chat" });
    else applyEvent(key, { type: "team_task_update", task: {
      ...chatEngine.teamTasksOf(key)[0]!, status: "failed",
      artifacts: { filesChangedTotal: 3, insertions: 7, deletions: 0 },
      verify: { state: "failed", attempts: 3 }, isolation: { mode: "none" },
    } }, { isCli: false, startedAt: 0 });
    const current = chats.get(key)!.teamTasks;
    finish(jsonResponse(snapshot(row({
      artifacts: { filesChangedTotal: 99 }, verify: { state: "passed", attempts: 1 },
      isolation: { mode: "lease", branch: "stale", integrated: true },
    }))));
    await reading;
    expect(chats.get(key)?.teamTasks).toEqual(current);
  },
);
