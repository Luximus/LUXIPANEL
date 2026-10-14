import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
// Users page — groups/roles data: the user-dialog group checklist + filter, the
// roles DataTable feed and single-group delete.
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { capabilities } from "./state";
import { t, fmt, showToast, escapeHtml } from "./dom";
import { publishRolesRows } from "./table-bridge";
import { loadUsers } from "./users-data";
const rolePages = createTablePages({ catalog:["name","kind","modules","hasPermissions"], tableId: "roles-main-table", events: window, scope: resolveTargetScope, reload: () => loadGroups(), field: "auto", rowKey: row => row.name, aliases: {kindLabel:"kind", membersLabel:"length:members", modulesLabel:"modules"}, values: () => ({kindLabel:{[t("labels.kindSystem","Sistema")]:"system",[t("labels.kindUser","Usuario")]:"user"}}) });

// Group permission/listing rows from GET /api/roles (real Linux groups).
export let groups: any[] = [];
let groupCatalog: any[] = [];

/** Render the multi-group checkbox grid in the user dialog (user-created groups only). */
export function renderUserGroupChecklist() {
  const container = document.getElementById("user-groups-grid");
  if (!container) return;
  // Show ALL real groups (the API already excludes user-private groups and
  // legacy lxp-role-*). System groups (sudo, …) are assignable on purpose.
  const assignable = [...(groupCatalog.length ? groupCatalog : groups)].sort((a: any, b: any) => {
    // user-created first, then system; alpha within.
    if ((a.kind === "system") !== (b.kind === "system")) return a.kind === "system" ? 1 : -1;
    return String(a.name).localeCompare(String(b.name));
  });
  if (assignable.length === 0) {
    container.innerHTML = `<p class="col-span-full text-xs text-muted-foreground">${t("empty.noGroups", "No hay grupos disponibles.")}</p>`;
    return;
  }
  container.innerHTML = assignable
    .map((g: any) => {
      const tag = g.kind === "system"
        ? ` <span class="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">${t("labels.systemBadge", "sistema")}</span>`
        : g.hasPermissions && Array.isArray(g.modules) && g.modules.length > 0
          ? ` <span class="text-xs text-muted-foreground">(${escapeHtml(g.modules.join(", "))})</span>`
          : "";
      return `
      <label data-group="${escapeHtml(String(g.name).toLowerCase())}" class="flex items-center gap-2 rounded-lg border border-border p-2.5 cursor-pointer hover:bg-accent">
        <input type="checkbox" name="user-group" value="${escapeHtml(g.name)}" class="h-3.5 w-3.5 rounded border-input text-primary" />
        <span class="text-sm">${escapeHtml(g.name)}${tag}</span>
      </label>`;
    })
    .join("");
  applyUserGroupFilter();
}

/** Client-side filter for the user dialog's group checklist. */
export function applyUserGroupFilter() {
  const q = ((document.getElementById("user-groups-search") as HTMLInputElement | null)?.value ?? "").trim().toLowerCase();
  document.querySelectorAll<HTMLElement>("#user-groups-grid [data-group]").forEach((el) => {
    el.classList.toggle("hidden", q.length > 0 && !(el.dataset.group ?? "").includes(q));
  });
}

export function applyGroupsData(items: any[]) {
  groups = Array.isArray(items) ? items : [];
  // Multi-group checkboxes in the user dialog.
  renderUserGroupChecklist();
  // Publish to the groups DataTable with display-friendly fields.
  const rows = groups.map((g: any) => {
    const moduleList = Array.isArray(g.modules) ? g.modules : [];
    const members = Array.isArray(g.members) ? g.members : [];
    return {
      ...g,
      kindLabel: g.kind === "system" ? t("labels.kindSystem", "Sistema") : t("labels.kindUser", "Usuario"),
      membersLabel: String(members.length),
      modulesLabel: g.hasPermissions ? (moduleList.length > 0 ? moduleList.join(", ") : "—") : "—",
    };
  });
  publishRolesRows(rows);
}

let groupsLoad: { root: Element | null; scope: string; promise: Promise<void> } | null = null;

export function loadGroups(): Promise<void> {
  if (!capabilities.rolesView) {
    applyGroupsData([]);
    return Promise.resolve();
  }
  const root = document.getElementById("panel-users");
  const scope = resolveTargetScope();
  if (groupsLoad?.root === root && groupsLoad.scope === scope) return groupsLoad.promise;
  const promise = fetchGroups(root, scope);
  groupsLoad = { root, scope, promise };
  void promise.finally(() => { if (groupsLoad?.promise === promise) groupsLoad = null; }).catch(() => {});
  return promise;
}

async function fetchGroups(root: Element | null, scope: string) {
  const res = await rolePages.read<any>(params => api.get<any>("/api/roles", {params}));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  if (!capabilities.rolesView || root !== document.getElementById("panel-users") || scope !== resolveTargetScope()) return;
  if (!res.ok) return;
  groupCatalog = res.meta?.tableWindow?.catalog ?? [];
  applyGroupsData((res.data as any)?.items ?? res.data ?? []);
}

export async function deleteGroup(name: string) {
  if (!capabilities.rolesDelete) return;
  if (!await openConfirm(fmt(t("confirm.deleteGroup", "¿Eliminar el grupo \"{name}\"? Se borrará el grupo de Linux y sus permisos."), { name }), { title: t("titles.deleteGroup", "Eliminar grupo"), variant: "danger" })) return;
  const res = await api.delete(`/api/roles/${encodeURIComponent(name)}`);
  if (res.ok) {
    showToast(t("toasts.groupDeleted", "Grupo eliminado"));
    void loadGroups();
    void loadUsers();
  } else {
    showToast(res.error ?? t("toasts.errorDeleting", "Error al eliminar"), false);
  }
}
