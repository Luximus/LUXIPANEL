// Users page — Users/Roles tab switching, the "register" action-button
// visibility and the per-permission tab locking.
import { capabilities, activeUsersTab, setActiveUsersTab } from "./state";
import { loadGroups } from "./groups";
import { loadUsers } from "./users-data";
import { setUnderlineTabState } from "/scripts/extracted/lib/tabs.js";
import { switchView, tabDirection } from "/scripts/extracted/lib/dom.js";

/** Aplica visibilidad de los botones "register" del row de tabs combinando
 *  (a) pestaña activa (`activeUsersTab`) y (b) capacidades del usuario.
 *
 *  Usa `style.display` en lugar de `classList.toggle("hidden")` porque el
 *  bundle Tailwind define `.inline-flex` DESPUÉS de `.hidden` en el CSS
 *  generado, así que la utility `inline-flex` del botón ganaba al `hidden`
 *  añadido por JS y el botón se quedaba visible. `style.display` tiene la
 *  especificidad máxima (inline style) y siempre gana sobre cualquier
 *  utility class. */
export function refreshTabActionButtons() {
  const newUserBtn = document.getElementById("btn-new-user") as HTMLButtonElement | null;
  if (newUserBtn) {
    const show = activeUsersTab === "users" && capabilities.usersCreate;
    newUserBtn.style.display = show ? "" : "none";
  }

  const newRoleBtn = document.getElementById("btn-new-role") as HTMLButtonElement | null;
  if (newRoleBtn) {
    const show = activeUsersTab === "roles" && capabilities.rolesCreate;
    newRoleBtn.style.display = show ? "" : "none";
  }
}

// ── Tabs (estilo modules: underline + count badge) ────────────────────
// E-03: el cuerpo vivía copiado byte a byte aquí, en settings/tabs, en
// mail/settings y en server-alerts; ahora sale de /scripts/extracted/lib/tabs.js.
function setUsersTabState(buttons: HTMLButtonElement[], activeButton: HTMLButtonElement) {
  buttons.forEach((btn) => {
    const active = btn === activeButton;
    setUnderlineTabState(btn, active);
    btn.setAttribute("aria-selected", String(active));
  });
}

export function bindTabs() {
  const tabUsers = document.getElementById("tab-users") as HTMLButtonElement | null;
  const tabRoles = document.getElementById("tab-roles") as HTMLButtonElement | null;
  if (!tabUsers || !tabRoles) return;
  const buttons: HTMLButtonElement[] = [tabUsers, tabRoles];

  let prevTab: "users" | "roles" = "users";
  const activate = (which: "users" | "roles") => {
    setActiveUsersTab(which);
    const target = which === "users" ? tabUsers : tabRoles;
    setUsersTabState(buttons, target!);
    // Entrada animada del panel (preset motion.css); dirección según el orden.
    const order = ["users", "roles"] as const;
    const panels = [document.getElementById("panel-users"), document.getElementById("panel-roles")];
    switchView(panels, panels[order.indexOf(which)], { direction: tabDirection(order.indexOf(prevTab), order.indexOf(which)) });
    prevTab = which;
    // Visibilidad de los botones "register" del row de tabs: combina la
    // pestaña activa con las capabilities del usuario (cargadas async).
    refreshTabActionButtons();
    if (which === "roles") void loadGroups();
  };

  tabUsers.addEventListener("click", () => { activate("users"); void loadUsers(); });
  tabRoles.addEventListener("click", () => activate("roles"));

  // Open the requested drawer directly, without first loading the users tab.
  activate(new URLSearchParams(location.search).get("workspaceView") === "roles" ? "roles" : "users");
}

export function lockTabsByPermissions() {
  const tabUsers = document.getElementById("tab-users") as HTMLButtonElement | null;
  const tabRoles = document.getElementById("tab-roles") as HTMLButtonElement | null;

  if (tabUsers) {
    tabUsers.disabled = !capabilities.usersView;
    tabUsers.classList.toggle("opacity-40", !capabilities.usersView);
    tabUsers.classList.toggle("cursor-not-allowed", !capabilities.usersView);
  }
  if (tabRoles) {
    tabRoles.disabled = !capabilities.rolesView;
    tabRoles.classList.toggle("opacity-40", !capabilities.rolesView);
    tabRoles.classList.toggle("cursor-not-allowed", !capabilities.rolesView);
  }
}
