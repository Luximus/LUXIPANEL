// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  docs: new Map<string, any[]>(), reads: [] as string[], targets: [] as unknown[],
  entries: [] as { name: string; isDir: boolean }[], failure: "",
}));
vi.mock("../../../shared/executor/index.js", () => ({ getContextUserId: () => 7 }));
vi.mock("../../../shared/data-store/index.js", () => ({ dataStore: (executor: unknown, _module: string, collection: string) => {
  state.targets.push(executor);
  return {
    list: async () => { state.reads.push(collection); if (state.failure === collection) throw new Error("unreadable"); return state.docs.get(collection) ?? []; },
    get: async (id: string) => { state.reads.push(collection); if (state.failure === collection) throw new Error("unreadable"); return (state.docs.get(collection) ?? []).find(d => d.id === id) ?? null; },
  };
} }));
import { agentActivityRepository } from "./agent-activity.repository.js";
import { MSG_DOC_ID } from "./conversations/types.js";
const executor = { target: { id: "target-only" }, readdir: vi.fn(async () => state.entries) } as any;
beforeEach(() => { state.docs.clear(); state.reads.length = 0; state.targets.length = 0; state.entries.length = 0; state.failure = ""; executor.readdir.mockResolvedValue(state.entries); });
describe("assignment activity across user namespaces", () => {
  it("detects another user's pending question for a shared legacy profile without returning text", async () => {
    state.entries.push({ name: "conversations-u99.json", isDir: false });
    state.docs.set("conversations-u99", [{ id: "chat", agentId: "a", projectId: "X" }]);
    state.docs.set("conv-u99-chat", [{ id: MSG_DOC_ID, messages: [{ role: "assistant", content: "private", ask: [{ id: "q" }] }] }]);
    const result = await agentActivityRepository.forAssignment(executor, "a", new Set(["X"]));
    expect(result).toEqual([{ conversationId: "chat", pendingQuestion: true, pendingCliJob: false }]);
    expect(JSON.stringify(result)).not.toContain("private");
    expect(state.targets.every(target => target === executor)).toBe(true);
  });
  it("detects surviving CLI work after process restart", async () => {
    state.entries.push({ name: "cli-jobs-u99.json", isDir: false });
    state.docs.set("conversations-u99", [{ id: "chat", agentId: "a", projectId: "X" }]);
    state.docs.set("cli-jobs-u99", [{ conversationId: "chat" }]);
    expect(await agentActivityRepository.forAssignment(executor, "a", new Set(["X"]))).toEqual([
      { conversationId: "chat", pendingQuestion: false, pendingCliJob: true },
    ]);
  });
  it("does not read unrelated transcripts or another project's activity", async () => {
    state.docs.set("conversations-u7", [{ id: "Y", agentId: "a", projectId: "Y" }, { id: "other", agentId: "b", projectId: "X" }]);
    expect(await agentActivityRepository.forAssignment(executor, "a", new Set(["X"]))).toEqual([]);
    expect(state.reads.some(name => name.startsWith("conv-"))).toBe(false);
  });
  it("keeps the legacy split-index transcript readable without repairing it", async () => {
    state.docs.set("conversations-u7", [{ id: "chat", agentId: "a", projectId: null }]);
    state.docs.set("conv-chat", [{ id: MSG_DOC_ID, messages: [{ role: "assistant", ask: [{ id: "q" }] }] }]);
    expect((await agentActivityRepository.forAssignment(executor, "a", new Set(["X"])))[0]?.pendingQuestion).toBe(true);
  });
  it("fails closed on an unreadable namespace or directory", async () => {
    state.failure = "conversations-u7";
    await expect(agentActivityRepository.forAssignment(executor, "a", new Set(["X"]))).rejects.toThrow("unreadable");
    executor.readdir.mockRejectedValueOnce(new Error("no response"));
    await expect(agentActivityRepository.forAssignment(executor, "a", new Set(["X"]))).rejects.toThrow("no response");
  });
  it("blocks unattributable surviving CLI jobs until their metadata is recovered", async () => {
    state.docs.set("cli-jobs-u7", [{ conversationId: "orphan" }]);
    expect((await agentActivityRepository.forAssignment(executor, "a", new Set(["X"])))[0]?.pendingCliJob).toBe(true);
  });
  it("does not treat an answered question as pending", async () => {
    state.docs.set("conversations-u7", [{ id: "chat", agentId: "a", projectId: "X" }]);
    state.docs.set("conv-u7-chat", [{ id: MSG_DOC_ID, messages: [{ role: "assistant", ask: [{ id: "q" }] }, { role: "user", content: "answer" }] }]);
    expect((await agentActivityRepository.forAssignment(executor, "a", new Set(["X"])))[0]?.pendingQuestion).toBe(false);
  });
});
