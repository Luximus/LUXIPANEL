// Module-dev page script — entry point. Splits the former 906-line monolith into
// cohesive submodules (state / dom / data / render / table-bridge / assistant /
// pr / confirm-dialog / checks / detail / actions), wired here. This entry runs
// the canonical init() lifecycle (AbortController-scoped listeners + cooldown +
// the DataTable REQUEST_READY handshake); behaviour is byte-for-byte identical to
// the pre-split single file. Only the shared lib/* URL imports stay external.
import { SCRIPT_INIT_COOLDOWN_MS } from "/scripts/extracted/lib/script-init.js";
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { MODULES_TABLE_ID } from "./state";
import { loadI18n, $ } from "./dom";
import { bindModulesTable } from "./table-bridge";
import { handleAction } from "./actions";
import { createWithAssistant } from "./assistant";
import { loadAll } from "./data";
import { submitPr } from "./pr";
import { runConfirm } from "./confirm-dialog";

// ── Init SPA-safe (module-eval + astro:after-swap + astro:page-load) ─────────
// AbortController limpia los listeners del init previo antes de re-atar;
// el cooldown SOLO bloquea fetches duplicados (los 3 fires por entrada).
let initController: AbortController | null = null;
let initLastAt = 0;
const INIT_COOLDOWN_MS = SCRIPT_INIT_COOLDOWN_MS;

function init() {
  if (!document.getElementById("module-dev-root")) return;

  initController?.abort();
  initController = new AbortController();
  const { signal } = initController;

  loadI18n();
  bindModulesTable();

  document.addEventListener(
    "click",
    (e) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;

      const actionEl = el.closest<HTMLElement>("[data-md-action]");
      if (actionEl?.dataset.mdAction) {
        handleAction(actionEl.dataset.mdAction, actionEl.dataset.code ?? "");
        return;
      }

      if (el.closest("#md-create")) return createWithAssistant();
      if (el.closest("#md-refresh")) return void loadAll();

      if (el.closest("#md-pr-save")) return void submitPr();
      if (el.closest("#md-pr-cancel") || el.closest("#md-pr-x")) {
        ($("dlg-md-pr") as HTMLDialogElement | null)?.close();
        return;
      }
      if (el.closest("#md-confirm-ok")) return void runConfirm();
      if (el.closest("#md-confirm-cancel") || el.closest("#md-confirm-x")) {
        ($("dlg-md-confirm") as HTMLDialogElement | null)?.close();
        return;
      }
      if (el.closest("#md-detail-close") || el.closest("#md-detail-x")) {
        ($("dlg-md-detail") as HTMLDialogElement | null)?.close();
        return;
      }
      if (el.closest("#md-result-close") || el.closest("#md-result-x")) {
        ($("dlg-md-result") as HTMLDialogElement | null)?.close();
        return;
      }
    },
    { signal },
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter" && (e.target as HTMLElement | null)?.id === "md-pr-url") {
        e.preventDefault();
        void submitPr();
      }
    },
    { signal },
  );

  // Handshake con el DataTable: si el componente React ya despachó `ready`
  // antes de que evaluara este script, ese evento se perdió; re-abrimos el
  // canal y él responde con `ready` (→ modulesTableReady + set-data).
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.REQUEST_READY, { detail: { tableId: MODULES_TABLE_ID } }));

  if (Date.now() - initLastAt < INIT_COOLDOWN_MS) return;
  initLastAt = Date.now();
  void loadAll();
}

document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
init();
