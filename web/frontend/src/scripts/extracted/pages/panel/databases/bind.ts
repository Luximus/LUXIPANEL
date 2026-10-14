// Databases page — one-time static control bindings (idempotent via
// `__lxpDbBound`): tab clicks, DataTable feed/handshake, record editor, export.
import { bindInstallModalClose } from "/scripts/extracted/lib/install-modal.js?v=1";
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { $, showToast, t } from "./dom";
import { DB_CONSOLE_TABLE_ID, DB_ROWS_TABLE_ID, DB_STRUCT_TABLE_ID, dbCache, dbReady, state, type Tab } from "./state";
import { emitDb } from "./table-bridge";
import { loadRows, setTab } from "./views";
import { deleteRecord, openRecordDialog, saveRecord } from "./record-editor";
import { openExportDialog, runExport } from "./export-dialog";
import { runSql } from "./sql-console";
import { createDatabase } from "./navigation";

// ── Bind static controls ─────────────────────────────────────────────────────
export function bindOnce() {
  if ((window as any).__lxpDbBound) return;
  (window as any).__lxpDbBound = true;

  bindInstallModalClose("databases");

  document.addEventListener("click", (e) => {
    if ((e.target as HTMLElement)?.closest("#db-create")) { void createDatabase(); return; }
    const target = (e.target as HTMLElement)?.closest<HTMLButtonElement>(".db-tab");
    if (target?.dataset.tab) setTab(target.dataset.tab as Tab);
  });

  // ── DataTable feed/handshake (rows / structure / console) ───────────────────
  window.addEventListener(DATATABLE_EVENTS.READY, (event: Event) => {
    const id = (event as CustomEvent<{ tableId?: string }>).detail?.tableId;
    if (id !== DB_ROWS_TABLE_ID && id !== DB_STRUCT_TABLE_ID && id !== DB_CONSOLE_TABLE_ID) return;
    dbReady[id] = true;
    if (dbCache[id]) emitDb(id);
  });

  // Paginación externa (server-side) de la tabla de filas.
  window.addEventListener(DATATABLE_EVENTS.LOAD_MORE, (event: Event) => {
    if ((event as CustomEvent).detail?.tableId === DB_ROWS_TABLE_ID) void loadRows(true);
  });
  window.addEventListener(DATATABLE_EVENTS.QUERY, (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.tableId !== DB_ROWS_TABLE_ID) return;
    state.limit = Math.max(1, Math.min(100, Number(detail.pageSize) || 10));
    state.rowSorting = detail.sorting ?? [];
    void loadRows();
  });

  // Acciones por fila de la tabla de filas (editar / eliminar).
  window.addEventListener(DATATABLE_EVENTS.ROW_ACTION, (event: Event) => {
    const d = (event as CustomEvent<{ tableId?: string; actionId?: string; row?: Record<string, any> }>).detail;
    if (d?.tableId !== DB_ROWS_TABLE_ID || !d.row || !d.actionId) return;
    if (state.primaryKey.length === 0) {
      showToast(t("toasts.noPrimaryKey", "Esta tabla no tiene clave primaria; no se pueden editar/eliminar filas."), false);
      return;
    }
    const idx = Number(d.row._idx);
    if (!Number.isFinite(idx)) return;
    if (d.actionId === "edit") openRecordDialog("edit", idx);
    else if (d.actionId === "delete") void deleteRecord(idx);
  });
  $("sql-run")?.addEventListener("click", () => void runSql());
  $("sql-input")?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e as KeyboardEvent).key === "Enter") {
      e.preventDefault();
      void runSql();
    }
  });

  // Record editor
  $("db-add-record")?.addEventListener("click", () => openRecordDialog("insert"));
  $("db-record-save")?.addEventListener("click", () => void saveRecord());
  $("db-record-cancel")?.addEventListener("click", () => ($("dlg-db-record") as HTMLDialogElement | null)?.close());
  $("db-record-x")?.addEventListener("click", () => ($("dlg-db-record") as HTMLDialogElement | null)?.close());

  // Export
  $("db-export-btn")?.addEventListener("click", () => void openExportDialog());
  $("db-export-go")?.addEventListener("click", () => void runExport());
  $("db-export-cancel")?.addEventListener("click", () => ($("dlg-db-export") as HTMLDialogElement | null)?.close());
  $("db-export-x")?.addEventListener("click", () => ($("dlg-db-export") as HTMLDialogElement | null)?.close());
  $("db-export-all")?.addEventListener("change", (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    document.querySelectorAll<HTMLInputElement>(".db-export-tbl").forEach((c) => (c.checked = checked));
  });
}
