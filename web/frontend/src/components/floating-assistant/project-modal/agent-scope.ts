// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantAgent, AssistantProject } from "../assistant-api";

export interface ProjectAgentScope {
  project: AssistantProject;
  root: AssistantProject;
  teamId: string;
  projects: AssistantProject[];
}

/** Resolve the owning root, including nested subprojects. Missing ancestors or
 * cycles fail closed: never fall back to another project's team. */
export function projectAgentScope(project: AssistantProject, projects: AssistantProject[]): ProjectAgentScope | null {
  const byId = new Map(projects.map((p) => [p.id, p]));
  byId.set(project.id, project);
  let root = project;
  const visited = new Set<string>();
  while (root.parentId) {
    if (visited.has(root.id)) return null;
    visited.add(root.id);
    const parent = byId.get(root.parentId);
    if (!parent) return null;
    root = parent;
  }
  const ids = new Set([root.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of byId.values()) {
      if (p.parentId && ids.has(p.parentId) && !ids.has(p.id)) {
        ids.add(p.id);
        changed = true;
      }
    }
  }
  return { project, root, teamId: root.teamId ?? "", projects: [...byId.values()].filter((p) => ids.has(p.id)) };
}

/** Only the selected, authorized project can be used to open a new chat.
 * Team identity is retained solely for legacy history display. */
export function projectForAgent(agent: AssistantAgent, projects: AssistantProject[], preferredId?: string): AssistantProject | null {
  const preferred = projects.find((p) => p.id === preferredId);
  if (!preferred || agent.context?.projectId !== preferred.id || !agent.capabilities?.canExecute) return null;
  return agent.context.membership === "direct" || agent.context.membership === "inherited" ? preferred : null;
}
