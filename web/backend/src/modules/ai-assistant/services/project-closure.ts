import type { AssistantProject } from "../repositories/projects.repository.js";

/**
 * Transitive closure of a set of project ids: the roots themselves plus EVERY
 * descendant (children, grandchildren, …) reachable through `parentId`.
 *
 * This is the authority behind "which projects does an agent own": an agent
 * attaches PARENT projects (`agent.projectIds`) and implicitly owns the whole
 * subtree under each. It is deliberately DESCENDING only — an agent never
 * reaches an ancestor (that is how the `/var/www` monorepo root would leak into
 * a scope that only asked for one subproject).
 *
 * Cycle-safe: a project whose `parentId` chain loops back on itself is visited
 * once and dropped from the queue (the `seen` set is the guard).
 */
export function projectClosure(allProjects: AssistantProject[], rootIds: readonly string[]): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const p of allProjects) {
    if (!p.parentId || !p.id) continue;
    const arr = childrenOf.get(p.parentId) ?? [];
    arr.push(p.id);
    childrenOf.set(p.parentId, arr);
  }
  const closure = new Set<string>();
  const queue = [...new Set(rootIds)];
  while (queue.length > 0) {
    const pid = queue.shift()!;
    if (!pid || closure.has(pid)) continue;
    closure.add(pid);
    for (const child of childrenOf.get(pid) ?? []) queue.push(child);
  }
  return closure;
}

/** The projects of a closure, in `allProjects` order, skipping ids with no project. */
export function projectsOfClosure(allProjects: AssistantProject[], closure: Set<string>): AssistantProject[] {
  return allProjects.filter((p) => p.id && closure.has(p.id));
}
