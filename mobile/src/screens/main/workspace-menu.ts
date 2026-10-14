import type { NativeSidebarModule } from "../server/native-module-access";

/** Fixed mobile tools in PanelLayout.astro; they are never part of the scrolling catalog. */
export const WORKSPACE_MENU_TOOLS = ["modules", "settings"] as const;

export function workspaceMenuIds(catalog: NativeSidebarModule[], access: ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  return catalog.filter(module => {
    if (module.id === "assistant" || WORKSPACE_MENU_TOOLS.some(id => id === module.id)) return false;
    if (module.showInSidebar === false || !access.has(module.id) || seen.has(module.id)) return false;
    seen.add(module.id);
    return true;
  }).map(module => module.id);
}
