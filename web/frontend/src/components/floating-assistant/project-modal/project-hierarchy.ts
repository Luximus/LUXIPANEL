// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantProject } from "../assistant-api";
import { isProjectPathWithinRoot } from "./project-path";

export function hierarchyRoot(project: AssistantProject, projects: AssistantProject[]): AssistantProject {
  const byId = new Map(projects.map((item) => [item.id, item]));
  const seen = new Set<string>();
  let current = project;
  while (current.parentId && byId.has(current.parentId) && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.parentId)!;
  }
  return current;
}

export function hierarchyIds(root: AssistantProject, projects: AssistantProject[]): Set<string> {
  const ids = new Set([root.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of projects) {
      if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
        ids.add(item.id);
        changed = true;
      }
    }
  }
  return ids;
}

export function sortedSiblings(parentId: string, projects: AssistantProject[]): AssistantProject[] {
  const siblings = projects.filter((item) => item.parentId === parentId);
  const alphabetical = [...siblings].sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const defaultRanks = new Map(alphabetical.map((item, index) => [item.id, index * 1024]));
  return siblings.sort((a, b) => (a.sortOrder ?? defaultRanks.get(a.id)!) - (b.sortOrder ?? defaultRanks.get(b.id)!)
    || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

export function mayReparent(node: AssistantProject, parent: AssistantProject, root: AssistantProject, projects: AssistantProject[]): boolean {
  return node.id !== root.id && node.id !== parent.id && hierarchyIds(node, projects).has(parent.id) === false
    && hierarchyIds(root, projects).has(parent.id)
    && (node.parentId === parent.id || isProjectPathWithinRoot(node.path, parent.path));
}

/** One persisted rank changes a node's position without rewriting its siblings. */
export function rankForInsertion(node: AssistantProject, parentId: string, beforeId: string | null, projects: AssistantProject[]): number | null {
  const siblings = sortedSiblings(parentId, projects).filter((item) => item.id !== node.id);
  const original = [...projects.filter((item) => item.parentId === parentId && item.id !== node.id), node]
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const defaults = new Map(original.map((item, index) => [item.id, index * 1024]));
  const index = beforeId === null ? siblings.length : siblings.findIndex((item) => item.id === beforeId);
  if (index < 0) return null;
  const before = siblings[index - 1];
  const after = siblings[index];
  const low = before ? (before.sortOrder ?? defaults.get(before.id)!) : null;
  const high = after ? (after.sortOrder ?? defaults.get(after.id)!) : null;
  if (low === null && high === null) return 0;
  if (low === null) return high! - 1024;
  if (high === null) return low + 1024;
  return high - low > 0.000001 ? (low + high) / 2 : null;
}
