// Users page — role/group permission catalog + dialog permission editor
// (checklists, module sub-tabs, collect/fill, role-dialog tab switching).
import { escapeHtml } from "/scripts/extracted/lib/escape.js";
import { permissionLabel, permissionModuleLabel } from "/scripts/extracted/lib/permission-editor.js?v=20260930-permission-labels";
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { tabDirectionOf } from "/scripts/extracted/lib/tabs.js";
import { switchView } from "/scripts/extracted/lib/dom.js";
import { t, linesFromTextarea, setTextareaLines } from "./dom";
import { renderPathChips, PATH_TEXTAREA_IDS } from "./path-browser";

export type ModuleCatalogEntry = {
  module: string;
  label: string;
  sidebar: string[];
  views: string[];
  actions: string[];
};

export type PermissionCatalog = {
  actionMetadata?: Record<string, { adminOnly: boolean; labelKey: string }>;
  sidebarItems: string[];
  views: string[];
  actions: string[];
  commandGroups: string[];
  modules: ModuleCatalogEntry[];
  descriptions?: Record<string, string>;
};

/** Friendly description for a permission id (falls back to the raw id). */
export function permDescription(id: string, name?: string): string {
  return permissionLabel(id, permissionCatalog, name === "perm-command-group" ? "commands" : name === "perm-sidebar" ? "sidebar" : name === "perm-view" ? "views" : undefined);
}

export type RolePermissions = {
  version?: 2;
  sidebar: string[];
  views: string[];
  actions: string[];
  fileAccess: {
    allowAll: boolean;
    allowPaths: string[];
    denyPaths: string[];
    readOnlyPaths: string[];
    defaultPath: string | null;
  };
  commandPolicy: {
    allowAll: boolean;
    groups: string[];
    allowCommands: string[];
    denyCommands: string[];
  };
};

const FALLBACK_CATALOG: PermissionCatalog = { sidebarItems: [], views: [], actions: [], commandGroups: [], modules: [] };

export let permissionCatalog: PermissionCatalog = { ...FALLBACK_CATALOG };

function renderPermissionChecklist(containerId: string, inputName: string, values: string[]) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = values
    .map((value) => `
      <label class="flex items-start gap-2 rounded-lg border border-border p-2.5 cursor-pointer hover:bg-accent" title="${value}">
        <input type="checkbox" name="${inputName}" value="${value}" class="mt-0.5 h-3.5 w-3.5 rounded border-input text-primary" />
        <span class="flex flex-col leading-tight">
          <span class="text-xs sm:text-sm">${escapeHtml(permDescription(value, inputName))}</span>
          <small class="text-[10px] font-mono text-muted-foreground/70">${value}</small>
        </span>
      </label>
    `)
    .join("");
}

let catalogLoad: { root: Element | null; scope: string; promise: Promise<void> } | null = null;
let catalogGeneration = 0;

/** Load once for this editor DOM and server, before filling any selections. */
export function loadPermissionCatalog(): Promise<void> {
  const root = document.getElementById("role-module-panes");
  const scope = resolveTargetScope();
  if (catalogLoad?.root === root && catalogLoad.scope === scope) return catalogLoad.promise;
  const promise = fetchPermissionCatalog(root, scope, ++catalogGeneration);
  catalogLoad = { root, scope, promise };
  void promise.catch(() => { if (catalogLoad?.promise === promise) catalogLoad = null; });
  return promise;
}

async function fetchPermissionCatalog(root: Element | null, scope: string, generation: number) {
  const res = await api.get<any>("/api/roles/permission-catalog");
  if (generation !== catalogGeneration) return;
  if (root !== document.getElementById("role-module-panes") || scope !== resolveTargetScope()) {
    catalogLoad = null;
    return;
  }
  if (!res.ok) throw new Error(res.error ?? t("errors.saveFailed", "Error al cargar permisos"));
  permissionCatalog = { ...FALLBACK_CATALOG };
  if (res.ok) {
    const data = (res.data as any)?.items ?? res.data ?? {};
    permissionCatalog = {
      sidebarItems: Array.isArray(data.sidebarItems) ? data.sidebarItems : FALLBACK_CATALOG.sidebarItems,
      views: Array.isArray(data.views) ? data.views : FALLBACK_CATALOG.views,
      actions: Array.isArray(data.actions) ? data.actions : FALLBACK_CATALOG.actions,
      commandGroups: Array.isArray(data.commandGroups) ? data.commandGroups : FALLBACK_CATALOG.commandGroups,
      modules: Array.isArray(data.modules) && data.modules.length > 0 ? data.modules : FALLBACK_CATALOG.modules,
      actionMetadata: data.actionMetadata ?? {},
      descriptions: (data.descriptions && typeof data.descriptions === "object") ? data.descriptions : {},
    };
  }

  renderModulePermissionTabs(permissionCatalog.modules);
  renderPermissionChecklist("perm-command-groups-grid", "perm-command-group", permissionCatalog.commandGroups);
}

function permCheckboxesHtml(name: string, values: string[]): string {
  return values
    .map((v) => `
      <label class="flex items-start gap-2 rounded-lg border border-border p-2 cursor-pointer hover:bg-accent" title="${escapeHtml(v)}">
        <input type="checkbox" name="${name}" value="${escapeHtml(v)}" ${name === "perm-action" && permissionCatalog.actionMetadata?.[v]?.adminOnly ? "disabled data-admin-only" : ""} class="mt-0.5 h-3.5 w-3.5 rounded border-input text-primary" />
        <span class="flex flex-col leading-tight">
          <span class="text-xs">${escapeHtml(permDescription(v, name))}</span>
          <small class="text-[10px] font-mono text-muted-foreground/70">${escapeHtml(v)}</small>
        </span>
      </label>`)
    .join("");
}

function permSectionHtml(title: string, name: string, values: string[]): string {
  if (!values.length) return "";
  // Cada sección lleva un checkbox "seleccionar todo" en su encabezado. Se
  // acota a los checkboxes DENTRO de `[data-perm-section]` (no por `name`,
  // porque perm-action lo comparten varias secciones) y no lleva `name`, así
  // que collectRolePermissions/readChecked lo ignoran.
  return `
    <div class="space-y-1.5" data-perm-section>
      <label class="flex items-center justify-between gap-2 cursor-pointer text-xs font-medium text-muted-foreground" title="${t("labels.selectAll", "Seleccionar todo")}">
        <span>${title}</span>
        <input type="checkbox" data-perm-section-toggle class="h-3.5 w-3.5 rounded border-input text-primary" />
      </label>
      <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">${permCheckboxesHtml(name, values)}</div>
    </div>`;
}

/** Refleja el estado de los checkboxes de una sección en su toggle de
 *  "seleccionar todo" (checked / indeterminate / unchecked). */
export function syncPermSectionToggle(section: HTMLElement) {
  const toggle = section.querySelector<HTMLInputElement>("[data-perm-section-toggle]");
  if (!toggle) return;
  const boxes = Array.from(
    section.querySelectorAll<HTMLInputElement>("input[type='checkbox']:not([data-perm-section-toggle])"),
  );
  const checked = boxes.filter((b) => b.checked).length;
  toggle.checked = boxes.length > 0 && checked === boxes.length;
  toggle.indeterminate = checked > 0 && checked < boxes.length;
}

function syncAllPermSectionToggles() {
  document
    .querySelectorAll<HTMLElement>("#role-module-panes [data-perm-section]")
    .forEach(syncPermSectionToggle);
}

let roleModulePermTab = "";

export function setModulePermTab(mod: string) {
  const prevMod = roleModulePermTab;
  roleModulePermTab = mod;
  const modButtons = document.querySelectorAll<HTMLButtonElement>("[data-mod-tab]");
  const direction = tabDirectionOf(modButtons, (b) => b.dataset.modTab === prevMod, (b) => b.dataset.modTab === mod);
  const panes = Array.from(document.querySelectorAll<HTMLElement>("[data-mod-pane]"));
  switchView(panes, panes.find((p) => p.dataset.modPane === mod), { direction });
  modButtons.forEach((b) => {
    const active = b.dataset.modTab === mod;
    b.className = active
      ? "rounded-lg px-2.5 py-1 text-xs font-medium transition-all bg-card text-foreground shadow-sm"
      : "rounded-lg px-2.5 py-1 text-xs font-medium transition-all text-muted-foreground hover:text-foreground";
  });
}

/** Build one sub-tab per module in the group dialog's "Panel" pane. Checkboxes
 *  keep the names perm-sidebar/perm-view/perm-action so collect/fill are
 *  unchanged. Items not owned by any module land in a "General" tab. */
export function renderModulePermissionTabs(modules: ModuleCatalogEntry[]) {
  const tabsEl = document.getElementById("role-module-tabs");
  const panesEl = document.getElementById("role-module-panes");
  if (!tabsEl || !panesEl) return;

  const usedSidebar = new Set(modules.flatMap((m) => m.sidebar));
  const usedViews = new Set(modules.flatMap((m) => m.views));
  const usedActions = new Set(modules.flatMap((m) => m.actions));
  const leftover: ModuleCatalogEntry = {
    module: "general",
    label: t("permCatalog.general", "General"),
    sidebar: permissionCatalog.sidebarItems.filter((s) => !usedSidebar.has(s)),
    views: permissionCatalog.views.filter((v) => !usedViews.has(v)),
    actions: permissionCatalog.actions.filter((a) => !usedActions.has(a)),
  };

  const entries = [...modules];
  if (leftover.sidebar.length || leftover.views.length || leftover.actions.length) entries.push(leftover);

  tabsEl.innerHTML = entries
    .map((e) => `<button type="button" data-mod-tab="${escapeHtml(e.module)}" class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all text-muted-foreground hover:text-foreground">${escapeHtml(permissionModuleLabel(e.module, permissionCatalog))}</button>`)
    .join("");

  // Action ids that represent toolbar buttons / feature panels (grouped apart
  // from the core file operations and the table-column toggles).
  const BUTTON_PERMS = new Set([
    "files.search", "files.git", "files.history", "files.compare", "files.share",
    "files.security", "files.images", "files.projects", "files.copypath",
    "files.editpath", "files.tabs", "files.config",
  ]);
  panesEl.innerHTML = entries
    .map((e) => {
      // Split actions into well-labeled sub-groups so the dialog isn't a flat
      // list: core actions vs feature buttons vs table-column toggles.
      const colActions = e.actions.filter((a) => a.includes(".col."));
      const btnActions = e.actions.filter((a) => !a.includes(".col.") && BUTTON_PERMS.has(a));
      const opActions = e.actions.filter((a) => !a.includes(".col.") && !BUTTON_PERMS.has(a));
      return `
      <div data-mod-pane="${escapeHtml(e.module)}" class="hidden space-y-3 pt-3">
        ${permSectionHtml(t("labels.permMenu", "Menú"), "perm-sidebar", e.sidebar)}
        ${permSectionHtml(t("labels.permViews", "Vistas / rutas"), "perm-view", e.views)}
        ${permSectionHtml(t("labels.permActions", "Acciones"), "perm-action", opActions)}
        ${permSectionHtml(t("labels.permButtons", "Botones y funciones"), "perm-action", btnActions)}
        ${permSectionHtml(t("labels.permColumns", "Columnas de tabla"), "perm-action", colActions)}
      </div>`;
    })
    .join("");

  if (entries.length > 0) setModulePermTab(entries[0]!.module);
}

export function readChecked(name: string): string[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>(`input[name='${name}']:checked:not(:disabled)`)).map((el) => el.value);
}

export function collectRolePermissions(): RolePermissions {
  return {
    version: 2,
    sidebar: readChecked("perm-sidebar"),
    views: readChecked("perm-view"),
    actions: readChecked("perm-action"),
    fileAccess: {
      allowAll: (document.getElementById("perm-file-allow-all") as HTMLInputElement).checked,
      allowPaths: linesFromTextarea("perm-file-allow-paths"),
      denyPaths: linesFromTextarea("perm-file-deny-paths"),
      readOnlyPaths: linesFromTextarea("perm-file-readonly-paths"),
      defaultPath: (document.getElementById("perm-file-default-path") as HTMLInputElement)?.value.trim() || null,
    },
    commandPolicy: {
      allowAll: (document.getElementById("perm-cmd-allow-all") as HTMLInputElement).checked,
      groups: readChecked("perm-command-group"),
      allowCommands: linesFromTextarea("perm-cmd-allow-list"),
      denyCommands: linesFromTextarea("perm-cmd-deny-list"),
    },
  };
}

export function fillRolePermissions(raw: any) {
  const permissions = raw ?? {};
  const sidebar = Array.isArray(permissions.sidebar) ? permissions.sidebar : [];
  const views = Array.isArray(permissions.views) ? permissions.views : [];
  const actions = Array.isArray(permissions.actions) ? permissions.actions : [];
  const commandGroups = Array.isArray(permissions.commandPolicy?.groups) ? permissions.commandPolicy.groups : [];

  document.querySelectorAll<HTMLInputElement>("input[name='perm-sidebar']").forEach((el) => {
    el.checked = !el.disabled && sidebar.includes(el.value);
  });
  document.querySelectorAll<HTMLInputElement>("input[name='perm-view']").forEach((el) => {
    el.checked = !el.disabled && views.includes(el.value);
  });
  document.querySelectorAll<HTMLInputElement>("input[name='perm-action']").forEach((el) => {
    el.checked = !el.disabled && actions.includes(el.value);
  });
  document.querySelectorAll<HTMLInputElement>("input[name='perm-command-group']").forEach((el) => {
    el.checked = commandGroups.includes(el.value);
  });

  (document.getElementById("perm-file-allow-all") as HTMLInputElement).checked = Boolean(permissions.fileAccess?.allowAll);
  setTextareaLines("perm-file-allow-paths", Array.isArray(permissions.fileAccess?.allowPaths) ? permissions.fileAccess.allowPaths : []);
  setTextareaLines("perm-file-deny-paths", Array.isArray(permissions.fileAccess?.denyPaths) ? permissions.fileAccess.denyPaths : []);
  setTextareaLines("perm-file-readonly-paths", Array.isArray(permissions.fileAccess?.readOnlyPaths) ? permissions.fileAccess.readOnlyPaths : []);
  const defPathEl = document.getElementById("perm-file-default-path") as HTMLInputElement | null;
  if (defPathEl) defPathEl.value = permissions.fileAccess?.defaultPath ?? "";
  PATH_TEXTAREA_IDS.forEach(renderPathChips);

  (document.getElementById("perm-cmd-allow-all") as HTMLInputElement).checked = Boolean(permissions.commandPolicy?.allowAll);
  setTextareaLines("perm-cmd-allow-list", Array.isArray(permissions.commandPolicy?.allowCommands) ? permissions.commandPolicy.allowCommands : []);
  setTextareaLines("perm-cmd-deny-list", Array.isArray(permissions.commandPolicy?.denyCommands) ? permissions.commandPolicy.denyCommands : []);

  syncAllPermSectionToggles();
}

export function resetRolePermissions() {
  fillRolePermissions({
    sidebar: [],
    views: [],
    actions: [],
    fileAccess: { allowAll: false, allowPaths: [], denyPaths: [], readOnlyPaths: [], defaultPath: null },
    commandPolicy: { allowAll: false, groups: [], allowCommands: [], denyCommands: [] },
  });
}

export let roleDialogActiveTab: "general" | "panel" | "server" = "general";

export function setRoleDialogTab(tab: "general" | "panel" | "server") {
  const prevTab = roleDialogActiveTab;
  roleDialogActiveTab = tab;

  const direction = tabDirectionOf(
    document.querySelectorAll<HTMLButtonElement>("[data-role-tab]"),
    (b) => b.dataset.roleTab === prevTab,
    (b) => b.dataset.roleTab === tab,
  );
  const panes = Array.from(document.querySelectorAll<HTMLElement>("[data-role-pane]"));
  switchView(panes, panes.find((pane) => pane.dataset.rolePane === tab), { direction });

  document.querySelectorAll<HTMLButtonElement>("[data-role-tab]").forEach((btn) => {
    const isActive = btn.dataset.roleTab === tab;
    btn.className = isActive
      ? "role-tab-btn rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all bg-card text-foreground shadow-sm"
      : "role-tab-btn rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all text-muted-foreground hover:text-foreground";
  });
}

export function bindRoleDialogTabs() {
  document.querySelectorAll<HTMLButtonElement>("[data-role-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = (btn.dataset.roleTab as "general" | "panel" | "server" | undefined) ?? "general";
      setRoleDialogTab(tab);
    });
  });
}
