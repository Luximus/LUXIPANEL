import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createProjectAgentHistory, emptyAgentHistory, GENERAL_HISTORY } from "./project-agent-history";
import { ProjectAgentConvos } from "./ProjectAgentConvos";
import type { ConversationMeta } from "../assistant-api/conversations";
import type { AssistantAgent } from "../assistant-api";

const chat = (id: string, agentId: string | null, projectId: string | null, provider = "codex"): ConversationMeta => ({ id, title: id, preview: "", provider, agentId, projectId, messageCount: 2 });
const rows = [chat("one", "a", "root"), chat("two", "a", "child", "claude"), chat("legacy", "a", null), chat("worker", "b", "root"), chat("general", null, "child"), chat("removed", "gone", "root"), chat("foreign", "a", "elsewhere"), chat("unrelated", "z", null)];
function fixture(includeLegacy = true, query = "") {
  const list = vi.fn(async (q = "", limit = 50, _offset = 0, _provider?: string, _project?: string | null, _withAgent?: boolean, options?: any) => {
    const filtered = rows.filter(c => options.projectIds.includes(c.projectId ?? "none") && (options.agentId === undefined || c.agentId === options.agentId) && (!options.agentIds || options.agentIds.includes(c.agentId ?? "none")) && (!q || c.title.includes(q)));
    const agents: Record<string, number> = {};
    for (const c of filtered) agents[c.agentId ?? "none"] = (agents[c.agentId ?? "none"] ?? 0) + 1;
    // Tiny server pages exercise independent cursors and the aggregate counts.
    const start = Number(options.cursor ?? 0), end = start + Math.min(1, limit);
    return { items: filtered.slice(start, end), total: filtered.length, hasMore: end < filtered.length, nextCursor: end < filtered.length ? String(end) : null, ...(options.includeSummary ? { summary: { agents, projects: {} } } : {}) };
  });
  let state = emptyAgentHistory();
  const controller = createProjectAgentHistory({ projectIds: ["root", "child"], agentIds: ["a", "b"], includeLegacy, query }, value => { state = value; }, list);
  return { controller, list, state: () => state };
}

describe("project agent history", () => {
  it("keeps each member's cursor, providers and legacy mailbox within the team root", async () => {
    const { controller, state, list } = fixture();
    await controller.first();
    expect(state().counts).toMatchObject({ a: 3, b: 1, [GENERAL_HISTORY]: 2 });
    expect(state().groups.a).toBeUndefined();
    await controller.group("a");
    await controller.group("b");
    await controller.next("a");
    await controller.next("a");
    expect(state().groups.a.items.map(c => c.id)).toEqual(["one", "two", "legacy"]);
    expect(state().groups.a.items.map(c => c.provider)).toContain("claude");
    expect(state().groups.b.items.map(c => c.id)).toEqual(["worker"]);
    await controller.next(GENERAL_HISTORY);
    expect(state().groups[GENERAL_HISTORY].items.map(c => c.id)).toEqual(["general", "removed"]);
    expect(state().items.some(c => ["foreign", "unrelated"].includes(c.id))).toBe(false);
    expect(list.mock.calls.every(args => args[3] === undefined)).toBe(true);
  });
  it("does not guess ownership for ambiguous teams and filters counts by search", async () => {
    const { controller, state } = fixture(false, "two");
    await controller.first();
    await controller.group("a");
    expect(state().counts.a).toBe(1);
    expect(state().groups.a.items.map(c => c.id)).toEqual(["two"]);
    expect(state().groups[GENERAL_HISTORY]).toBeUndefined();
    await controller.group("z");
    expect(state().groups.z).toBeUndefined();
  });
  it("rejects late summary responses after a target/search is abandoned", async () => {
    let resolve!: (page: any) => void;
    const list = vi.fn(() => new Promise<any>(done => { resolve = done; }));
    const publish = vi.fn();
    const controller = createProjectAgentHistory({ projectIds: ["root"], agentIds: ["a"], includeLegacy: false, query: "" }, publish, list);
    const pending = controller.first();
    controller.cancel();
    publish.mockClear();
    resolve({ items: [], total: 0, summary: { agents: { a: 999 }, projects: {} } });
    await pending;
    expect(publish).not.toHaveBeenCalled();
  });
  it("exposes failed summary reads and recovers on refresh", async () => {
    const { controller, list, state } = fixture();
    list.mockRejectedValueOnce(new Error("unavailable"));
    await controller.first();
    expect(state().error).toBeInstanceOf(Error);
    expect(state().initialized).toBe(false);
    await controller.first(true);
    expect(state().error).toBeNull();
    expect(state().counts.a).toBe(3);
  });
  it("renders every team member as a flat collapsible, including empty agents", () => {
    const agents = [{ id: "a", name: "Marin" }, { id: "b", name: "Mateo" }] as AssistantAgent[];
    const history = { ...emptyAgentHistory(), initialized: true, counts: { a: 2, b: 0 } };
    const html = renderToStaticMarkup(createElement(ProjectAgentConvos, { agents, history, expanded: new Set<string>(), onToggle() {}, onNewChat() {}, onLoadMore() {}, onRetry() {}, rolesById: new Map(), rowProps: { activeId: null, agentById: new Map(), projectTitleById: new Map(), onOpen() {}, onDelete() {}, onRename() {}, onTogglePin() {} } }));
    expect(html).toContain("Agentes IA");
    expect(html.match(/data-agent-group=/g)).toHaveLength(2);
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(2);
    expect(html).toContain("Marin");
    expect(html).toContain("Mateo");
    expect(html).not.toContain("LICENCIAS");
  });
});
