import { expect, it } from "vitest";
import { assignedInProject, availableInProject, emptyMarketFilters, filterMarket, legacyHistoryAgentIds } from "./agent-market-state";
import { projectForAgent } from "./project-modal/agent-scope";
import type { AssistantAgent, AssistantProject } from "./assistant-api";
const agent = { id: "a", name: "Ana", description: "Auditoría de datos", specialty: "Seguridad", technologies: ["PostgreSQL"], providerId: "codex", roleId: "security", teamId: "other-team", projectIds: ["wrong-first", "root"], capabilities: { canExecute: true }, context: { projectId: "child", membership: "inherited" } } as AssistantAgent;
it("searches all catalog fields accent-insensitively and combines filters", () => {
  for (const query of ["ana", "auditoria", "seguridad", "POSTGRESQL", "Ana datos"]) expect(filterMarket([agent], { ...emptyMarketFilters, query, provider: "codex", role: "security", assignment: "assigned" }, "child")).toEqual([agent]);
  expect(filterMarket([agent], { ...emptyMarketFilters, provider: "claude" }, "child")).toEqual([]);
  expect(filterMarket([agent], { ...emptyMarketFilters, technology: "mysql" }, "child")).toEqual([]);
});
it("uses contextual membership independently of global teams", () => {
  expect(assignedInProject(agent, "child")).toBe(true); expect(assignedInProject(agent, "root")).toBe(false);
  expect(availableInProject({ ...agent, relation: "shared" }, "child")).toBe(true);
  expect(availableInProject({ ...agent, capabilities: { ...agent.capabilities!, canExecute: false } }, "child")).toBe(false);
});
it("keeps removed agents historical even when a legacy team still matches", () => {
  const removed = { ...agent, context: { ...agent.context!, membership: "removed" as const } };
  expect(availableInProject(removed, "child")).toBe(false);
  expect(filterMarket([removed], { ...emptyMarketFilters, assignment: "unassigned" }, "child")).toEqual([removed]);
});
it("never guesses the first attached project and keeps the selected child", () => {
  const projects = [{ id: "wrong-first" }, { id: "root" }, { id: "child", parentId: "root" }] as AssistantProject[];
  expect(projectForAgent(agent, projects, "child")?.id).toBe("child");
  expect(projectForAgent(agent, projects, "root")).toBeNull();
  expect(projectForAgent(agent, projects)).toBeNull();
});
it("includes legacy inboxes only in an unambiguous original root", () => {
  const roots = [{ id: "root", teamId: "other-team" }];
  expect(legacyHistoryAgentIds([agent], roots, "root")).toEqual(["a"]);
  expect(legacyHistoryAgentIds([agent], [...roots, { id: "other", teamId: "other-team" }], "root")).toEqual([]);
});
