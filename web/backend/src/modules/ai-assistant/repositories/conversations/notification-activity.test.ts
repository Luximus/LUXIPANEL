// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, expect, it, vi } from "vitest";
import type { Executor } from "../../../../shared/executor/index.js";
import type { ConversationMessage, ConversationMeta } from "./types.js";
const state = vi.hoisted(() => ({ user: "one", read: vi.fn(), tasks: vi.fn() }));
vi.mock("./stores.js", () => ({ readMessagesAny: state.read }));
vi.mock("../team-tasks.repository.js", () => ({ teamTasksRepository: { listAll: state.tasks } }));
vi.mock("../../../../shared/executor/context.js", () => ({ getContextUserId: () => state.user }));
import { notificationActivity, userNotificationActivity } from "./notification-activity.js";

const message = (role: ConversationMessage["role"], extra: Partial<ConversationMessage> = {}): ConversationMessage => ({ role, content: "Private content", ts: "now", ...extra });
const meta = (extra: Partial<ConversationMeta> = {}): ConversationMeta => ({ id: "chat", title: "Private title", preview: "Private preview", provider: "codex", messageCount: 4, agentId: "a", unreadCount: 2, unreviewed: true, ...extra });
const target = (id: string) => ({ target: { id } }) as Executor;
beforeEach(() => { state.user = "one"; state.read.mockReset(); state.tasks.mockReset().mockResolvedValue([]); });

it("excludes legacy assignments missing auto and their continuations using worker provenance", () => {
  const messages = [message("user"), message("assistant"), message("user", { auto: true }), message("assistant")];
  const before = structuredClone(messages);
  expect(userNotificationActivity(meta(), messages, true)).toMatchObject({ unreadCount: 0, unreviewed: false });
  // The same unflagged messages in a human chat must still notify its owner.
  expect(userNotificationActivity(meta(), messages)).toMatchObject({ unreadCount: 2 });
  expect(messages).toEqual(before);
});

it("ignores an exact legacy assignment replay but not a later human request with the same text", () => {
  const assignment = message("user", { ts: "1" });
  const messages = [assignment, message("assistant"), { ...assignment }, message("assistant")];
  expect(userNotificationActivity(meta(), messages, true)).toMatchObject({ unreadCount: 0 });
  messages.push({ ...assignment, ts: "2" }, message("assistant"), message("user", { auto: true }), message("assistant"));
  expect(userNotificationActivity(meta({ unreadCount: 4 }), messages, true)).toMatchObject({ unreadCount: 2 });
});

it("gives explicit request audience precedence over the legacy auto flag and task membership", () => {
  expect(userNotificationActivity(meta(), [message("user", { replyAudience: "agent" }), message("assistant")]))
    .toMatchObject({ unreadCount: 0 });
  expect(userNotificationActivity(meta(), [message("user", { replyAudience: "user" }), message("assistant")], true))
    .toMatchObject({ unreadCount: 1 });
});

it("preserves human requests after compacted worker history without treating them as initial assignments", () => {
  const messages = [message("assistant", { compacted: true }), message("user", { ts: "later" }), message("assistant")];
  expect(userNotificationActivity(meta(), messages, true)).toMatchObject({ unreadCount: 1 });
  expect(userNotificationActivity(meta(), [message("assistant")], true)).toMatchObject({ unreadCount: 0 });
});

it("excludes old worker replies and mailboxes, regardless of their prose", () => {
  const row = userNotificationActivity(meta(), [message("user", { auto: true }), message("assistant"), message("assistant")]);
  expect(row).toMatchObject({ unreadCount: 0, unreviewed: false });
  expect(row.lastReplyState).toBeUndefined();
});

it("keeps the leader's automatic continuations addressed to the human", () => {
  expect(userNotificationActivity(meta(), [message("user"), message("assistant"), message("user", { auto: true }), message("assistant")]))
    .toMatchObject({ unreadCount: 2, unreviewed: true, lastReplyState: "done" });
});

it("counts a direct human follow-up inside a worker conversation", () => {
  expect(userNotificationActivity(meta(), [message("user", { auto: true }), message("assistant"), message("user"), message("assistant")]))
    .toMatchObject({ unreadCount: 1, unreviewed: true });
});

it("excludes explicit internal answers inside a conversation that also has user replies", () => {
  const messages = [message("user"), message("assistant"), message("user", { auto: true, replyAudience: "agent" }), message("assistant", { error: "Internal failure" })];
  expect(userNotificationActivity(meta(), messages)).toMatchObject({ unreadCount: 1, lastReplyState: "done" });
  expect(userNotificationActivity(meta({ unreadCount: 1 }), messages)).toMatchObject({ unreadCount: 0, unreviewed: false });
});

it("uses explicit answer audience after compaction, and preserves subsequent continuations", () => {
  const messages = [message("assistant", { compacted: true }), message("assistant", { replyAudience: "agent" }), message("assistant", { replyAudience: "user" }), message("user", { auto: true }), message("assistant")];
  expect(userNotificationActivity(meta({ unreadCount: 3 }), messages)).toMatchObject({ unreadCount: 2 });
});

it("clears reviewed replies and does not invent unread messages without history", () => {
  expect(userNotificationActivity(meta({ unreviewed: false }), [message("assistant")])).toMatchObject({ unreadCount: 0, unreviewed: false });
  expect(userNotificationActivity(meta(), [])).toMatchObject({ unreadCount: 0, unreviewed: false });
  expect(userNotificationActivity(meta({ unreadCount: undefined }), [message("user"), message("assistant")])).toMatchObject({ unreadCount: 1 });
});

it("keeps pending decisions and user errors visible without a badge for internal output", () => {
  expect(userNotificationActivity(meta({ lastReplyState: "waiting" }), [message("user", { auto: true }), message("assistant", { pending: true })]))
    .toMatchObject({ unreadCount: 0, lastReplyState: "waiting" });
  expect(userNotificationActivity(meta(), [message("user"), message("assistant", { error: "Error" })])).toMatchObject({ unreadCount: 1, lastReplyState: "failed" });
});

it("caches only projected counts and separates target and user", async () => {
  state.read.mockResolvedValue([message("user"), message("assistant")]);
  const rows = await notificationActivity(target("scope-a"), [meta()]);
  await notificationActivity(target("scope-a"), [meta()]);
  expect(state.read).toHaveBeenCalledTimes(1);
  expect(rows[0]).not.toHaveProperty("content");
  expect(rows[0]).not.toHaveProperty("preview");
  await notificationActivity(target("scope-b"), [meta()]);
  state.user = "two";
  await notificationActivity(target("scope-a"), [meta()]);
  expect(state.read).toHaveBeenCalledTimes(3);
});

it("refreshes changed history and immediately clears reviewed counters", async () => {
  state.read.mockResolvedValue([message("user"), message("assistant")]);
  await notificationActivity(target("refresh"), [meta()]);
  const reviewed = await notificationActivity(target("refresh"), [meta({ unreviewed: false, unreadCount: 0 })]);
  expect(reviewed[0]?.unreadCount).toBe(0);
  expect(state.read).toHaveBeenCalledTimes(1);
  await notificationActivity(target("refresh"), [meta({ updatedAt: "new", unreadCount: 3 })]);
  expect(state.read).toHaveBeenCalledTimes(2);
});

it.each(["pending", "running", "done", "failed", "canceled"])("uses %s task provenance with one board lookup per projection", async status => {
  state.tasks.mockResolvedValue([{ workerConversationId: "chat", workerAgentId: "a", userId: "one", status }]);
  state.read.mockResolvedValue([message("user"), message("assistant")]);
  const executor = target(`task-${status}`);
  const rows = await notificationActivity(executor, [meta(), meta({ id: "direct" })]);
  expect(rows.map(row => row.unreadCount)).toEqual([0, 1]);
  expect(state.tasks).toHaveBeenCalledExactlyOnceWith(executor);
});

it("does not infer task membership from another principal or another agent", async () => {
  state.tasks.mockResolvedValue([
    { workerConversationId: "chat", workerAgentId: "a", userId: "two" },
    { workerConversationId: "wrong-agent", workerAgentId: "b", userId: "one" },
  ]);
  state.read.mockResolvedValue([message("user"), message("assistant")]);
  const rows = await notificationActivity(target("task-isolation"), [meta(), meta({ id: "wrong-agent" })]);
  expect(rows.map(row => row.unreadCount)).toEqual([1, 1]);
});

it("invalidates cached counts when task provenance appears without changing the transcript", async () => {
  state.read.mockResolvedValue([message("user"), message("assistant")]);
  const executor = target("task-cache");
  expect((await notificationActivity(executor, [meta()]))[0]?.unreadCount).toBe(1);
  state.tasks.mockResolvedValue([{ workerConversationId: "chat", workerAgentId: "a" }]);
  expect((await notificationActivity(executor, [meta()]))[0]?.unreadCount).toBe(0);
  expect(state.read).toHaveBeenCalledTimes(2);
});

it("does not read the board or transcripts when all conversations are reviewed", async () => {
  expect((await notificationActivity(target("reviewed"), [meta({ unreviewed: false, unreadCount: 0 })]))[0]?.unreadCount).toBe(0);
  expect(state.tasks).not.toHaveBeenCalled();
  expect(state.read).not.toHaveBeenCalled();
});

it("propagates board failures and retries rather than inventing a human notification", async () => {
  state.tasks.mockRejectedValueOnce(new Error("Target did not respond"));
  await expect(notificationActivity(target("board-failure"), [meta()])).rejects.toThrow("Target did not respond");
  expect(state.read).not.toHaveBeenCalled();
  state.tasks.mockResolvedValue([{ workerConversationId: "chat", workerAgentId: "a", userId: "one" }]);
  state.read.mockResolvedValue([message("user"), message("assistant")]);
  expect((await notificationActivity(target("board-failure"), [meta()]))[0]?.unreadCount).toBe(0);
});

it("propagates unread-history failures and retries them instead of reporting zero", async () => {
  state.read.mockRejectedValueOnce(new Error("Target did not respond"));
  await expect(notificationActivity(target("failure"), [meta()])).rejects.toThrow("Target did not respond");
  state.read.mockResolvedValueOnce([message("user"), message("assistant")]);
  expect((await notificationActivity(target("failure"), [meta()]))[0]?.unreadCount).toBe(1);
});
