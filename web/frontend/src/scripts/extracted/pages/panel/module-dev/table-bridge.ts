// Module-dev page — "Mis módulos" DataTable feed (rows cache + ready handshake
// LISTENER + ROW_ACTION dispatch). The REQUEST_READY emit stays in the entry.
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { state, linkForModule, MODULES_TABLE_ID } from "./state";
import { t, showToast, fmtDate } from "./dom";
import { openDetail } from "./detail";
import { openChatForModule } from "./assistant";
import { openPrDialog } from "./pr";
import { openConfirm } from "./confirm-dialog";
import { runChecks, runTests, installPreview } from "./checks";

// ── Alimentación del DataTable "Mis módulos" ─────────────────────────────────

export let modulesTableReady = false;
export let modulesRowsCache: Record<string, unknown>[] | null = null;

export function tsOf(value: unknown): number {
  const ms = new Date(String(value)).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function buildModuleRows(): Record<string, unknown>[] {
  return state.modules.map((mod) => ({
    id: mod.code,
    modulo: mod.name || mod.code,
    codigo: mod.scope ? `${mod.code} · ${mod.scope}` : mod.code,
    estado: t(`states.${mod.reviewStatus}`, String(mod.reviewStatus)),
    version: mod.version ?? "—",
    actualizado: fmtDate(mod.updatedAt),
    actualizadoTs: tsOf(mod.updatedAt),
    // Metadatos para el handler de acciones (no se muestran como columnas).
    _code: mod.code,
    _status: mod.reviewStatus,
    _hasLink: Boolean(linkForModule(mod.code)),
  }));
}

export function renderModules() {
  modulesRowsCache = buildModuleRows();
  if (modulesTableReady) {
    window.dispatchEvent(
      new CustomEvent(DATATABLE_EVENTS.SET_DATA, { detail: { tableId: MODULES_TABLE_ID, data: modulesRowsCache } }),
    );
  }
}

// El menú ⋯ muestra todas las acciones del ciclo; aquí se gatea por fila según
// reviewStatus / vínculo (paridad con la lógica condicional de `moduleActions`).
export function handleModulesRowAction(actionId: string, row: Record<string, unknown>) {
  const code = String(row._code ?? "");
  const status = String(row._status ?? "");
  const hasLink = Boolean(row._hasLink);
  switch (actionId) {
    case "detail":
      void openDetail(code);
      return;
    case "chat":
      openChatForModule(code);
      return;
    case "resubmit":
      if (status !== "correccion") return showToast(t("toasts.actionNotApplicable", "Esta acción no aplica al estado actual del módulo."), false);
      openPrDialog("resubmit", code);
      return;
    case "unpublish":
      if (status !== "publico") return showToast(t("toasts.actionNotApplicable", "Esta acción no aplica al estado actual del módulo."), false);
      openConfirm("unpublish", code);
      return;
    case "republish":
      if (status !== "inactivo") return showToast(t("toasts.actionNotApplicable", "Esta acción no aplica al estado actual del módulo."), false);
      openConfirm("republish", code);
      return;
    case "checks":
    case "test":
    case "preview":
      if (!hasLink) return showToast(t("common.requiresLink", "Requiere un proyecto del asistente vinculado a este módulo."), false);
      if (actionId === "checks") void runChecks(code);
      else if (actionId === "test") void runTests(code);
      else void installPreview(code);
      return;
  }
}

export let modulesTableBound = false;
export function bindModulesTable() {
  if (modulesTableBound) return;
  modulesTableBound = true;
  window.addEventListener(DATATABLE_EVENTS.READY, (event: Event) => {
    const detail = (event as CustomEvent<{ tableId?: string }>).detail;
    if (detail?.tableId !== MODULES_TABLE_ID) return;
    modulesTableReady = true;
    if (modulesRowsCache) {
      window.dispatchEvent(
        new CustomEvent(DATATABLE_EVENTS.SET_DATA, { detail: { tableId: MODULES_TABLE_ID, data: modulesRowsCache } }),
      );
    }
  });
  window.addEventListener(DATATABLE_EVENTS.ROW_ACTION, (event: Event) => {
    const detail = (event as CustomEvent<{ tableId?: string; actionId?: string; row?: Record<string, unknown> }>).detail;
    if (detail?.tableId !== MODULES_TABLE_ID || !detail.row || !detail.actionId) return;
    handleModulesRowAction(detail.actionId, detail.row);
  });
}
