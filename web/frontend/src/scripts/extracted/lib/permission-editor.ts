import { formatPermissionLabel, permissionModuleLabel as moduleLabel, type PermissionLabelKind } from "@/lib/permission-labels";
import { getPermissionLabelMessages } from "@/lib/permission-label-messages";
export type PolicyCatalog = { modules: { module: string; label: string; sidebar: string[]; views: string[]; actions: string[] }[]; commandGroups: string[]; descriptions?: Record<string, string>; actionMetadata?: Record<string, { adminOnly: boolean; labelKey: string }> };
export function permissionLabel(id: string, catalog: PolicyCatalog, kind?: PermissionLabelKind): string {
  return formatPermissionLabel(id, catalog, getPermissionLabelMessages(document.documentElement.lang || "en"), kind);
}
export function permissionModuleLabel(id: string, catalog: PolicyCatalog): string {
  return moduleLabel(id, catalog, getPermissionLabelMessages(document.documentElement.lang || "en"));
}
export function renderPolicyMatrix(root: HTMLElement, catalog: PolicyCatalog, policy: { sidebar: string[]; views: string[]; actions: string[] }, hosting = false): void {
  root.replaceChildren();
  for (const module of catalog.modules) {
    if (hosting && (module.module === "admin" || module.actions.length > 0 && module.actions.every(id => catalog.actionMetadata?.[id]?.adminOnly))) continue;
    const details = document.createElement("details"); details.className = "rounded-lg border border-border p-3";
    const summary = document.createElement("summary"); summary.textContent = permissionModuleLabel(module.module, catalog); summary.className = "cursor-pointer text-sm font-medium"; details.append(summary);
    const content = document.createElement("div"); content.className = "mt-3 grid gap-2 sm:grid-cols-2";
    for (const field of ["sidebar", "views", "actions"] as const) for (const id of module[field]) {
      const label = document.createElement("label"); label.className = "flex items-start gap-2 text-xs";
      const input = document.createElement("input"); input.type = "checkbox"; input.dataset.policyField = field; input.value = id; input.checked = policy[field].includes(id);
      input.disabled = field === "actions" && !!catalog.actionMetadata?.[id]?.adminOnly;
      if (input.disabled) { input.checked = false; label.classList.add("opacity-50"); }
      const text = document.createElement("span"); text.textContent = permissionLabel(id, catalog, field);
      const code = document.createElement("small"); code.textContent = id; code.className = "block font-mono text-muted-foreground"; text.append(code);
      label.append(input, text); content.append(label);
    }
    details.append(content); root.append(details);
  }
}
export function collectPolicyMatrix(root: HTMLElement) {
  const read = (field: string) => [...root.querySelectorAll<HTMLInputElement>(`input[data-policy-field="${field}"]:checked:not(:disabled)`)].map(x => x.value);
  return { version: 2 as const, sidebar: read("sidebar"), views: read("views"), actions: read("actions") };
}
