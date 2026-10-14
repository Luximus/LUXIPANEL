// Backups page — "Backup now" dialog + backup job polling, the schedule dialog
// (friendly frequency → cron), and the deleteSchedule global.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260927b";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { fmt, showToast, t } from "./dom";
import { collectSources } from "./sources";
import { loadBackups, loadSchedules } from "./history";
import { getDefaultRetainCount } from "./settings";
import { hydrateSources } from "./sources";
import { resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260927b";
import { openDialog } from "/scripts/extracted/lib/dom.js";

// ── Friendly schedule → cron expression ─────────────────────────────────────
function buildScheduleCron(): string {
  const custom = (document.getElementById("sched-custom-cron") as HTMLInputElement | null)?.value.trim();
  if (custom) return custom;
  const freq = (document.getElementById("sched-freq") as HTMLSelectElement | null)?.value ?? "daily";
  const time = (document.getElementById("sched-time") as HTMLInputElement | null)?.value || "03:00";
  const [hhRaw, mmRaw] = time.split(":");
  const hh = Math.max(0, Math.min(23, parseInt(hhRaw, 10) || 0));
  const mm = Math.max(0, Math.min(59, parseInt(mmRaw, 10) || 0));
  const dow = (document.getElementById("sched-weekday") as HTMLSelectElement | null)?.value ?? "1";
  const dom = (document.getElementById("sched-monthday") as HTMLSelectElement | null)?.value ?? "1";
  switch (freq) {
    case "hourly": return `${mm} * * * *`;
    case "weekly": return `${mm} ${hh} * * ${dow}`;
    case "monthly": return `${mm} ${hh} ${dom} * *`;
    case "daily":
    default: return `${mm} ${hh} * * *`;
  }
}

function syncScheduleControls() {
  const freq = (document.getElementById("sched-freq") as HTMLSelectElement | null)?.value ?? "daily";
  document.getElementById("sched-time-wrap")?.classList.toggle("hidden", freq === "hourly");
  document.getElementById("sched-weekday-wrap")?.classList.toggle("hidden", freq !== "weekly");
  document.getElementById("sched-monthday-wrap")?.classList.toggle("hidden", freq !== "monthly");
  const preview = document.getElementById("sched-cron-preview");
  if (preview) preview.textContent = buildScheduleCron();
  const storage = (document.getElementById("sched-storage") as HTMLSelectElement | null)?.value ?? "local";
  const help = document.getElementById("sched-retention-help");
  if (help) help.textContent = storage === "local"
    ? t("scheduleDialog.localRetentionHint", "Se conservarán las copias locales más recientes de esta programación.")
    : t("scheduleDialog.cloudRetentionHint", "La retención de S3/R2 se configura en el proveedor de nube.");
}

export function bindDialogs() {
  (window as any).deleteSchedule = async (id: number) => {
    if (!await openConfirm(t("confirm.deleteSchedule", "¿Eliminar esta programación?"), { title: t("confirm.deleteScheduleTitle", "Eliminar programación"), variant: "danger" })) return;
    const res = await api.delete(`/api/backups/schedules/${id}`);
    if (res.ok) { showToast(t("toasts.scheduleDeleted", "Programación eliminada")); loadSchedules(); }
    else showToast(t("toasts.errorDelete", "Error al eliminar"), false);
  };

  document.getElementById("btn-backup-now")?.addEventListener("click", () => openDialog("dialog-backup"));
  document.getElementById("backup-close")?.addEventListener("click", () => (document.getElementById("dialog-backup") as HTMLDialogElement).close());
  document.getElementById("backup-cancel")?.addEventListener("click", () => (document.getElementById("dialog-backup") as HTMLDialogElement).close());

  document.getElementById("form-backup")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    document.getElementById("backup-progress")!.classList.remove("hidden");
    const body = {
      label: (document.getElementById("backup-label") as HTMLInputElement).value,
      storageId: (document.getElementById("backup-storage") as HTMLSelectElement).value,
      ...collectSources("bk"),
    };
    const hideProgress = () => document.getElementById("backup-progress")?.classList.add("hidden");
    const res = await api.post<any>("/api/backups", body);
    if (!res.ok) { hideProgress(); showToast(res.error ?? t("toasts.errorCreateBackup", "Error al crear backup"), false); return; }
    (document.getElementById("dialog-backup") as HTMLDialogElement).close();

    // The backup runs in the background on the connected server; poll the job
    // until it actually finishes before reporting success and reloading.
    const jobId = (res.data as any)?.jobId;
    if (!jobId) { hideProgress(); showToast(t("toasts.backupStarted", "Backup iniciado")); void loadBackups(); return; }

    const startedAt = Date.now();
    const targetScope = resolveTargetScope();
    const TIMEOUT_MS = 35 * 60_000;
    let status = "running";
    let error: string | null = null;
    while (Date.now() - startedAt < TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 3000));
      if (!document.getElementById("backup-progress") || resolveTargetScope() !== targetScope) {
        status = "changed";
        break;
      }
      const jr = await api.get<any>(`/api/backups/${jobId}`);
      if (!jr.ok) continue;
      const st = (jr.data as any)?.status;
      if (st && st !== "running") { status = st; error = (jr.data as any)?.error ?? null; break; }
    }
    hideProgress();
    if (status === "completed") showToast(t("toasts.backupCompleted", "Backup completado"));
    else if (status === "failed") showToast(error ? fmt(t("errors.backupErrorDetail", "Error: {error}"), { error }) : t("toasts.errorCreateBackup", "Error al crear backup"), false);
    else if (status !== "changed") showToast(t("toasts.backupStillRunning", "El backup sigue en proceso…"));
    void loadBackups();
  });

  ["sched-freq", "sched-time", "sched-weekday", "sched-monthday", "sched-custom-cron", "sched-storage"].forEach((id) =>
    document.getElementById(id)?.addEventListener("change", syncScheduleControls));
  document.getElementById("sched-custom-cron")?.addEventListener("input", syncScheduleControls);

  document.getElementById("btn-new-schedule")?.addEventListener("click", () => {
    const form = document.getElementById("form-schedule") as HTMLFormElement | null;
    form?.reset();
    const editId = document.getElementById("sched-edit-id") as HTMLInputElement | null;
    const retain = document.getElementById("sched-retention") as HTMLInputElement | null;
    const title = document.getElementById("schedule-dialog-title");
    if (editId) editId.value = "";
    if (retain) { retain.value = String(getDefaultRetainCount()); delete retain.dataset.edited; }
    if (title) title.textContent = t("scheduleDialog.title", "Programar backup");
    hydrateSources("sch", { includeDatabases: true, includePanelConfig: true });
    syncScheduleControls();
    openDialog("dialog-schedule");
  });
  (window as any).openBackupScheduleEditor = (schedule: any) => {
    const set = (id: string, value: string) => {
      const input = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
      if (input) input.value = value;
    };
    set("sched-edit-id", String(schedule.id));
    set("sched-label", String(schedule.name ?? ""));
    set("sched-storage", String(schedule.storageId ?? "local"));
    set("sched-retention", String(schedule.retainCount ?? getDefaultRetainCount()));
    const cron = String(schedule.schedule ?? "");
    const parts = cron.split(/\s+/);
    set("sched-custom-cron", "");
    if (parts.length === 5 && /^\d+$/.test(parts[0])) {
      const [minute, hour, day, month, weekday] = parts;
      if (hour === "*" && day === "*" && month === "*" && weekday === "*") set("sched-freq", "hourly");
      else if (/^\d+$/.test(hour) && day === "*" && month === "*" && weekday === "*") set("sched-freq", "daily");
      else if (/^\d+$/.test(hour) && day === "*" && month === "*" && /^\d+$/.test(weekday)) { set("sched-freq", "weekly"); set("sched-weekday", weekday); }
      else if (/^\d+$/.test(hour) && /^\d+$/.test(day) && month === "*" && weekday === "*") { set("sched-freq", "monthly"); set("sched-monthday", day); }
      else set("sched-custom-cron", cron);
      if (!Number.isNaN(Number(minute)) && (hour === "*" || /^\d+$/.test(hour))) {
        set("sched-time", `${String(hour === "*" ? 3 : Number(hour)).padStart(2, "0")}:${String(Number(minute)).padStart(2, "0")}`);
      }
    } else set("sched-custom-cron", cron);
    const customWrap = document.getElementById("sched-custom-cron-wrap") as HTMLDetailsElement | null;
    if (customWrap) customWrap.open = Boolean((document.getElementById("sched-custom-cron") as HTMLInputElement | null)?.value);
    hydrateSources("sch", schedule);
    const title = document.getElementById("schedule-dialog-title");
    if (title) title.textContent = t("scheduleDialog.editTitle", "Editar programación");
    syncScheduleControls();
    openDialog("dialog-schedule");
  };
  document.getElementById("sched-close")?.addEventListener("click", () => (document.getElementById("dialog-schedule") as HTMLDialogElement).close());
  document.getElementById("sched-cancel")?.addEventListener("click", () => (document.getElementById("dialog-schedule") as HTMLDialogElement).close());

  document.getElementById("form-schedule")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const editId = (document.getElementById("sched-edit-id") as HTMLInputElement).value;
    const body = {
      name: (document.getElementById("sched-label") as HTMLInputElement).value,
      schedule: buildScheduleCron(),
      storageId: (document.getElementById("sched-storage") as HTMLSelectElement).value,
      retainCount: Number((document.getElementById("sched-retention") as HTMLInputElement).value),
      ...collectSources("sch"),
    };
    const res = editId
      ? await api.put(`/api/backups/schedules/${editId}`, body)
      : await api.post("/api/backups/schedules", body);
    if (res.ok) {
      (document.getElementById("dialog-schedule") as HTMLDialogElement).close();
      showToast(editId ? t("toasts.scheduleUpdated", "Programación actualizada") : t("toasts.scheduleCreated", "Programación creada"));
      loadSchedules();
    } else showToast(res.error ?? t("toasts.errorCreateSchedule", "Error al guardar programación"), false);
  });
}
