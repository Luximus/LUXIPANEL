export interface ModuleSurface { module: string; label: string; sidebar: string[]; views: string[]; actions: string[] }
export interface GroupTemplate {
  sidebar: string[]; views: string[]; actions: string[];
  fileAccess: { allowAll: false; allowPaths: string[]; denyPaths: string[]; readOnlyPaths: string[]; defaultPath: string | null };
  commandPolicy: { allowAll: boolean; groups: string[]; allowCommands: string[]; denyCommands: string[] };
}
export const baseGroupTemplate = (): GroupTemplate => ({
  sidebar: ["dashboard", "preferences"], views: ["panel.dashboard", "panel.preferences"], actions: [],
  fileAccess: { allowAll: false, allowPaths: ["."], denyPaths: [], readOnlyPaths: [], defaultPath: "." },
  commandPolicy: { allowAll: false, groups: [], allowCommands: [], denyCommands: [] },
});

/** Removing a module keeps permissions also granted by another selected module. */
export function setModuleSelection(template: GroupTemplate, selected: string[], surface: ModuleSurface, enabled: boolean, catalog: ModuleSurface[]): string[] {
  const next = enabled ? [...new Set([...selected, surface.module])] : selected.filter(m => m !== surface.module);
  for (const field of ["sidebar", "views", "actions"] as const) {
    const retained = new Set(catalog.filter(m => next.includes(m.module)).flatMap(m => m[field]));
    if (field === "sidebar") ["dashboard", "preferences"].forEach(id => retained.add(id));
    if (field === "views") ["panel.dashboard", "panel.preferences"].forEach(id => retained.add(id));
    template[field] = enabled
      ? [...new Set([...template[field], ...surface[field]])]
      : template[field].filter(id => !surface[field].includes(id) || retained.has(id));
  }
  return next;
}
