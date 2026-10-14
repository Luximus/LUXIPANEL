import type { AssistantProject } from "../assistant-api";

/** Display names from the root project to the chat's own project. */
export function projectLocation(projectId: string | null | undefined, projects: AssistantProject[]): string[] {
  if (!projectId) return [];
  const byId = new Map(projects.map((project) => [project.id, project]));
  const names: string[] = [];
  const visited = new Set<string>();
  let id: string | null | undefined = projectId;
  while (id && !visited.has(id)) {
    const project = byId.get(id);
    if (!project) break;
    visited.add(id);
    names.unshift(project.title);
    id = project.parentId;
  }
  return names;
}
