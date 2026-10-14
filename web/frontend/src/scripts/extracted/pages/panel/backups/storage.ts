import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
// Backups page — cloud storage targets (S3 / R2): DataTable feed, select
// population, the storage dialog (inherits central creds), and CRUD.
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260927b";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { fmt, showToast, t } from "./dom";
import { escapeHtml } from "/scripts/extracted/lib/escape.js";
import { readCfg } from "./settings-table";
const storagePages = createTablePages({ catalog:["id","name","provider"], tableId: "backup-storages-table", events: window, scope: resolveTargetScope, reload: () => loadStorages(), field: "auto" });

// ── Cloud storage targets (S3 / R2) CRUD ────────────────────────────────────
export const STORAGES_TABLE_ID = "backup-storages-table";
let storagesTableReady = false;
let storagesCachedRows: any[] = [];
let storageList: any[] = [];
let storageCatalog: any[] = [];
let storageLoadError: string | null = null;

function renderStorageCards() {
  const cards = document.getElementById("backup-storage-cards");
  if (!cards) return;
  if (storageLoadError) {
    cards.textContent = storageLoadError;
    return;
  }
  const hidden = new Set(readCfg(STORAGES_TABLE_ID).hiddenActions);
  cards.innerHTML = storageList.length ? storageList.map((s) => `
    <article class="rounded-xl border border-border bg-card p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0"><p class="truncate text-sm font-semibold">${escapeHtml(s.name)}</p>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(String(s.provider).toUpperCase())} · ${escapeHtml(s.bucket)}</p>
          ${s.prefix ? `<p class="mt-1 truncate font-mono text-xs text-muted-foreground">${escapeHtml(s.prefix)}</p>` : ""}
        </div>
        ${hidden.has("edit") && hidden.has("delete") ? "" : `<div class="flex shrink-0 gap-1">
          ${hidden.has("edit") ? "" : `<button type="button" data-storage-card-action="edit" data-storage-id="${Number(s.id)}" aria-label="${escapeHtml(t("labels.editStorage", "Editar destino"))}" class="rounded-md p-2 hover:bg-accent"><i class="ti ti-pencil" aria-hidden></i></button>`}
          ${hidden.has("delete") ? "" : `<button type="button" data-storage-card-action="delete" data-storage-id="${Number(s.id)}" aria-label="${escapeHtml(t("labels.deleteStorage", "Eliminar destino"))}" class="rounded-md p-2 text-destructive hover:bg-destructive/10"><i class="ti ti-trash" aria-hidden></i></button>`}
        </div>`}
      </div>
    </article>`).join("") : `<p class="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">${escapeHtml(t("empty.noStorages", "No hay destinos de nube configurados."))}</p>`;
}

export function clearStoragesView() {
  storageList = [];
  storageLoadError = null;
  publishStoragesRows([]);
  populateStorageSelects();
  renderStorageCards();
}

function publishStoragesRows(rows: any[]) {
  storagesCachedRows = Array.isArray(rows) ? rows : [];
  if (!storagesTableReady) return;
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_DATA, { detail: { tableId: STORAGES_TABLE_ID, data: storagesCachedRows } }));
}

function populateStorageSelects() {
  for (const id of ["backup-storage", "sched-storage"]) {
    const sel = document.getElementById(id) as HTMLSelectElement | null;
    if (!sel) continue;
    const prev = sel.value;
    while (sel.options.length > 1) sel.remove(1); // keep the "Local" option
    for (const s of storageCatalog) {
      const opt = document.createElement("option");
      opt.value = String(s.id);
      opt.textContent = `${s.name} (${String(s.provider).toUpperCase()})`;
      sel.appendChild(opt);
    }
    if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
  }
}

export async function loadStorages() {
  storageList = [];
  storageLoadError = null;
  populateStorageSelects();
  const res = await storagePages.read<any>(params => api.get<any>("/api/backups/storages", {params}));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  if (!res.ok) {
    storageLoadError = res.error ?? t("errors.listStoragesFailed", "No se pudieron cargar los destinos.");
    renderStorageCards();
    return;
  }
  storageCatalog = res.meta?.tableWindow?.catalog ?? res.data ?? [];
  storageList = ((res.data as any)?.data ?? res.data ?? []) as any[];
  publishStoragesRows(storageList.map((s) => ({
    id: s.id, name: s.name, provider: s.provider, bucket: s.bucket, endpoint: s.endpoint || "—",
  })));
  populateStorageSelects();
  renderStorageCards();
}

// Las credenciales S3/R2 ya NO se registran en Backups: viven en
// Ajustes → Credenciales (account-level). El diálogo solo define el bucket;
// el target hereda la credencial central del proveedor. Si el proveedor no
// tiene credencial, se muestra un aviso con redirección y se bloquea guardar.
const centralProviders = new Set<string>();

async function refreshCentralProviders() {
  try {
    const res = await api.get<any[]>("/api/backups/provider-creds");
    centralProviders.clear();
    if (res.ok && Array.isArray(res.data)) {
      for (const c of res.data) if (c?.configured && c?.provider) centralProviders.add(String(c.provider));
    }
  } catch { /* deja el aviso en estado por defecto */ }
}

function providerLabel(provider: string): string {
  return provider === "r2" ? "Cloudflare R2" : "Amazon S3 / compatible";
}

function syncStorageProviderFields() {
  const provider = (document.getElementById("storage-provider") as HTMLSelectElement | null)?.value ?? "s3";
  const central = centralProviders.has(provider);
  const okNotice = document.getElementById("storage-central-notice");
  okNotice?.classList.toggle("hidden", !central);
  okNotice?.classList.toggle("flex", central);
  const okText = document.getElementById("storage-central-notice-text");
  if (okText) okText.textContent = t("storageDialog.usingCentralCred", "Usando la credencial central de Ajustes → Credenciales (solo defines el bucket).");

  const req = document.getElementById("storage-cred-required");
  req?.classList.toggle("hidden", central);
  const reqText = document.getElementById("storage-cred-required-text");
  if (reqText) reqText.textContent = fmt(t("storageDialog.credRequired", "No hay credencial de {provider} configurada. Regístrala en Ajustes → Credenciales para usar este destino."), { provider: providerLabel(provider) });
  const reqCta = document.getElementById("storage-cred-required-cta");
  if (reqCta) reqCta.textContent = t("storageDialog.credRequiredCta", "Ir a Ajustes → Credenciales");

  const save = document.getElementById("storage-save") as HTMLButtonElement | null;
  if (save) save.disabled = !central;
}

async function openStorageDialog(existing?: any) {
  const dlg = document.getElementById("dialog-storage") as HTMLDialogElement | null;
  if (!dlg) return;
  await refreshCentralProviders();
  const set = (id: string, v: string) => { const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null; if (el) el.value = v; };
  set("storage-id", existing ? String(existing.id) : "");
  set("storage-name", existing?.name ?? "");
  set("storage-provider", existing?.provider ?? "s3");
  set("storage-bucket", existing?.bucket ?? "");
  set("storage-prefix", existing?.prefix ?? "");
  const title = document.getElementById("storage-title");
  if (title) title.textContent = existing ? (title.dataset.edit ?? t("labels.editStorage", "Editar storage")) : (title.dataset.new ?? t("labels.newStorage", "Nuevo storage"));
  syncStorageProviderFields();
  dlg.showModal();
}

async function deleteStorage(id: number, name: string) {
  if (!await openConfirm(fmt(t("confirm.deleteStorage", "¿Eliminar el storage \"{name}\"?"), { name }), { title: t("confirm.deleteStorageTitle", "Eliminar storage"), variant: "danger" })) return;
  const res = await api.delete(`/api/backups/storages/${id}`);
  if (res.ok) { showToast(t("toasts.storageDeleted", "Storage eliminado")); void loadStorages(); }
  else showToast(t("toasts.errorDelete", "Error al eliminar"), false);
}

let storagesEventsBound = false;
function bindStoragesTableEvents() {
  if (storagesEventsBound) return;
  storagesEventsBound = true;
  window.addEventListener("lxp:data-table:apply-prefs", (event: Event) => {
    if ((event as CustomEvent<{ tableId?: string }>).detail?.tableId === STORAGES_TABLE_ID) {
      renderStorageCards();
    }
  });
  window.addEventListener(DATATABLE_EVENTS.READY, (event: Event) => {
    const detail = (event as CustomEvent<any>).detail;
    if (detail?.tableId !== STORAGES_TABLE_ID) return;
    storagesTableReady = true;
    publishStoragesRows(storagesCachedRows);
  });
  window.addEventListener(DATATABLE_EVENTS.ROW_ACTION, (event: Event) => {
    const detail = (event as CustomEvent<any>).detail;
    if (!detail || detail.tableId !== STORAGES_TABLE_ID || !detail.row) return;
    const full = storageList.find((s) => String(s.id) === String(detail.row.id));
    if (detail.actionId === "edit") openStorageDialog(full ?? detail.row);
    else if (detail.actionId === "delete") void deleteStorage(Number(detail.row.id), String(detail.row.name));
  });
}

export function bindStorageControls() {
  document.getElementById("backup-storage-cards")?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-storage-card-action]");
    if (!button) return;
    const storage = storageList.find((item) => Number(item.id) === Number(button.dataset.storageId));
    if (!storage) return;
    if (button.dataset.storageCardAction === "edit") void openStorageDialog(storage);
    else void deleteStorage(Number(storage.id), String(storage.name));
  });
  document.getElementById("storage-provider")?.addEventListener("change", syncStorageProviderFields);
  document.getElementById("btn-new-storage")?.addEventListener("click", () => openStorageDialog());
  document.getElementById("storage-close")?.addEventListener("click", () => (document.getElementById("dialog-storage") as HTMLDialogElement).close());
  document.getElementById("storage-cancel")?.addEventListener("click", () => (document.getElementById("dialog-storage") as HTMLDialogElement).close());

  document.getElementById("form-storage")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = (document.getElementById("storage-id") as HTMLInputElement).value;
    const provider = (document.getElementById("storage-provider") as HTMLSelectElement).value;
    // Sin credencial central no se puede crear el destino: redirige a Credenciales.
    if (!centralProviders.has(provider)) {
      showToast(fmt(t("storageDialog.credRequired", "No hay credencial de {provider} configurada. Regístrala en Ajustes → Credenciales para usar este destino."), { provider: providerLabel(provider) }), false);
      return;
    }
    // El target solo lleva bucket/nombre/prefijo; hereda la credencial central
    // (resolve() la inyecta al hacer el backup). NUNCA registra llaves aquí.
    const body: Record<string, string> = {
      name: (document.getElementById("storage-name") as HTMLInputElement).value,
      provider,
      bucket: (document.getElementById("storage-bucket") as HTMLInputElement).value,
      prefix: (document.getElementById("storage-prefix") as HTMLInputElement).value,
    };
    const res = id
      ? await api.put<any>(`/api/backups/storages/${id}`, body)
      : await api.post<any>("/api/backups/storages", body);
    if (res.ok) {
      (document.getElementById("dialog-storage") as HTMLDialogElement).close();
      showToast(id ? t("toasts.storageUpdated", "Storage actualizado") : t("toasts.storageCreated", "Storage creado"));
      void loadStorages();
    } else showToast(res.error ?? t("toasts.errorSaveStorage", "Error al guardar storage"), false);
  });

  bindStoragesTableEvents();
}
