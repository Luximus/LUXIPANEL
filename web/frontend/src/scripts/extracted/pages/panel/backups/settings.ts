// Effective, per-server backup settings. Changing the directory deletes old
// local archives only after a preview and explicit confirmation.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260927b";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { fmt, showToast, t } from "./dom";
import { loadBackups } from "./history";
import { resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260927b";

interface BackupConfig { localDir: string; defaultRetainCount: number }
interface DirectoryPreview { currentDir: string; localDir: string; deleteCount: number; destinationCount: number }

let currentConfig: BackupConfig | null = null;
let saving = false;
let settingsGeneration = 0;

export function getDefaultRetainCount(): number { return currentConfig?.defaultRetainCount ?? 7; }

function field(id: string): HTMLInputElement | null {
  return document.getElementById(id) as HTMLInputElement | null;
}

function setStatus(message: string, error = false) {
  const el = document.getElementById("backup-settings-status");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("text-destructive", error);
  el.classList.toggle("text-muted-foreground", !error);
}

function applyConfig(config: BackupConfig) {
  currentConfig = config;
  const dir = field("s-backup-dir");
  const count = field("s-backup-retention");
  if (dir) dir.value = config.localDir;
  if (count) count.value = String(config.defaultRetainCount);
  const scheduleRetention = field("sched-retention");
  if (scheduleRetention && !scheduleRetention.dataset.edited) scheduleRetention.value = String(config.defaultRetainCount);
}

export async function loadBackupSettings() {
  const generation = ++settingsGeneration;
  const scope = resolveTargetScope();
  const root = document.getElementById("btn-backup-now");
  currentConfig = null;
  const dir = field("s-backup-dir");
  const count = field("s-backup-retention");
  if (dir) dir.value = "";
  if (count) count.value = "";
  setStatus(t("settings.loading", "Cargando configuración…"));
  const res = await api.get<BackupConfig>("/api/backups/config");
  if (generation !== settingsGeneration || scope !== resolveTargetScope()
    || root !== document.getElementById("btn-backup-now")) return;
  if (!res.ok || !res.data) {
    setStatus(res.error ?? t("settings.loadError", "No se pudo cargar la configuración del servidor."), true);
    return;
  }
  applyConfig(res.data);
  setStatus("");
}

export function selectBackupDir(path: string) {
  const input = field("s-backup-dir");
  if (!input) return;
  input.value = path;
  setStatus(t("settings.pending", "Hay cambios sin guardar."));
}

async function saveSettings() {
  if (saving || !currentConfig) return;
  const targetScope = resolveTargetScope();
  let workingConfig = { ...currentConfig };
  const localDir = field("s-backup-dir")?.value.trim() ?? "";
  const retainCount = Number(field("s-backup-retention")?.value);
  if (!Number.isInteger(retainCount) || retainCount < 1 || retainCount > 365) {
    setStatus(t("settings.countError", "Elige entre 1 y 365 copias."), true);
    return;
  }
  saving = true;
  const saveButton = document.getElementById("backup-settings-save") as HTMLButtonElement | null;
  if (saveButton) saveButton.disabled = true;
  setStatus(t("settings.saving", "Guardando…"));
  try {
    if (localDir !== workingConfig.localDir) {
      const preview = await api.post<DirectoryPreview>("/api/backups/config/directory/preview", { localDir });
      if (!preview.ok || !preview.data) throw new Error(preview.error ?? t("settings.previewError", "No se pudo revisar la carpeta."));
      if (preview.data.destinationCount > 0) throw new Error(t("settings.destinationNotEmpty", "La carpeta nueva ya contiene backups de LUXIPANEL."));
      const message = fmt(t("settings.changeConfirm", "Se eliminarán {count} copias locales de {path}. Las copias S3/R2 se conservarán. ¿Cambiar la carpeta?"), {
        count: preview.data.deleteCount, path: preview.data.currentDir,
      });
      const confirmed = await openConfirm(message, { title: t("settings.changeTitle", "Cambiar carpeta de backups"), variant: "danger" });
      if (!confirmed) { setStatus(t("settings.pending", "Hay cambios sin guardar.")); return; }
      if (resolveTargetScope() !== targetScope) throw new Error(t("settings.targetChanged", "El servidor cambió; vuelve a revisar la configuración."));
      const changed = await api.post<BackupConfig>("/api/backups/config/directory", {
        localDir, expectedOldDir: workingConfig.localDir, expectedDeleteCount: preview.data.deleteCount, confirmDelete: true,
      });
      if (!changed.ok || !changed.data) throw new Error(changed.error ?? t("settings.changeError", "No se pudo cambiar la carpeta."));
      if (resolveTargetScope() !== targetScope) throw new Error(t("settings.targetChanged", "El servidor cambió; vuelve a revisar la configuración."));
      workingConfig = { ...workingConfig, localDir: changed.data.localDir };
      currentConfig = workingConfig;
      void loadBackups();
    }
    if (retainCount !== workingConfig.defaultRetainCount) {
      const updated = await api.put<BackupConfig>("/api/backups/config", { defaultRetainCount: retainCount });
      if (!updated.ok || !updated.data) throw new Error(updated.error ?? t("toasts.errorSaveSettings", "Error al guardar configuración de backups"));
      if (resolveTargetScope() !== targetScope) throw new Error(t("settings.targetChanged", "El servidor cambió; vuelve a revisar la configuración."));
      workingConfig = updated.data;
      currentConfig = workingConfig;
    }
    applyConfig(workingConfig);
    setStatus(t("settings.saved", "Configuración guardada."));
    showToast(t("settings.saved", "Configuración guardada."));
  } catch (err) {
    if (resolveTargetScope() === targetScope) {
      setStatus((err as Error).message, true);
      showToast((err as Error).message, false);
    }
  } finally {
    saving = false;
    if (saveButton) saveButton.disabled = false;
  }
}

export function bindSettingsControls() {
  document.getElementById("backup-settings-save")?.addEventListener("click", () => void saveSettings());
  field("s-backup-retention")?.addEventListener("input", () => setStatus(t("settings.pending", "Hay cambios sin guardar.")));
  field("sched-retention")?.addEventListener("input", () => {
    const input = field("sched-retention");
    if (input) input.dataset.edited = "true";
  });
}
