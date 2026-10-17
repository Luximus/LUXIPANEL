// SPDX-License-Identifier: AGPL-3.0-only
import type { AssistantAgent } from "./assistant-api";

export type MarketFilters = { query: string; provider: string; role: string; assignment: string; technology: string };
export const emptyMarketFilters: MarketFilters = { query: "", provider: "", role: "", assignment: "", technology: "" };
const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim();
export function assignedInProject(agent: AssistantAgent, projectId?: string | null): boolean {
  return !!projectId && agent.context?.projectId === projectId &&
    (agent.context.membership === "direct" || agent.context.membership === "inherited");
}
export function availableInProject(agent: AssistantAgent, projectId?: string | null): boolean {
  return assignedInProject(agent, projectId) && agent.capabilities?.canExecute === true;
}
export function filterMarket(agents: AssistantAgent[], filters: MarketFilters, projectId?: string): AssistantAgent[] {
  const words = fold(filters.query).split(/\s+/).filter(Boolean);
  return agents.filter(agent => {
    const text = fold([agent.name, agent.description, agent.specialty, ...(agent.technologies ?? [])].join(" "));
    return words.every(word => text.includes(word)) && (!filters.provider || agent.providerId === filters.provider) &&
      (!filters.role || agent.roleId === filters.role) &&
      (!filters.technology || (agent.technologies ?? []).some(tag => fold(tag) === fold(filters.technology))) &&
      (!filters.assignment || !projectId || assignedInProject(agent, projectId) === (filters.assignment === "assigned"));
  });
}

/** Display legacy inboxes only when their original team identifies one root.
 * This is a history compatibility rule, never permission to launch a run. */
export function legacyHistoryAgentIds(agents: AssistantAgent[], projects: { id: string; parentId?: string | null; teamId?: string | null }[], rootId: string): string[] {
  return agents.filter(agent => {
    const roots = agent.teamId ? projects.filter(project => !project.parentId && project.teamId === agent.teamId) : [];
    return roots.length === 1 && roots[0].id === rootId;
  }).map(agent => agent.id);
}
