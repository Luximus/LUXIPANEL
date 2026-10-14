// Databases page — SQL export dialog (pick tables, dump to a downloadable file).
import { api, resolvePanelApiPath, getCsrfToken, CSRF_HEADER_NAME } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { $, esc, showToast, t } from "./dom";
import { state, type TableInfo } from "./state";

// ── Export ───────────────────────────────────────────────────────────────────
export async function openExportDialog() {
  if (!state.engine || !state.database) return;
  const dlg = $("dlg-db-export") as HTMLDialogElement | null;
  const list = $("db-export-tables");
  if (!dlg || !list) return;
  list.innerHTML = `<p class="px-1 py-2 text-xs text-muted-foreground">${t("loading.tablesExport", "Cargando tablas…")}</p>`;
  if (!dlg.open) dlg.showModal();
  const res = await api.get<TableInfo[]>(
    `/api/databases/tables?engine=${encodeURIComponent(state.engine)}&database=${encodeURIComponent(state.database)}`,
  );
  const tables: TableInfo[] = res.ok ? res.data ?? [] : [];
  if (tables.length === 0) {
    list.innerHTML = `<p class="px-1 py-2 text-xs text-muted-foreground">${t("empty.noTables", "Sin tablas.")}</p>`;
    return;
  }
  list.innerHTML = tables
    .map(
      (tbl) => `<label class="flex items-center gap-2 rounded px-1 py-1 hover:bg-accent">
        <input type="checkbox" class="db-export-tbl h-4 w-4 rounded border-input text-primary" value="${esc(tbl.name)}" checked />
        <span class="truncate font-mono text-xs">${esc(tbl.name)}</span>
      </label>`,
    )
    .join("");
  const allCb = $("db-export-all") as HTMLInputElement | null;
  if (allCb) allCb.checked = true;
}

export async function runExport() {
  if (!state.engine || !state.database) return;
  const goBtn = $("db-export-go") as HTMLButtonElement | null;
  const checks = Array.from(document.querySelectorAll<HTMLInputElement>(".db-export-tbl"));
  const allChecked = checks.every((c) => c.checked);
  const selected = checks.filter((c) => c.checked).map((c) => c.value);
  if (selected.length === 0) {
    showToast(t("toasts.noTableSelect", "Selecciona al menos una tabla"), false);
    return;
  }
  const includeData = ($("db-export-data") as HTMLInputElement | null)?.checked ?? true;
  if (goBtn) goBtn.disabled = true;
  try {
    const csrf = getCsrfToken();
    const resp = await fetch(resolvePanelApiPath("/api/databases/export"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(csrf ? { [CSRF_HEADER_NAME]: csrf } : {}) },
      body: JSON.stringify({
        engine: state.engine,
        database: state.database,
        tables: allChecked ? [] : selected, // empty = whole database
        includeData,
      }),
    });
    if (!resp.ok) {
      let msg = `Error ${resp.status}`;
      try {
        const j = await resp.json();
        msg = j?.error ?? j?.message ?? msg;
      } catch {
        /* non-JSON */
      }
      showToast(msg, false);
      return;
    }
    const blob = await resp.blob();
    const cd = resp.headers.get("Content-Disposition") ?? "";
    const m = cd.match(/filename="?([^"]+)"?/);
    const filename = m?.[1] ?? `${state.database}.sql`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    ($("dlg-db-export") as HTMLDialogElement | null)?.close();
    showToast(t("toasts.exportDownloaded", "Exportación descargada"));
  } catch (err) {
    showToast(err instanceof Error ? err.message : t("errors.networkError", "Error de red"), false);
  } finally {
    if (goBtn) goBtn.disabled = false;
  }
}
