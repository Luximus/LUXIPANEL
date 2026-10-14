export type ProjectNode = { id: string; parentId?: string | null };

/** Ruta visible del chat, desde la raíz hasta su propio subproyecto. */
export function projectLocation<T extends ProjectNode & { title?: string; name?: string }>(id: string | null | undefined, projects: T[]): string[] {
  if (!id) return [];
  const byId = new Map(projects.map((project) => [project.id, project]));
  const names: string[] = [];
  const seen = new Set<string>();
  let current: string | null | undefined = id;
  while (current && !seen.has(current)) {
    const project = byId.get(current);
    if (!project) break;
    seen.add(current);
    names.unshift(project.name ?? project.title ?? project.id);
    current = project.parentId;
  }
  return names;
}

/** El selector del chat muestra la raíz aunque el chat pertenezca a un hijo. */
export function rootProjectId(id: string | null | undefined, projects: ProjectNode[]): string | null {
  if (!id) return null;
  const byId = new Map(projects.map((project) => [project.id, project]));
  if (!byId.has(id)) return id;
  const seen = new Set<string>();
  let current = id;
  while (!seen.has(current)) {
    seen.add(current);
    const parent = byId.get(current)?.parentId;
    if (!parent || !byId.has(parent) || seen.has(parent)) return current;
    current = parent;
  }
  return current;
}

/** Misma cobertura de la web: raíz seleccionada y todos sus descendientes. */
export function projectScopeIds(id: string, projects: ProjectNode[]): string[] {
  const ids = new Set([id]);
  let added = true;
  while (added) {
    added = false;
    for (const project of projects) {
      if (project.parentId && ids.has(project.parentId) && !ids.has(project.id)) {
        ids.add(project.id);
        added = true;
      }
    }
  }
  return [...ids];
}

export function rootProjects<T extends ProjectNode>(projects: T[]): T[] {
  const ids = new Set(projects.map((project) => project.id));
  return projects.filter((project) => !project.parentId || !ids.has(project.parentId) || project.parentId === project.id);
}
