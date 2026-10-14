import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
// Backups page — backup history DataTable (feed + row/quick actions), the
// schedules list, and download/delete of individual backups.
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260927b";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { escapeHtml } from "/scripts/extracted/lib/escape.js";
import { resolvePanelApiPath, scopeHeaders } from "/scripts/extracted/lib/api-client.js?v=20260927b";
import { fmt, fmtBytes, showToast, t } from "./dom";
const backupPages = createTablePages({ tableId: "backups-history-table", events: window, scope: resolveTargetScope, reload: () => loadBackups(), field: "auto", aliases: {statusCode:"status", size:"sizeBytes", storage:"provider", fecha:"startedAt"}, values: () => ({status:Object.fromEntries(["completed","failed","running"].map(status => [t(`status.${status}`,status === "completed" ? "Completada" : status === "failed" ? "Fallida" : "En curso"),status]))}) });

export const BACKUPS_TABLE_ID = "backups-history-table";
let backupsTableIsReady = false;
let backupsTableCachedRows: any[] = [];

export function clearBackupsView() {
  schedulesCache = [];
  publishBackupsRows([]);
}

function publishBackupsRows(rows: any[]) {
  const safeRows = Array.isArray(rows) ? rows : [];
  backupsTableCachedRows = safeRows;
  if (!backupsTableIsReady) return;
  window.dispatchEvent(
    new CustomEvent(DATATABLE_EVENTS.SET_DATA, {
      detail: { tableId: BACKUPS_TABLE_ID, data: safeRows },
    }),
  );
}

export async function loadBackups() {
  const res = await backupPages.read<any>(params => api.get<any>("/api/backups", {params}));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  if (!res.ok) {
    const countEl = document.getElementById("backup-count");
    if (countEl) countEl.textContent = res.error ?? t("errors.listFailed", "No se pudo cargar el historial.");
    publishBackupsRows([]);
    return;
  }
  const items: any[] = (res.data as any)?.items ?? res.data ?? [];
  const countEl = document.getElementById("backup-count");
  const total = Number(res.meta?.total);
  if (countEl) countEl.textContent = Number.isFinite(total) && total > items.length
    ? fmt(t("historySection.countPartial", "{shown} de {total} copias"), { shown: items.length, total })
    : fmt(t("historySection.count", "{count} copias"), { count: items.length });
  const completed = items.filter((b) => b.status === "completed");
  const last = completed.sort((a, b) =>
    Date.parse(b.completedAt ?? b.startedAt ?? "") - Date.parse(a.completedAt ?? a.startedAt ?? ""))[0];
  const lastSuccessAt = typeof res.meta?.lastSuccessAt === "string"
    ? res.meta.lastSuccessAt
    : last?.completedAt ?? last?.startedAt;
  const lastEl = document.getElementById("backup-summary-last");
  if (lastEl) lastEl.textContent = lastSuccessAt ? new Date(lastSuccessAt).toLocaleString(document.documentElement.lang || "es") : t("empty.noBackups", "Sin copias todavía");
  const localEl = document.getElementById("backup-summary-local");
  if (localEl) localEl.textContent = String(Number.isFinite(Number(res.meta?.localCount))
    ? Number(res.meta?.localCount)
    : completed.filter((b) => b.provider === "local").length);
  const rows = items.map((b: any) => ({
    id: b.id,
    label: String(b.label ?? ""),
    status: t(`status.${b.status}`, b.status === "completed" ? "Completada" : b.status === "failed" ? "Fallida" : "En curso"),
    statusCode: b.status,
    error: String(b.error ?? ""),
    hasError: Boolean(b.error),
    provider: b.provider,
    canDownload: b.provider === "local" && b.status === "completed" && Boolean(b.destination),
    canDeleteFile: b.provider === "local" && b.status === "completed" && Boolean(b.destination),
    canRemoveHistory: b.status !== "running" && !(b.provider === "local" && b.status === "completed" && b.destination),
    size: fmtBytes(b.sizeBytes),
    storage: String(b.provider ?? b.storage ?? ""),
    fecha: b.startedAt ?? b.createdAt
      ? new Date(b.startedAt ?? b.createdAt).toLocaleString(document.documentElement.lang || navigator.language || "en", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
      : "—",
  }));
  publishBackupsRows(rows);
}

export async function loadSchedules() {
  const res = await api.get<any>("/api/backups/schedules");
  const el = document.getElementById("schedules-list");
  if (!el) return;
  if (!res.ok) { el.textContent = res.error ?? t("errors.listSchedulesFailed", "No se pudieron cargar las programaciones."); return; }
  const items: any[] = (res.data as any)?.items ?? res.data ?? [];
  schedulesCache = items;
  const summary = document.getElementById("backup-summary-schedules");
  if (summary) summary.textContent = String(items.filter((s) => s.enabled).length);
  if (items.length === 0) {
    el.innerHTML = `<div class="px-5 py-5 text-center text-sm text-muted-foreground"><i class="ti ti-calendar-off text-2xl block mb-1.5 mx-auto opacity-40"></i>${t("empty.noSchedules", "Sin programaciones")}</div>`;
    return;
  }
  el.innerHTML = items.map((s: any) => {
    const scope = s.fullServer ? t("labels.fullServer", "servidor completo") : (s.provider ?? "local");
    const active = s.enabled ? t("schedulesSection.active", "Activa") : t("schedulesSection.paused", "Pausada");
    return `
      <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div class="min-w-0">
          <p class="text-sm font-medium">${escapeHtml(s.name ?? s.label ?? "")} <span class="ml-1 rounded-full px-2 py-0.5 text-xs ${s.enabled ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}">${escapeHtml(active)}</span></p>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(s.schedule)} · ${escapeHtml(scope)} · ${Number(s.retainCount ?? 7)} ${escapeHtml(t("schedulesSection.copies", "copias"))}</p>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" data-schedule-action="toggle" data-schedule-id="${Number(s.id)}" aria-label="${escapeHtml(s.enabled ? t("schedulesSection.pause", "Pausar") : t("schedulesSection.enable", "Activar"))}" class="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"><i class="ti ${s.enabled ? "ti-player-pause" : "ti-player-play"} text-base" aria-hidden></i></button>
          <button type="button" data-schedule-action="edit" data-schedule-id="${Number(s.id)}" aria-label="${escapeHtml(t("schedulesSection.edit", "Editar"))}" class="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"><i class="ti ti-pencil text-base" aria-hidden></i></button>
          <button type="button" data-schedule-action="delete" data-schedule-id="${Number(s.id)}" aria-label="${escapeHtml(t("schedulesSection.delete", "Eliminar"))}" class="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><i class="ti ti-trash text-base" aria-hidden></i></button>
        </div>
      </div>`;
  }).join("");
}

async function downloadBackup(id: number, label: string) {
  showToast(t("toasts.preparingDownload", "Preparando descarga…"));
  try {
    const res = await fetch(resolvePanelApiPath(`/api/backups/${id}/download`), { credentials: "same-origin", headers: scopeHeaders() });
    if (!res.ok) {
      let msg = t("errors.downloadFailed", "No se pudo descargar el backup");
      try { msg = (await res.json())?.error ?? msg; } catch { /* non-JSON body */ }
      showToast(msg, false);
      return;
    }
    const filename = label && label.endsWith(".tar.gz") ? label : `${label || "backup"}.tar.gz`;
    const picker = (window as any).showSaveFilePicker;
    if (typeof picker === "function" && res.body) {
      const handle = await picker({ suggestedName: filename });
      await res.body.pipeTo(await handle.createWritable());
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    if ((err as DOMException).name === "AbortError") return;
    showToast(t("errors.downloadFailed", "No se pudo descargar el backup"), false);
  }
}

async function deleteBackup(id: number, label: string, recordOnly = false) {
  const message = recordOnly
    ? fmt(t("confirm.removeRecord", "¿Quitar «{label}» del historial? El objeto en la nube se conservará."), { label })
    : fmt(t("confirm.deleteBackup", "¿Eliminar el backup \"{label}\"?"), { label });
  const title = recordOnly ? t("confirm.removeRecordTitle", "Quitar registro") : t("confirm.deleteBackupTitle", "Eliminar backup");
  if (!await openConfirm(message, { title, variant: "danger" })) return;
  const res = await api.delete(`/api/backups/${id}`);
  if (res.ok) { showToast(recordOnly ? t("toasts.recordRemoved", "Registro quitado del historial") : t("toasts.backupDeleted", "Backup eliminado")); void loadBackups(); }
  else showToast(t("toasts.errorDelete", "Error al eliminar"), false);
}

let schedulesCache: any[] = [];
export function bindScheduleListEvents() {
  document.getElementById("schedules-list")?.addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-schedule-action]");
    if (!button) return;
    const schedule = schedulesCache.find((item) => Number(item.id) === Number(button.dataset.scheduleId));
    if (!schedule) return;
    const action = button.dataset.scheduleAction;
    if (action === "edit") { (window as any).openBackupScheduleEditor?.(schedule); return; }
    if (action === "delete") { await (window as any).deleteSchedule?.(schedule.id); return; }
    if (action === "toggle") {
      const result = await api.put(`/api/backups/schedules/${schedule.id}`, { enabled: !schedule.enabled });
      if (!result.ok) showToast(result.error ?? t("toasts.errorSaveSchedule", "No se pudo actualizar la programación."), false);
      else void loadSchedules();
    }
  });
}

let backupsEventsBound = false;
export function bindBackupsTableEvents() {
  if (backupsEventsBound) return;
  backupsEventsBound = true;
  window.addEventListener(DATATABLE_EVENTS.READY, (event: Event) => {
    const detail = (event as CustomEvent<any>).detail;
    if (detail?.tableId !== BACKUPS_TABLE_ID) return;
    backupsTableIsReady = true;
    publishBackupsRows(backupsTableCachedRows);
  });
  window.addEventListener(DATATABLE_EVENTS.ROW_ACTION, (event: Event) => {
    const detail = (event as CustomEvent<any>).detail;
    if (!detail || detail.tableId !== BACKUPS_TABLE_ID) return;
    const row = detail.row;
    if (!row) return;
    if (detail.actionId === "delete" || detail.actionId === "removeRecord") void deleteBackup(Number(row.id), String(row.label), detail.actionId === "removeRecord");
    else if (detail.actionId === "download") void downloadBackup(Number(row.id), String(row.label));
    else if (detail.actionId === "details") showToast(String(row.error ?? t("errors.backupErrorDetail", "Error del backup")), false);
    else if (detail.actionId === "refresh") void loadBackups();
  });
  window.addEventListener(DATATABLE_EVENTS.QUICK_ACTION, async (event: Event) => {
    const detail = (event as CustomEvent<any>).detail;
    if (!detail || detail.tableId !== BACKUPS_TABLE_ID || detail.actionId !== "delete") return;
    const rows = Array.isArray(detail.rows) ? detail.rows : [];
    if (rows.length === 0) return;
    if (!await openConfirm(fmt(t("confirm.deleteBulkBackup", "¿Eliminar {count} backup(s) seleccionados?"), { count: rows.length }) + " " + t("confirm.cloudBulkNote", "Los objetos S3/R2 se conservarán."), { title: t("confirm.deleteBulkBackupTitle", "Eliminar backups"), variant: "danger" })) return;
    let deleted = 0;
    for (const row of rows) {
      const result = await api.delete(`/api/backups/${row.id}`);
      if (result.ok) deleted++;
    }
    showToast(deleted === rows.length
      ? t("toasts.backupsDeleted", "Backups eliminados")
      : fmt(t("toasts.partialDelete", "Se eliminaron {deleted} de {total} registros."), { deleted, total: rows.length }), deleted === rows.length);
    void loadBackups();
  });
}
