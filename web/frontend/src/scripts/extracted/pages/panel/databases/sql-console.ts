// Databases page — SQL console (run arbitrary queries; feed the console DataTable).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { $, esc, fmt, showToast, t } from "./dom";
import { DB_CONSOLE_TABLE_ID, state, type QueryResult } from "./state";
import { dynColumns, dynRows, publishDb } from "./table-bridge";
import { loadRows } from "./views";

// ── SQL console ─────────────────────────────────────────────────────────────
export async function runSql() {
  if (!state.engine) {
    showToast(t("toasts.selectEngineFirst", "Selecciona un motor primero"), false);
    return;
  }
  const input = $("sql-input") as HTMLTextAreaElement;
  const sql = input.value.trim();
  if (!sql) return;
  const allowWrite = ($("sql-allow-write") as HTMLInputElement).checked;
  const meta = $("db-console-meta")!;
  const wrap = $("db-console-wrap");
  meta.innerHTML = `<div class="px-1 py-2 text-sm text-muted-foreground"><i class="ti ti-loader animate-spin"></i> ${t("loading.running", "Ejecutando…")}</div>`;
  wrap?.classList.add("hidden");

  const res = await api.post<QueryResult>("/api/databases/query", {
    engine: state.engine,
    database: state.database ?? undefined,
    sql,
    allowWrite,
  });
  if (!res.ok) {
    meta.innerHTML = `<div class="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">${esc(res.error ?? t("errors.runQuery", "Error al ejecutar la consulta"))}</div>`;
    return;
  }
  const result: QueryResult = (res.data as QueryResult) ?? { columns: [], rows: [], rowCount: 0, kind: "read", durationMs: 0 };
  meta.innerHTML = `<div class="mb-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
    <span class="inline-flex items-center gap-1 text-emerald-500"><i class="ti ti-circle-check"></i> ${result.kind === "write" ? t("info.statementExecuted", "Sentencia ejecutada") : fmt(t("info.rowCount", "{count} fila(s)"), { count: result.rowCount })}</span>
    <span>${result.durationMs} ms</span>
    ${result.truncated ? `<span class="text-amber-500">${fmt(t("info.truncated", "· resultado truncado a {count} filas"), { count: result.rowCount })}</span>` : ""}
  </div>`;
  // Mostrar la tabla de resultados salvo en writes sin columnas.
  if (result.kind === "write" && result.columns.length === 0) {
    wrap?.classList.add("hidden");
  } else {
    wrap?.classList.remove("hidden");
    publishDb(DB_CONSOLE_TABLE_ID, dynColumns(result.columns), dynRows(result.columns, result.rows));
  }
  if (result.kind === "write") {
    showToast(t("toasts.statementExecuted", "Sentencia ejecutada"));
    // A write may have changed the schema/rows currently shown — refresh.
    if (state.table && state.tab === "rows") void loadRows();
  }
}
