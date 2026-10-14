// SPDX-License-Identifier: AGPL-3.0-only
/** Presentation only: permission IDs and selections remain unchanged. */
export type PermissionLabelKind = "sidebar" | "views" | "actions" | "commands";
export type PermissionLabelCatalog = {
  modules: { module: string; label: string; sidebar: string[]; views: string[]; actions: string[] }[];
  commandGroups: string[];
  descriptions?: Record<string, string>;
};
export type PermissionLabelMessages = {
  templates: Record<string, string>;
  modules: Record<string, string>;
  operations: Record<string, string>;
  actions: Record<string, string>;
  columns: Record<string, string>;
  commandGroups: Record<string, string>;
};
function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
export function permissionModuleLabel(id: string, catalog: PermissionLabelCatalog, messages: PermissionLabelMessages): string {
  return messages.modules[id] ?? catalog.modules.find(module => module.module === id)?.label ?? id;
}
export function formatPermissionLabel(id: string, catalog: PermissionLabelCatalog, messages: PermissionLabelMessages, kind?: PermissionLabelKind): string {
  kind ??= id.startsWith("panel.") ? "views" : id.includes(".") ? "actions" : catalog.modules.some(module => module.sidebar.includes(id)) ? "sidebar" : "commands";
  if (kind === "commands") return interpolate(messages.templates.commands, { group: messages.commandGroups[id] ?? catalog.descriptions?.[id] ?? id });
  if (kind === "actions" && messages.actions[id]) return messages.actions[id];
  const owner = kind === "views" ? id.slice("panel.".length) : kind === "sidebar" ? id : id.split(".")[0];
  const module = permissionModuleLabel(owner, catalog, messages);
  if (kind === "sidebar" || kind === "views") return interpolate(messages.templates[kind], { module });
  const parts = id.split(".");
  const operation = parts.at(-1)!;
  if (parts[1] === "col") return interpolate(messages.templates.columns, { module, column: messages.columns[operation] ?? operation });
  if (!messages.operations[operation]) return catalog.descriptions?.[id] ?? `${module}: ${parts.slice(1).join(" / ")}`;
  // Preserve intermediate scopes for extensions declaring nested action IDs.
  return interpolate(messages.templates.actions, { operation: messages.operations[operation], module: parts.length > 2 ? `${module} · ${parts.slice(1, -1).join(" / ")}` : module });
}
