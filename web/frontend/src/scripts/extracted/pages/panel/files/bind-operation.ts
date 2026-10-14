// Operational settings for the connected server; admin-only markup and API.
import { t } from "./i18n";
import { showToast } from "./toast";
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";

type FilesConfig = {
  uploadMaxBytes: number;
  snapshotsEnabled: boolean;
  snapshotMaxBytes: number;
  snapshotMaxPerPath: number;
  snapshotMaxTotal: number;
  sharingEnabled: boolean;
  shareMaxExpiryMin: number;
  sharePasswordRequired: boolean;
  ceilings: Omit<FilesConfig, "ceilings">;
};

const MiB = 1024 * 1024;
const input = (id: string) => document.getElementById(id) as HTMLInputElement | null;
const number = (id: string) => Number(input(id)?.value);

function showConfig(data: FilesConfig): void {
  if (input("files-config-upload-mib")) input("files-config-upload-mib")!.value = String(Math.floor(data.uploadMaxBytes / MiB));
  if (input("files-config-snapshot-mib")) input("files-config-snapshot-mib")!.value = String(Math.floor(data.snapshotMaxBytes / MiB));
  if (input("files-config-snapshot-path")) input("files-config-snapshot-path")!.value = String(data.snapshotMaxPerPath);
  if (input("files-config-snapshot-total")) input("files-config-snapshot-total")!.value = String(data.snapshotMaxTotal);
  if (input("files-config-share-hours")) input("files-config-share-hours")!.value = String(Math.floor(data.shareMaxExpiryMin / 60));
  for (const [id, checked] of [
    ["files-config-snapshots-enabled", data.snapshotsEnabled],
    ["files-config-sharing-enabled", data.sharingEnabled],
    ["files-config-share-password", data.sharePasswordRequired],
  ] as const) { const el = input(id); if (el) el.checked = checked; }
  const maxUpload = Math.floor(data.ceilings.uploadMaxBytes / MiB);
  const cap = document.getElementById("files-config-upload-ceiling");
  if (cap) cap.textContent = `${t("settings.operation.ceiling", "Tope del entorno")}: ${maxUpload} MiB`;
  input("files-config-upload-mib")?.setAttribute("max", String(maxUpload));
  input("files-config-snapshot-mib")?.setAttribute("max", String(Math.floor(data.ceilings.snapshotMaxBytes / MiB)));
  input("files-config-snapshot-path")?.setAttribute("max", String(data.ceilings.snapshotMaxPerPath));
  input("files-config-snapshot-total")?.setAttribute("max", String(data.ceilings.snapshotMaxTotal));
  const status = document.getElementById("files-config-status");
  if (status) status.textContent = `${t("settings.operation.uploadLimit", "Subida")}: ${Math.floor(data.uploadMaxBytes / MiB)} MiB · ${t("settings.operation.snapshots", "Copias")}: ${data.snapshotsEnabled ? data.snapshotMaxTotal : t("labels.off", "desactivadas")} · ${t("settings.operation.shares", "Enlaces")}: ${data.sharingEnabled ? t("labels.on", "activos") : t("labels.off", "desactivados")}`;
}

async function loadConfig(): Promise<void> {
  const res = await api.get<FilesConfig>("/api/files/config");
  if (res.ok && res.data) showConfig(res.data);
  else { const status = document.getElementById("files-config-status"); if (status) status.textContent = res.error || t("status.error", "No se pudo cargar la política"); }
}

export function bindFilesOperation(): void {
  const form = document.getElementById("files-operation-form") as HTMLFormElement | null;
  if (!form || form.dataset.lxpBound === "1") return;
  form.dataset.lxpBound = "1";
  void loadConfig();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = ["files-config-upload-mib", "files-config-snapshot-mib", "files-config-snapshot-path", "files-config-snapshot-total", "files-config-share-hours"];
    if (fields.some((id) => !Number.isInteger(number(id)) || number(id) < 1)) {
      showToast(t("settings.operation.invalid", "Introduce límites enteros mayores que cero"), false);
      return;
    }
    const button = document.getElementById("files-config-save") as HTMLButtonElement | null;
    if (button) button.disabled = true;
    try {
      const res = await api.patch<FilesConfig>("/api/files/config", {
        uploadMaxBytes: number("files-config-upload-mib") * MiB,
        snapshotsEnabled: input("files-config-snapshots-enabled")?.checked === true,
        snapshotMaxBytes: number("files-config-snapshot-mib") * MiB,
        snapshotMaxPerPath: number("files-config-snapshot-path"),
        snapshotMaxTotal: number("files-config-snapshot-total"),
        sharingEnabled: input("files-config-sharing-enabled")?.checked === true,
        shareMaxExpiryMin: number("files-config-share-hours") * 60,
        sharePasswordRequired: input("files-config-share-password")?.checked === true,
      });
      if (!res.ok || !res.data) { showToast(res.error || t("toasts.saveError2", "No se pudo guardar"), false); return; }
      showConfig(res.data);
      showToast(t("settings.operation.saved", "Política guardada"));
    } finally { if (button) button.disabled = false; }
  });
  document.getElementById("files-config-prune")?.addEventListener("click", async () => {
    const preview = await api.get<{ count: number; bytes: number; total: number }>("/api/files/config/prune-preview");
    if (!preview.ok || !preview.data) { showToast(preview.error || t("status.error", "No se pudo revisar la limpieza"), false); return; }
    if (preview.data.count === 0) { showToast(t("settings.operation.nothingToPrune", "No hay copias para limpiar")); return; }
    const approved = await openConfirm(`${preview.data.count} ${t("settings.operation.pruneConfirm", "copias antiguas se eliminarán permanentemente")} (${(preview.data.bytes / MiB).toFixed(1)} MiB).`, { title: t("settings.operation.prune", "Limpiar copias"), variant: "danger" });
    if (!approved) return;
    const result = await api.post("/api/files/config/prune");
    showToast(result.ok ? t("settings.operation.pruned", "Copias antiguas eliminadas") : result.error || t("status.error", "No se pudieron limpiar las copias"), result.ok);
  });
}
