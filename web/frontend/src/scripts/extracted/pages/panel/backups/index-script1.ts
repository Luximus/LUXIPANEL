// Backups page script — entry point. Splits the former 855-line monolith into
// cohesive submodules (dom / types / settings / path-browser / sources /
// history / dialogs / storage), wired here. The top-level control bindings run
// once at module eval — exactly as before — by calling each submodule's `bind*`
// in the original source order; then the canonical init() lifecycle + cooldown +
// DataTable REQUEST_READY handshake. Behaviour is byte-for-byte identical to the
// pre-split single file. Only the shared lib/* URL imports stay external.
import { watchModuleData } from "/scripts/extracted/lib/live-data.js";
import { initModuleDeps } from "/scripts/extracted/lib/module-deps.js?v=20260609a";
import { initBackupsSettingsTable } from "./settings-table";
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
import { resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260927b";
import { loadI18n, t } from "./dom";
import { bindSettingsControls, loadBackupSettings } from "./settings";
import { bindPathBrowserControls } from "./path-browser";
import { bindSourcesControls } from "./sources";
import { BACKUPS_TABLE_ID, bindBackupsTableEvents, bindScheduleListEvents, clearBackupsView, loadBackups, loadSchedules } from "./history";
import { bindDialogs } from "./dialogs";
import { STORAGES_TABLE_ID, bindStorageControls, clearStoragesView, loadStorages } from "./storage";

// ── System dependencies (module-deps banner, backend id: "backup") ──────────
// tar+gzip are required; mysqldump/pg_dump are optional (only affect database
// backups) and never block the page. When the user installs the missing
// required deps from the banner, reload the module data.
let depsWasMissing = false;
function initBackupDeps() {
  void initModuleDeps({
    module: "backup",
    onMissing: () => {
      depsWasMissing = true;
    },
    onReady: () => {
      if (!depsWasMissing) return;
      depsWasMissing = false;
      void loadBackupSettings();
      const view = new URLSearchParams(location.search).get("workspaceView");
      if (!view || view === "overview" || view === "history") void loadBackups();
      if (!view || view === "overview" || view === "schedules") void loadSchedules();
      if (!view || view === "overview") void loadStorages();
    },
  });
}

// Cooldown SOLO para fetches. Bindings always en DOM fresh.
let initLastAt = 0;
const INIT_COOLDOWN_MS = SCRIPT_INIT_COOLDOWN_MS;
let lastBoundRoot: Element | null = null;
let lastTargetScope = "";
async function init() {
  const root = document.getElementById("btn-backup-now");
  if (!root) return;
  loadI18n();
  if (root !== lastBoundRoot) {
    lastBoundRoot = root;
    watchModuleData(["backup/schedules"], () => loadSchedules(), root);
    initLastAt = 0;
    bindDialogs();
    bindSettingsControls();
    bindPathBrowserControls();
    bindSourcesControls();
    bindStorageControls();
    bindBackupsTableEvents();
    bindScheduleListEvents();
  }
  const scope = resolveTargetScope();
  if (scope !== lastTargetScope) {
    lastTargetScope = scope;
    initLastAt = 0;
    clearBackupsView();
    clearStoragesView();
    const scheduleList = document.getElementById("schedules-list");
    if (scheduleList) scheduleList.textContent = t("schedulesSection.loading", "Cargando…");
    for (const id of ["backup-summary-last", "backup-summary-local", "backup-summary-schedules", "backup-count"]) {
      const node = document.getElementById(id);
      if (node) node.textContent = "—";
    }
  }
  initBackupsSettingsTable();
  if (Date.now() - initLastAt < INIT_COOLDOWN_MS) return;
  initLastAt = Date.now();
  initBackupDeps();
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.REQUEST_READY, { detail: { tableId: BACKUPS_TABLE_ID } }));
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.REQUEST_READY, { detail: { tableId: STORAGES_TABLE_ID } }));
  const drawerView = new URLSearchParams(location.search).get("workspaceView");
  // History/schedules/storage do not depend on the settings form. Mutations
  // still wait for currentConfig inside that form's own loader.
  void loadBackupSettings();
  if (!drawerView || drawerView === "overview" || drawerView === "history") void loadBackups();
  if (!drawerView || drawerView === "overview" || drawerView === "schedules") void loadSchedules();
  if (!drawerView || drawerView === "overview") void loadStorages();
}
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
window.addEventListener("luxipanel:target-changed", () => void init());
init();
