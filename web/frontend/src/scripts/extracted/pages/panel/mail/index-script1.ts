// Mail page script — entry point. Splits the former monolith into cohesive
// submodules; this entry wires them (imports register their bindings + window.*
// globals as a side effect) and runs the canonical init() lifecycle + handshake.
import { watchModuleData } from "/scripts/extracted/lib/live-data.js";
import { initModuleDeps } from "/scripts/extracted/lib/module-deps.js?v=20260609a";
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
import { mountMailServerSettings } from "/scripts/extracted/lib/mail-server-settings.js?v=20260930b";
import { selectedMailServer } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import type { MailMainTab } from "./state";
import { MAIL_TABLE_IDS, S } from "./state";
import { loadI18n } from "./dom";
import { bindMailTableEvents } from "./table-bridge";
import { closeGlobalFilterDialog, resetFilterForm, resetGlobalFilterForm } from "./filters";
import { autoOpenDefaultInboxIfNeeded, closeAccountActionMenus, loadAccounts } from "./accounts";
import { loadDefaultAddressRules, loadDomainForwardRules, loadDomains, loadMailDomainRouting, refreshDefaultAddressFormFromSelectedDomain, refreshMailRoutingFormFromSelectedDomain, resetDomainForwardForm } from "./domains";
import { closeTrackDeliveryDetailDialog, renderTrackDeliveryTable, setTrackModeButtons, syncTrackColumnCheckboxes } from "./tracking";
import { bindMailSettingsDomEvents, ensureMailMainTabLoaded, setMailMainTab } from "./settings";
import "./assistant";
import "./forwards";
import "./contacts-calendars";
import "./disk-clone";
import { bindMailSpamDomEvents } from "./spam";

async function reloadMailDataAfterDepsInstall(): Promise<void> {
  const hasSettings = Boolean(document.getElementById("mail-settings-modal"));
  await Promise.allSettled([
    loadDomains(),
    loadAccounts().then((loaded) => { if (loaded) autoOpenDefaultInboxIfNeeded(S.accounts); }),
    ...(hasSettings ? [loadMailDomainRouting(), loadDefaultAddressRules(), loadDomainForwardRules()] : []),
  ]);
  if (hasSettings) {
    refreshMailRoutingFormFromSelectedDomain();
    refreshDefaultAddressFormFromSelectedDomain();
  }
}

function checkMailModuleDeps(): void {
  if (selectedMailServer()) {
    document.getElementById("deps-banner-mail")?.classList.add("hidden");
    return;
  }
  void initModuleDeps({
    module: "mail",
    onReady: () => {
      if (!S.mailDepsWereMissing) return;
      S.mailDepsWereMissing = false;
      if (document.querySelector('[data-mail-main-panel="emails"]')) void reloadMailDataAfterDepsInstall();
      else if (document.querySelector('[data-mail-main-panel="spam-filters"]')) { S.mailSpamFiltersLoaded = false; void ensureMailMainTabLoaded("spam-filters"); }
      else if (document.querySelector('[data-mail-main-panel="track-delivery"]')) { S.mailTrackDeliveryLoaded = false; void ensureMailMainTabLoaded("track-delivery"); }
      else if (document.querySelector('[data-mail-main-panel="global-filters"]')) { S.mailGlobalFiltersLoaded = false; void ensureMailMainTabLoaded("global-filters"); }
    },
    onMissing: () => {
      // No romper la página: los grids quedan como están y los endpoints
      // fallan de forma controlada como hoy. Solo marcamos el estado para
      // recargar cuando el usuario instale desde el banner.
      S.mailDepsWereMissing = true;
    },
  });
}

const MAIL_INIT_MIN_INTERVAL_MS = SCRIPT_INIT_COOLDOWN_MS;
let mailBaseLoaded = false;

async function init() {
  loadI18n();
  const root = document.querySelector('[data-mail-main-panel]');
  if (!root) return;
  void mountMailServerSettings();
  bindMailSettingsDomEvents();
  bindMailSpamDomEvents();

  // Re-atar listeners de tabs principales SIEMPRE que el DOM sea fresh
  // (el cooldown de abajo solo aplica a fetches; sin esta sección los
  // tabs Correos↔Spam↔Tracking↔Globales quedaban muertos tras SPA-nav).
  // TODO: hay ~89 bindings adicionales a module-top (forwards dialog,
  // create account, etc.) que también quedan rotos tras SPA-nav; mover
  // todas a un bindMailDomEvents() llamado desde aquí.
  if (root !== S.mailLastBoundRoot) {
    S.mailLastBoundRoot = root;
    watchModuleData(["mail/accounts"], () => loadAccounts(true), root as HTMLElement);
    mailBaseLoaded = false;
    document.querySelectorAll<HTMLButtonElement>("[data-mail-main-tab]").forEach((button) => {
      button.addEventListener("click", async () => {
        const tab = button.dataset.mailMainTab as MailMainTab | undefined;
        if (!tab) return;
        setMailMainTab(tab);
        if (tab === "emails" && !mailBaseLoaded) { await reloadMailDataAfterDepsInstall(); mailBaseLoaded = true; }
        else await ensureMailMainTabLoaded(tab);
      });
    });
  }

  // init() is invoked both at module eval and on every astro:page-load
  // (view-transition nav back into /mail). Collapse the double-call and the
  // rapid Ajustes↔Correos bounce so we don't re-run the whole fan-out each
  // time. Explicit reload buttons call the specific loaders directly, so
  // manual refresh is unaffected.
  if (S.mailInitInFlight) return S.mailInitInFlight;
  if (Date.now() - S.mailLastInitAt < MAIL_INIT_MIN_INTERVAL_MS) return;
  S.mailInitInFlight = (async () => {
    bindMailTableEvents();
    // Banner de dependencias (fire-and-forget: no bloquea el first paint;
    // initModuleDeps es idempotente y re-checkea en cada nav SPA).
    checkMailModuleDeps();
    // Reset de flags de carga perezosa: el DOM se reemplaza en cada nav
    // SPA, así que `*Loaded = true` del visit anterior dejaría tabs
    // internos (spam-filters, track-delivery, global-filters) vacíos
    // al re-entrar (mismo bug que [[modules-cache]] tenía).
    S.mailSpamFiltersLoaded = false;
    S.mailTrackDeliveryLoaded = false;
    S.mailGlobalFiltersLoaded = false;
    // Handshake con DataTable: si el componente React ya despachó `ready`
    // antes de que este módulo registrara su listener (race F5), el ping
    // lo hace re-emitir → vanilla vuelca mailTableCache → datos visibles.
    for (const tableId of MAIL_TABLE_IDS) {
      window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.REQUEST_READY, { detail: { tableId } }));
    }
    if (document.getElementById("filters-form")) {
      resetFilterForm();
    }
    setTrackModeButtons();
    syncTrackColumnCheckboxes();
    renderTrackDeliveryTable();
    if (document.getElementById("mail-global-filter-form")) resetGlobalFilterForm();
    if (document.getElementById("mail-settings-modal")) resetDomainForwardForm();
    const requestedView = new URLSearchParams(location.search).get("workspaceView");
    if (requestedView && ["emails", "spam-filters", "track-delivery", "global-filters"].includes(requestedView)) S.mailMainTab = requestedView as MailMainTab;
    setMailMainTab(S.mailMainTab);
    // Si el tab activo NO es "emails" (mailMainTab persiste cross-nav SPA
    // a nivel módulo), forzar carga de su data — sin esto el usuario veía
    // el tab visualmente activo pero vacío al re-entrar al módulo, porque
    // el Promise.allSettled de abajo solo carga lo del tab "emails".
    if (S.mailMainTab !== "emails") {
      void ensureMailMainTabLoaded(S.mailMainTab);
    }
    // Independent endpoints — fetch in parallel so first paint waits on
    // max(latency) not sum(latency). allSettled preserves the existing
    // best-effort behaviour (each loader already handles its own error).
    if (S.mailMainTab === "emails") {
      await reloadMailDataAfterDepsInstall();
      mailBaseLoaded = true;
    }
    S.mailLastInitAt = Date.now();
  })();
  try {
    await S.mailInitInFlight;
  } finally {
    S.mailInitInFlight = null;
  }
}

document.addEventListener("astro:page-load", () => void init());

document.addEventListener("lxp:module:visibility", () => {
  const root = document.querySelector<HTMLElement>('[data-mail-main-panel="emails"]');
  // Newer live-data controllers already refresh on resume. Older mounted
  // controllers still need to recover reads aborted when their drawer closed.
  if (!document.hidden && root && !root.dataset.liveDataBound) void loadAccounts(true);
});

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest(".account-actions-wrap")) {
    closeAccountActionMenus();
  }
  if (
    !event.target.closest("#mail-track-delivery-columns-panel")
    && !event.target.closest("#mail-track-delivery-columns-toggle")
  ) {
    document.getElementById("mail-track-delivery-columns-panel")?.classList.add("hidden");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAccountActionMenus();
    document.getElementById("mail-track-delivery-columns-panel")?.classList.add("hidden");
    closeTrackDeliveryDetailDialog();
    closeGlobalFilterDialog();
  }
});

void init();


// ── Puente de configuración del módulo → DataTable ──────────────────────────
// El drawer de configuración (MailConfigDrawer) persiste en
// `lxp:mail:table-config:v1` y emite `lxp:mail:table-config`. El DataTable es
// genérico: lee `lxp:data-table:prefs:<tableId>` al montar y escucha
// `lxp:data-table:apply-prefs`. Aquí traducimos lo primero a lo segundo para la
// tabla de cuentas de correo.
(function bridgeMailTableConfig() {
  const MAIL_KEY = "lxp:mail:table-config:v1";
  const TABLE_ID = "mail-accounts-table";
  function syncAndApply() {
    let cfg: { pageSize?: number; hiddenActions?: string[] } = {};
    try {
      const raw = window.localStorage.getItem(MAIL_KEY);
      if (raw) cfg = JSON.parse(raw);
    } catch {
      /* storage unavailable */
    }
    const payload = { pageSize: cfg.pageSize, hiddenActions: cfg.hiddenActions ?? [] };
    try {
      window.localStorage.setItem(`lxp:data-table:prefs:${TABLE_ID}`, JSON.stringify(payload));
    } catch {
      /* noop */
    }
    window.dispatchEvent(new CustomEvent("lxp:data-table:apply-prefs", { detail: { tableId: TABLE_ID, ...payload } }));
  }
  window.addEventListener("lxp:mail:table-config", syncAndApply);
  syncAndApply();
})();
