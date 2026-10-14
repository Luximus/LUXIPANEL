// Databases page — record editor dialog (insert / edit / delete a row).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { $, esc, fmt, showToast, t } from "./dom";
import { state } from "./state";
import { loadRows } from "./views";

// ── Record editor (insert / edit) ────────────────────────────────────────────
export function openRecordDialog(mode: "insert" | "edit", rowIdx?: number) {
  if (!state.columns.length) {
    showToast(t("toasts.noColumnsMetadata", "No hay metadatos de columnas para esta tabla"), false);
    return;
  }
  state.recordMode = mode;
  state.editWhere = null;
  const dlg = $("dlg-db-record") as HTMLDialogElement | null;
  const fields = $("db-record-fields");
  const title = $("db-record-title");
  if (!dlg || !fields) return;

  let row: string[] | undefined;
  if (mode === "edit" && rowIdx != null) {
    row = state.rows[rowIdx];
    // Identify the row by its primary key (original values).
    const where: Record<string, string | null> = {};
    for (const pk of state.primaryKey) {
      const ci = state.rowColumns.indexOf(pk);
      const v = ci >= 0 ? row?.[ci] : undefined;
      where[pk] = v === undefined || v === "NULL" ? null : v;
    }
    state.editWhere = where;
  }

  if (title) title.textContent = mode === "edit"
    ? fmt(t("titles.editRecord", "Editar registro · {table}"), { table: state.table ?? "" })
    : fmt(t("titles.newRecord", "Nuevo registro · {table}"), { table: state.table ?? "" });
  fields.innerHTML = state.columns
    .map((c) => {
      const ci = row ? state.rowColumns.indexOf(c.name) : -1;
      const raw = ci >= 0 ? row?.[ci] : undefined;
      const isNull = mode === "edit" ? raw === undefined || raw === "NULL" : c.default == null && c.nullable;
      const val = isNull ? "" : raw ?? "";
      const pkBadge = c.isPrimaryKey ? ` <i class="ti ti-key text-amber-500" title="${t("labels.primaryKey", "Primary key")}"></i>` : "";
      return `<div class="mb-3" data-col="${esc(c.name)}">
        <div class="mb-1 flex items-center justify-between">
          <label class="text-xs font-medium">${esc(c.name)}${pkBadge}
            <span class="ml-1 font-normal text-muted-foreground">${esc(c.dataType)}</span></label>
          <label class="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <input type="checkbox" class="db-field-null h-3 w-3 rounded border-input" ${isNull ? "checked" : ""} ${c.nullable ? "" : "disabled"} /> NULL
          </label>
        </div>
        <input type="text" class="db-field-input w-full rounded-lg border border-input bg-background px-3 py-1.5 font-mono text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${isNull ? "opacity-40" : ""}"
          value="${esc(val)}" ${isNull ? "disabled" : ""} />
      </div>`;
    })
    .join("");

  // NULL checkbox toggles its input.
  fields.querySelectorAll<HTMLInputElement>(".db-field-null").forEach((cb) => {
    cb.addEventListener("change", () => {
      const input = cb.closest("[data-col]")?.querySelector<HTMLInputElement>(".db-field-input");
      if (!input) return;
      input.disabled = cb.checked;
      input.classList.toggle("opacity-40", cb.checked);
    });
  });

  if (!dlg.open) dlg.showModal();
}

function collectRecordValues(): Record<string, string | null> {
  const values: Record<string, string | null> = {};
  document.querySelectorAll<HTMLElement>("#db-record-fields [data-col]").forEach((wrap) => {
    const col = wrap.dataset.col;
    if (!col) return;
    const nullCb = wrap.querySelector<HTMLInputElement>(".db-field-null");
    const input = wrap.querySelector<HTMLInputElement>(".db-field-input");
    values[col] = nullCb?.checked ? null : input?.value ?? "";
  });
  return values;
}

export async function saveRecord() {
  if (!state.engine || !state.database || !state.table) return;
  const saveBtn = $("db-record-save") as HTMLButtonElement | null;
  if (saveBtn) saveBtn.disabled = true;
  const values = collectRecordValues();
  const base = { engine: state.engine, database: state.database, table: state.table };
  let res;
  if (state.recordMode === "edit") {
    res = await api.patch("/api/databases/records", { ...base, values, where: state.editWhere ?? {} });
  } else {
    res = await api.post("/api/databases/records", { ...base, values });
  }
  if (saveBtn) saveBtn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("errors.saveRecord", "No se pudo guardar el registro"), false);
    return;
  }
  ($("dlg-db-record") as HTMLDialogElement | null)?.close();
  showToast(state.recordMode === "edit" ? t("toasts.recordUpdated", "Registro actualizado") : t("toasts.recordCreated", "Registro creado"));
  void loadRows();
}

export async function deleteRecord(rowIdx: number) {
  if (!state.engine || !state.database || !state.table) return;
  const row = state.rows[rowIdx];
  if (!row) return;
  if (!(await openConfirm(t("confirm.deleteRecord", "¿Eliminar este registro? Esta acción no se puede deshacer."), { title: t("confirm.deleteTitle", "Eliminar registro"), confirmText: t("confirm.deleteConfirmText", "Eliminar"), variant: "danger" }))) return;
  const where: Record<string, string | null> = {};
  for (const pk of state.primaryKey) {
    const ci = state.rowColumns.indexOf(pk);
    const v = ci >= 0 ? row[ci] : undefined;
    where[pk] = v === undefined || v === "NULL" ? null : v;
  }
  const res = await api.delete("/api/databases/records", {
    engine: state.engine,
    database: state.database,
    table: state.table,
    where,
  });
  if (!res.ok) {
    showToast(res.error ?? t("errors.deleteRecord", "No se pudo eliminar el registro"), false);
    return;
  }
  showToast(t("toasts.recordDeleted", "Registro eliminado"));
  void loadRows();
}
