// Users page — group/role create/edit dialog (openGroupEdit + bindings) and the
// group dialog's delegated extras (module sub-tabs, per-section select-all,
// path chips + browser).
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { capabilities } from "./state";
import { t, fmt, showToast } from "./dom";
import {
  fillRolePermissions,
  setRoleDialogTab,
  resetRolePermissions,
  collectRolePermissions,
  setModulePermTab,
  syncPermSectionToggle,
  loadPermissionCatalog,
} from "./role-permissions";
import {
  openPathBrowser,
  removePath,
  parentPath,
  addPath,
  loadPathBrowser,
  pathBrowserCurrent,
  pathBrowserTarget,
} from "./path-browser";
import { loadGroups } from "./groups";
import { loadUsers } from "./users-data";
import { openDialog } from "/scripts/extracted/lib/dom.js";

// Group being edited (by NAME — the real Linux group). null = creating.
let editGroupName: string | null = null;
let editGroupIsSystem = false;

export async function openGroupEdit(g: any) {
  if (!capabilities.rolesEdit) return;
  const root = document.getElementById("dialog-role");
  const scope = resolveTargetScope();
  await loadPermissionCatalog();
  if (!capabilities.rolesEdit || root !== document.getElementById("dialog-role") || scope !== resolveTargetScope()) return;
  editGroupName = g.name;
  editGroupIsSystem = g.kind === "system";
  document.getElementById("role-dialog-title")!.textContent = fmt(t("titles.editGroup", "Editar grupo · {name}"), { name: g.name });
  const nameInput = document.getElementById("role-name") as HTMLInputElement;
  nameInput.value = g.name;
  nameInput.readOnly = editGroupIsSystem || !!g.hostingTemplate;
  const nameHint = document.getElementById("role-name-hint");
  if (nameHint) nameHint.classList.toggle("hidden", !editGroupIsSystem);
  (document.getElementById("role-desc") as HTMLInputElement).value = g.description ?? "";
  document.querySelectorAll<HTMLInputElement>("input[name='role-module']").forEach((cb) => {
    cb.checked = (g.modules ?? []).includes(cb.value);
  });
  const hint = document.getElementById("role-plan-hint");
  if (hint) { hint.hidden = !g.hostingTemplate; hint.textContent = g.hostingTemplate ? `${g.hostingTemplate.name} · v${g.hostingTemplate.revision} · ${g.hostingTemplate.state}` : ""; }
  fillRolePermissions(g.permissions ?? {});
  setRoleDialogTab("general");
  openDialog("dialog-role");
}

export function bindRoleDialog() {
  document.getElementById("btn-new-role")?.addEventListener("click", async () => {
    if (!capabilities.rolesCreate) return;
    const root = document.getElementById("dialog-role");
    const scope = resolveTargetScope();
    await loadPermissionCatalog();
    if (!capabilities.rolesCreate || root !== document.getElementById("dialog-role") || scope !== resolveTargetScope()) return;
    editGroupName = null;
    editGroupIsSystem = false;
    document.getElementById("role-dialog-title")!.textContent = t("titles.newGroup", "Nuevo grupo");
    (document.getElementById("form-role") as HTMLFormElement).reset();
    const nameInput = document.getElementById("role-name") as HTMLInputElement;
    nameInput.readOnly = false;
    document.getElementById("role-name-hint")?.classList.add("hidden");
    const hint = document.getElementById("role-plan-hint"); if (hint) hint.hidden = true;
    resetRolePermissions();
    setRoleDialogTab("general");
    openDialog("dialog-role");
  });

  const closeRoleDialog = () => (document.getElementById("dialog-role") as HTMLDialogElement).close();
  document.getElementById("role-dialog-close")?.addEventListener("click", closeRoleDialog);
  document.getElementById("role-cancel")?.addEventListener("click", closeRoleDialog);

  document.getElementById("form-role")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("role-error")!;
    errEl.classList.add("hidden");

    const name = (document.getElementById("role-name") as HTMLInputElement).value.trim();
    const description = (document.getElementById("role-desc") as HTMLInputElement).value;
    const modules = Array.from(document.querySelectorAll<HTMLInputElement>("input[name='role-module']:checked")).map((cb) => cb.value);
    const permissions = collectRolePermissions();

    let res;
    if (editGroupName) {
      const payload: any = { description, modules, permissions };
      // Renaming only for user-created groups.
      if (!editGroupIsSystem && name && name !== editGroupName) payload.newName = name;
      res = await api.put(`/api/roles/${encodeURIComponent(editGroupName)}`, payload);
    } else {
      res = await api.post("/api/roles", { name, description, modules, permissions });
    }

    if (res.ok) {
      closeRoleDialog();
      showToast(editGroupName ? t("toasts.groupUpdated", "Grupo actualizado") : t("toasts.groupCreated", "Grupo creado"));
      void loadGroups();
      void loadUsers();
    } else {
      errEl.textContent = res.error ?? t("errors.saveFailed", "Error al guardar");
      errEl.classList.remove("hidden");
    }
  });
}

export function bindGroupDialogExtras() {
  // Per-module sub-tabs (delegated; children are rendered async).
  document.getElementById("role-module-tabs")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-mod-tab]");
    if (btn?.dataset.modTab) setModulePermTab(btn.dataset.modTab);
  });

  // "Seleccionar todo" por sección (delegado; los panes se renderizan async).
  // El toggle marca/desmarca solo los checkboxes de SU sección; cambiar un
  // checkbox individual reajusta el estado del toggle (checked/indeterminate).
  document.getElementById("role-module-panes")?.addEventListener("change", (e) => {
    const target = e.target as HTMLInputElement;
    const section = target.closest<HTMLElement>("[data-perm-section]");
    if (!section) return;
    if (target.matches("[data-perm-section-toggle]")) {
      const on = target.checked;
      section
        .querySelectorAll<HTMLInputElement>("input[type='checkbox']:not([data-perm-section-toggle])")
        .forEach((cb) => { if (!cb.disabled) cb.checked = on; });
      target.indeterminate = false;
    } else if (target.matches("input[type='checkbox']")) {
      syncPermSectionToggle(section);
    }
  });

  // Path chips: add (open browser) + remove. Delegated on the group dialog.
  const roleForm = document.getElementById("form-role");
  roleForm?.addEventListener("click", (e) => {
    const addBtn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-path-add]");
    if (addBtn?.dataset.pathAdd) { openPathBrowser(addBtn.dataset.pathAdd); return; }
    const rmBtn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-path-remove]");
    if (rmBtn?.dataset.pathRemove && rmBtn.dataset.path) removePath(rmBtn.dataset.pathRemove, rmBtn.dataset.path);
  });

  // Path browser dialog controls.
  const closeBrowser = () => (document.getElementById("dialog-path-browser") as HTMLDialogElement).close();
  document.getElementById("path-browser-close")?.addEventListener("click", closeBrowser);
  document.getElementById("path-browser-cancel")?.addEventListener("click", closeBrowser);
  document.getElementById("path-browser-up")?.addEventListener("click", () => void loadPathBrowser(parentPath(pathBrowserCurrent)));
  document.getElementById("path-browser-select")?.addEventListener("click", () => {
    if (pathBrowserTarget) addPath(pathBrowserTarget, pathBrowserCurrent);
    closeBrowser();
  });
  document.getElementById("path-browser-list")?.addEventListener("click", (e) => {
    const navBtn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-path-nav]");
    if (navBtn?.dataset.pathNav) void loadPathBrowser(navBtn.dataset.pathNav);
  });
}
