// Users page script — entry point.
// Split into cohesive submodules (dom / state / table-bridge / role-permissions
// / path-browser / groups / users-data / user-dialog / ssh-keys / login-key /
// change-password / role-dialog / tabs / capabilities / table-events). This
// entry only wires them together + runs the canonical init() lifecycle. The
// submodules register their window.* globals (openUserEdit, deleteUser,
// openSshKeysDialog, deleteSshKey, openGenKeyDialog, toggleBlockUser,
// openChangePasswordDialog) as a side effect of being imported here.
import { watchModuleData } from "/scripts/extracted/lib/live-data.js";
import { bindHostingTemplates } from "./hosting-templates";
import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { loadI18n } from "./dom";
import { bindTabs, lockTabsByPermissions } from "./tabs";
import { bindUserDialog } from "./user-dialog";
import { bindUserKeyDialog, bindGenKeyDialog } from "./login-key";
import { bindChangePasswordDialog } from "./change-password";
import { bindSshKeysDialog } from "./ssh-keys";
import { bindRoleDialog, bindGroupDialogExtras } from "./role-dialog";
import { bindRoleDialogTabs, setRoleDialogTab, roleDialogActiveTab } from "./role-permissions";
import { bindUsersTableEvents } from "./table-events";
import { bindUsersTableReadyEvent } from "./table-bridge";
import { loadCapabilities } from "./capabilities";
import { loadUsers } from "./users-data";
import { loadGroups } from "./groups";
import "./settings-config";

let usersInitInFlight: Promise<void> | null = null;
let usersLastInitAt = 0;
const USERS_INIT_MIN_INTERVAL_MS = SCRIPT_INIT_COOLDOWN_MS;
// Track de la última raíz DOM bindeada — si init() se llama con un root
// nuevo (post-swap SPA), re-bindeamos; si es el mismo (mismo entry, init
// disparado 2x por page-load + after-swap), saltamos para no duplicar.
let lastBoundRoot: Element | null = null;

async function init() {
  loadI18n();
  const root = document.getElementById("panel-users");
  if (!root) return;
  if (root !== lastBoundRoot) {
    lastBoundRoot = root;
    watchModuleData(["users/system", "users/roles"], async () => { const roles = new URLSearchParams(location.search).get("workspaceView") === "roles"; if (roles) await loadGroups(); else await loadUsers(true); }, root, { showStatus: false });
    bindTabs();
    bindHostingTemplates();
    bindUserDialog();
    bindUserKeyDialog();
    bindGenKeyDialog();
    bindChangePasswordDialog();
    bindSshKeysDialog();
    bindRoleDialog();
    bindRoleDialogTabs();
    bindGroupDialogExtras();
    bindUsersTableEvents();
    bindUsersTableReadyEvent();
    setRoleDialogTab(roleDialogActiveTab);
  }

  // Cooldown SOLO para fetches.
  if (usersInitInFlight) return usersInitInFlight;
  if (Date.now() - usersLastInitAt < USERS_INIT_MIN_INTERVAL_MS) return;

  // Handshake con DataTable: si el componente React ya despachó `ready`
  // antes de que este módulo registrara su listener (race F5), el ping
  // lo hace re-emitir.
  for (const tableId of ["users-main-table", "roles-main-table"]) {
    window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.REQUEST_READY, { detail: { tableId } }));
  }

  usersInitInFlight = (async () => {
    // Resolve action permissions first. The role editor's catalog is only
    // needed when that dialog opens; it must not hold the lists behind it.
    await loadCapabilities();
    lockTabsByPermissions();
    const rolesDrawer = new URLSearchParams(location.search).get("workspaceView") === "roles";
    await Promise.allSettled(rolesDrawer ? [loadGroups()] : [loadUsers()]);
    usersLastInitAt = Date.now();
  })();
  try {
    await usersInitInFlight;
  } finally {
    usersInitInFlight = null;
  }
}

document.addEventListener("astro:page-load", () => {
  void init();
});
document.addEventListener("astro:after-swap", () => {
  void init();
});
void init();
