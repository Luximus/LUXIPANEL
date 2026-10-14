// Databases page script — entry point. Splits the former 832-line monolith into
// cohesive submodules (dom / state / table-bridge / engines / navigation / views /
// record-editor / export-dialog / sql-console / bind), wired here. This entry runs
// the canonical init() lifecycle + cooldown + the DataTable REQUEST_READY
// handshake; behaviour is byte-for-byte identical to the pre-split single file.
// Only the shared lib/* URL imports stay external.
import { initModuleDeps } from "/scripts/extracted/lib/module-deps.js?v=20260609a";
import { createModuleInit } from "/scripts/extracted/lib/script-init.js";
import { loadI18n } from "./dom";
import { DB_CONSOLE_TABLE_ID, DB_ROWS_TABLE_ID, DB_STRUCT_TABLE_ID } from "./state";
import { DEPS_OPTS, loadEngines } from "./engines";
import { highlightTabs } from "./views";
import { bindOnce } from "./bind";

// ── SPA-safe init (module-eval + astro:after-swap + astro:page-load) ──────────
// F-01: el boilerplate (ancla + cooldown 4s + hooks de ciclo de vida + handshake
// REQUEST_READY por tabla) vive en `createModuleInit`. El handshake se repite en
// cada (re)montaje SPA por si el DataTable despachó `ready` antes del script.
createModuleInit({
  anchorId: "db-engines",
  tableIds: [DB_ROWS_TABLE_ID, DB_STRUCT_TABLE_ID, DB_CONSOLE_TABLE_ID],
  onMount: () => {
    loadI18n();
    bindOnce();
    highlightTabs();
  },
  onFetch: () => {
    void loadEngines();
    void initModuleDeps(DEPS_OPTS);
  },
});
