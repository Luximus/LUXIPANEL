// SPDX-License-Identifier: AGPL-3.0-only
export type GraphProject = { id: string; title: string; path: string; parentId?: string | null };
export type GraphIndex = { name: string; root_path: string };

function normalizedPath(path: string): string {
  return path.replace(/\/+$/, "") || "/";
}

export function rootGraphProjects(projects: GraphProject[]): GraphProject[] {
  const visibleIds = new Set(projects.map((project) => project.id));
  return projects
    .filter((project) => !project.parentId || !visibleIds.has(project.parentId))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function indexesForProject(project: GraphProject | undefined, indexes: GraphIndex[]): GraphIndex[] {
  if (!project?.path) return [];
  const root = normalizedPath(project.path);
  return indexes
    .filter((index) => {
      if (!index.name || !index.root_path) return false;
      const path = normalizedPath(index.root_path);
      return path === root || path.startsWith(root === "/" ? root : `${root}/`);
    })
    .sort((a, b) => a.root_path.localeCompare(b.root_path));
}
