// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { createPagedList } from "@/lib/paged-list";
import { assistantConversationsApi, type ConversationMeta } from "../assistant-api/conversations";

type Summary = { projects: Record<string, number>; agents: Record<string, number> };
export type ProjectHistoryState = {
  initialized: boolean;
  items: ConversationMeta[];
  loading: boolean;
  error: unknown;
  hasMore: boolean;
  summary: Summary | null;
  searchStatus?: { state: string; indexed: number; total: number };
};
export const emptyProjectHistory = (): ProjectHistoryState => ({ initialized: false, items: [], loading: false, error: null, hasMore: false, summary: null });

/** Project folders keep their own cursors, all constrained to the selected
 * member, root and search. Legacy mailboxes use a separate, team-bounded query
 * so including them cannot expose other projects' loose chats. */
export function createProjectHistory(
  scope: { projectIds: string[]; agentId?: string; legacyAgentIds: string[]; query: string; projectIdsFor: (id: string) => string[] },
  publish: (state: ProjectHistoryState) => void,
  list = assistantConversationsApi.list,
) {
  // No selected member means unassigned chats, including inside projects.
  // Apply the filter at the API so search, counts and every cursor agree.
  const withAgent = scope.agentId ? undefined : false;
  const managers = new Map<string, ReturnType<typeof createPagedList<ConversationMeta>>>();
  const summaries = new Map<string, Summary>();
  let generation = 0;
  let fresh = false;
  let current = "root";
  let initialized = false;
  let searchStatus: ProjectHistoryState["searchStatus"];
  const emit = () => {
    const states = [...managers.values()].map(manager => manager.get());
    const rows = new Map(states.flatMap(state => state.items).map(row => [row.id, row]));
    const summary: Summary = { projects: {}, agents: {} };
    for (const item of summaries.values()) for (const kind of ["projects", "agents"] as const) {
      for (const [id, count] of Object.entries(item[kind])) summary[kind][id] = (summary[kind][id] ?? 0) + count;
    }
    publish({ initialized, items: [...rows.values()].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.id.localeCompare(b.id)),
      loading: states.some(state => state.loading), error: states.find(state => state.error)?.error ?? null,
      hasMore: states.some(state => state.hasMore), summary: summaries.size ? summary : null, searchStatus });
  };
  const get = (id: string) => {
    let manager = managers.get(id);
    if (manager) return manager;
    const epoch = generation;
    manager = createPagedList<ConversationMeta>(async ({ limit, offset, cursor }) => {
      const page = await list(scope.query, limit, offset, undefined, undefined, withAgent, {
        cursor, fresh,
        projectIds: id === "legacy" ? ["none"] : id === "root" ? scope.projectIds : scope.projectIdsFor(id),
        ...(id === "legacy" ? { agentIds: scope.legacyAgentIds } : scope.agentId ? { agentId: scope.agentId } : {}),
        includeSummary: !cursor && (id === "root" || id === "legacy"), summaryScope: "filtered",
      });
      if (epoch !== generation) throw new Error("History scope changed");
      if (id === "root") searchStatus = page.searchStatus;
      if ((id === "root" || id === "legacy") && page.summary) summaries.set(id, page.summary);
      return page;
    }, () => { if (epoch === generation) emit(); });
    managers.set(id, manager);
    return manager;
  };
  return {
    async first(refresh = false) {
      const epoch = ++generation;
      for (const manager of managers.values()) manager.cancel();
      managers.clear(); summaries.clear(); searchStatus = undefined; initialized = false; fresh = refresh; current = "root";
      emit();
      await get("root").first();
      if (epoch !== generation) return;
      if (scope.agentId && scope.legacyAgentIds.length) await get("legacy").first();
      if (epoch !== generation) return;
      initialized = true;
      emit();
    },
    group(id: string) {
      if (!initialized || !scope.projectIds.includes(id)) return Promise.resolve();
      current = id;
      const existing = managers.get(id);
      if (existing && !existing.get().error) return Promise.resolve();
      return get(id).first();
    },
    next() {
      const preferred = managers.get(current);
      const manager = preferred?.get().hasMore ? preferred : [...managers.values()].find(item => item.get().hasMore);
      return manager?.next() ?? Promise.resolve();
    },
    closeGroup: () => { current = "root"; },
    cancel: () => { generation++; for (const manager of managers.values()) manager.cancel(); },
  };
}
