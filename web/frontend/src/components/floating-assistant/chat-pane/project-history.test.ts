import { describe, expect, it, vi } from "vitest";
import { createProjectHistory, emptyProjectHistory } from "./project-history";
import type { assistantConversationsApi, ConversationMeta } from "../assistant-api/conversations";

const chat = (id: string, projectId: string | null, agentId: string | null, provider = "claude"): ConversationMeta => ({
  id, title: id, projectId, agentId, provider, preview: "", messageCount: 1,
});
const rows = [
  ...Array.from({ length: 32 }, (_, i) => chat(`worker-${i}`, i < 16 ? "root" : "nested", "worker", i % 2 ? "codex" : "claude")),
  chat("leader-root", "root", "leader"), chat("general", "child", null), chat("retired", "child", "retired"),
  chat("legacy", null, "worker"), chat("legacy-leader", null, "leader"), chat("loose", null, null),
  chat("unrelated", "other", "worker"), chat("other-team-mailbox", null, "other-member"),
];
function fixture() {
  const list = vi.fn<typeof assistantConversationsApi.list>(async (q, limit = 30, offset = 0, _provider, _project, _withAgent, page) => {
    const matched = rows.filter(row => (!q || row.title.includes(q)) && page!.projectIds!.includes(row.projectId ?? "none")
      && (!page!.agentId || row.agentId === page!.agentId) && (!page!.agentIds || page!.agentIds.includes(row.agentId ?? "none")));
    const start = page?.cursor ? Number(page.cursor) : offset;
    const end = start + limit;
    const summary = { projects: {} as Record<string, number>, agents: {} as Record<string, number> };
    for (const row of matched) {
      summary.projects[row.projectId ?? "none"] = (summary.projects[row.projectId ?? "none"] ?? 0) + 1;
      summary.agents[row.agentId ?? "none"] = (summary.agents[row.agentId ?? "none"] ?? 0) + 1;
    }
    return { items: matched.slice(start, end), total: matched.length, hasMore: end < matched.length,
      nextCursor: end < matched.length ? String(end) : null, ...(page?.includeSummary ? { summary } : {}) };
  });
  let state = emptyProjectHistory();
  const scope = { projectIds: ["root", "child", "nested"], agentId: "worker", legacyAgentIds: ["worker"], query: "",
    projectIdsFor: (id: string) => id === "child" ? ["child", "nested"] : [id] };
  const create = (override = {}) => createProjectHistory({ ...scope, ...override }, next => { state = next; }, list);
  return { list, create, state: () => state };
}

describe("project history filtered by member", () => {
  it("keeps counts for unloaded branches and pages every folder with the selected member across providers", async () => {
    const f = fixture(), history = f.create();
    await history.first();
    expect(f.state().summary?.projects).toEqual({ root: 16, nested: 16, none: 1 });
    expect(f.state().items.some(row => row.projectId === "nested")).toBe(false);
    await history.group("child");
    await history.next();
    while (f.state().hasMore) await history.next();
    expect(f.state().items).toHaveLength(33);
    expect(new Set(f.state().items.map(row => row.provider))).toEqual(new Set(["claude", "codex"]));
    expect(f.state().items.every(row => row.agentId === "worker" && row.id !== "unrelated")).toBe(true);
    expect(f.state().items.find(row => row.id === "legacy")?.projectId).toBeNull();
    for (const args of f.list.mock.calls) {
      expect(args[3]).toBeUndefined();
      expect(args[6]).toMatchObject({ summaryScope: "filtered" });
      expect(args[6]?.projectIds).not.toContain("other");
      if (args[6]?.projectIds?.includes("none")) expect(args[6]?.agentIds).toEqual(["worker"]);
      else expect(args[6]?.agentId).toBe("worker");
    }
    expect(f.list.mock.calls.some(args => args[6]?.cursor === "15" && args[6]?.projectIds?.includes("nested"))).toBe(true);
  });

  it("keeps general, retired and all current members when the member filter is cleared", async () => {
    const f = fixture(), history = f.create({ agentId: undefined, legacyAgentIds: ["worker", "leader"] });
    await history.first();
    while (f.state().hasMore) await history.next();
    const ids = f.state().items.map(row => row.id);
    expect(ids).toEqual(expect.arrayContaining(["leader-root", "general", "retired", "legacy", "legacy-leader"]));
    expect(ids).not.toEqual(expect.arrayContaining(["other-team-mailbox"]));
    expect(ids).not.toContain("loose");
  });

  it("applies search to root, nested and legacy pages and excludes legacy when ownership is ambiguous", async () => {
    const f = fixture(), history = f.create({ query: "worker-", legacyAgentIds: [] });
    await history.first();
    await history.group("child");
    while (f.state().hasMore) await history.next();
    expect(f.list.mock.calls.every(args => args[0] === "worker-")).toBe(true);
    expect(f.list.mock.calls.every(args => !args[6]?.projectIds?.includes("none"))).toBe(true);
    const calls = f.list.mock.calls.length;
    await history.group("other");
    expect(f.list).toHaveBeenCalledTimes(calls);
  });

  it("ignores a late response after target/member changes and never starts its legacy query", async () => {
    const f = fixture();
    let resolve!: (page: Awaited<ReturnType<typeof assistantConversationsApi.list>>) => void;
    f.list.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const previous = f.create();
    const pending = previous.first();
    previous.cancel();
    const next = f.create({ agentId: "leader", legacyAgentIds: ["leader"] });
    await next.first();
    const before = f.state();
    resolve({ items: [rows[0]!], total: 1, summary: { projects: { root: 1 }, agents: { worker: 1 } } });
    await pending;
    expect(f.state()).toBe(before);
    expect(f.list.mock.calls.filter(args => args[6]?.agentIds?.includes("worker"))).toHaveLength(0);
  });

  it("surfaces failures and refreshes only the current scope when retried", async () => {
    const f = fixture();
    f.list.mockRejectedValueOnce(new Error("Unavailable"));
    const history = f.create();
    await history.first();
    expect(f.state().error).toBeInstanceOf(Error);
    await history.first(true);
    expect(f.state().error).toBeNull();
    expect(f.list.mock.calls.at(-1)?.[6]).toMatchObject({ fresh: true, agentIds: ["worker"] });
  });
});
