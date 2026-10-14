// Cloudflare page script — entry point. Splits the former 951-line monolith into
// cohesive submodules (state / dom / table-bridge / config / zones / tabs / dns /
// cache / settings / access / deep-links / bind), wired here. This entry runs the
// canonical init() lifecycle + cooldown + the DataTable REQUEST_READY handshake;
// behaviour is byte-for-byte identical to the pre-split single file. Only the
// shared lib/* URL imports stay external.
import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { CF_DNS_TABLE_ID, CF_ACCESS_TABLE_ID } from "./state";
import { loadI18n } from "./dom";
import { bindOnce } from "./bind";
import { bindCfTables } from "./table-bridge";
import { highlightTabs, showTab } from "./tabs";
import { consumeDeepLinkParams, applyDeepLinkNow } from "./deep-links";
import { loadConfig } from "./config";

// ── SPA-safe init (module-eval + astro:after-swap + astro:page-load) ──────────
let initLastAt = 0;
const INIT_COOLDOWN_MS = SCRIPT_INIT_COOLDOWN_MS;
function init() {
  if (!document.getElementById("cf-zone")) return;
  loadI18n();
  bindOnce();
  bindCfTables();
  highlightTabs();
  consumeDeepLinkParams();
  const requestedView = new URLSearchParams(location.search).get("workspaceView");
  if (requestedView && ["dns", "cache", "security", "access", "config"].includes(requestedView)) showTab(requestedView as Parameters<typeof showTab>[0]);
  // Handshake: si los DataTables ya despacharon `ready` antes de evaluar este
  // script, re-abrimos el canal por cada tableId conocido.
  for (const id of [CF_DNS_TABLE_ID, CF_ACCESS_TABLE_ID]) {
    window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.REQUEST_READY, { detail: { tableId: id } }));
  }
  if (Date.now() - initLastAt < INIT_COOLDOWN_MS) {
    // loadConfig skipped → zones may already be in memory; apply directly.
    applyDeepLinkNow();
    return;
  }
  initLastAt = Date.now();
  void loadConfig(); // deep link (if any) is consumed by the loadZones/loadDns/loadServerIp hooks
}
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
init();
