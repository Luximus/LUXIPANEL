// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { createPagedList, type ListState } from "@/lib/paged-list";
import { assistantConversationsApi, type ConversationMeta } from "../assistant-api/conversations";

export const GENERAL_HISTORY = "__general__";
export type ProjectAgentHistoryState = {
  initialized: boolean;
  loading: boolean;
  error: unknown;
  counts: Record<string, number>;
  groups: Record<string, ListState<ConversationMeta>>;
  items: ConversationMeta[];
  searchStatus?: { state: string; indexed: number; total: number };
};
export const emptyAgentHistory = (): ProjectAgentHistoryState => ({ initialized: false, loading: false, error: null, counts: {}, groups: {}, items: [] });

/** One cursor per agent, all providers, bounded by the owning root's subtree.
 * Legacy project-less mailboxes are included only for unambiguously owned teams.
 * No chat is migrated or rebound as a side effect of reading the sidebar. */
export function createProjectAgentHistory(
  scope: { projectIds: string[]; agentIds: string[]; includeLegacy: boolean; query: string },
  publish: (state: ProjectAgentHistoryState) => void,
  list = assistantConversationsApi.list,
) {
  let state = emptyAgentHistory();
  let generation = 0;
  let fresh = false;
  let generalIds: string[] = [];
  const members = new Set(scope.agentIds);
  const managers = new Map<string, ReturnType<typeof createPagedList<ConversationMeta>>>();
  const emit = () => {
    const groups = Object.fromEntries([...managers].map(([id, manager]) => [id, manager.get()]));
    const rows = new Map(Object.values(groups).flatMap(g => g.items).map(c => [c.id, c]));
    state = { ...state, groups, items: [...rows.values()].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.id.localeCompare(b.id)) };
    publish(state);
  };
  const group = (id: string, retry = false) => {
    if (!state.initialized || (id !== GENERAL_HISTORY && !members.has(id))) return Promise.resolve();
    let manager = managers.get(id);
    if (manager && !retry) return Promise.resolve();
    if (!manager) {
      const epoch = generation;
      manager = createPagedList<ConversationMeta>(request => list(scope.query, request.limit, request.offset, undefined, undefined, undefined, {
        cursor: request.cursor, fresh,
        projectIds: id !== GENERAL_HISTORY && scope.includeLegacy ? [...scope.projectIds, "none"] : scope.projectIds,
        ...(id === GENERAL_HISTORY ? { agentIds: generalIds } : { agentId: id }),
      }), () => { if (epoch === generation) emit(); });
      managers.set(id, manager);
    }
    return manager.first();
  };
  return {
    async first(refresh = false) {
      const epoch = ++generation;
      for (const manager of managers.values()) manager.cancel();
      managers.clear();
      fresh = refresh;
      state = { ...emptyAgentHistory(), loading: true };
      emit();
      try {
        const root = await list(scope.query, 1, 0, undefined, undefined, undefined, { projectIds: scope.projectIds, includeSummary: true, summaryScope: "filtered", fresh });
        if (epoch !== generation) return;
        const legacy = scope.includeLegacy && members.size ? await list(scope.query, 1, 0, undefined, undefined, undefined, { projectIds: ["none"], agentIds: scope.agentIds, includeSummary: true, summaryScope: "filtered", fresh }) : null;
        if (epoch !== generation) return;
        const counts = { ...root.summary?.agents };
        generalIds = ["none", ...Object.keys(counts).filter(id => id !== "none" && !members.has(id))];
        counts[GENERAL_HISTORY] = generalIds.reduce((sum, id) => sum + (counts[id] ?? 0), 0);
        for (const [id, count] of Object.entries(legacy?.summary?.agents ?? {})) counts[id] = (counts[id] ?? 0) + count;
        state = { ...state, initialized: true, loading: false, counts, searchStatus: root.searchStatus };
        emit();
        if (counts[GENERAL_HISTORY]) await group(GENERAL_HISTORY);
      } catch (error) {
        if (epoch !== generation) return;
        state = { ...state, loading: false, error };
        emit();
      }
    },
    group,
    next: (id: string) => managers.get(id)?.next() ?? Promise.resolve(),
    cancel: () => { generation++; state = { ...state, initialized: false }; for (const manager of managers.values()) manager.cancel(); },
  };
}
