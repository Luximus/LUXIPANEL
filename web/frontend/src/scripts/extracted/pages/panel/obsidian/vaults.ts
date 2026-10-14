// Obsidian page — vaults list/select/create/unregister + server folder picker.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { state, currentVault, vaultApi } from "./state";
import type { Vault } from "./state";
import { t, fmt, esc, showToast, $ } from "./dom";
import { confirmDiscardDirty, closeEditor } from "./editor";
import { hideSearchResults } from "./search";
import { loadTree } from "./tree";
import { openDialog } from "/scripts/extracted/lib/dom.js";
import { patchPreferences } from "./preferences";

// ── Vaults ───────────────────────────────────────────────────────────────────
// Original "no vaults" markup of #obs-empty, stashed the first time we replace
// it with an inline error so a successful retry can restore the empty state.
export let emptyStateHtml: string | null = null;

export function renderVaultsError(message: string) {
  const empty = $("obs-empty");
  const main = $("obs-main");
  if (empty) {
    if (emptyStateHtml === null) emptyStateHtml = empty.innerHTML;
    empty.innerHTML = `<i class="ti ti-alert-triangle mb-3 inline-block text-4xl text-destructive"></i>
      <p class="mx-auto mb-5 max-w-md text-sm text-destructive">${esc(message)}</p>
      <button id="obs-retry-vaults"
        class="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
        <i class="ti ti-refresh text-base"></i> ${t("actions.retry", "Reintentar")}
      </button>`;
    empty.classList.remove("hidden");
  }
  main?.classList.add("hidden");
  main?.classList.remove("grid");
}

export async function loadVaults(preferId?: string, preferencesReady: Promise<void> = Promise.resolve()) {
  const scopeSeq = state.scopeSeq;
  const request = api.get<Vault[]>("/api/obsidian/vaults");
  await preferencesReady;
  const res = await request;
  if (scopeSeq !== state.scopeSeq) return;
  if (!res.ok) {
    // Persistent inline error (the toast alone left a blank page behind).
    renderVaultsError(res.error ?? t("errors.loadVaults", "No se pudieron cargar los vaults"));
    return;
  }
  state.vaults = res.data ?? [];

  const empty = $("obs-empty");
  const main = $("obs-main");
  if (empty && emptyStateHtml !== null) {
    empty.innerHTML = emptyStateHtml;
    emptyStateHtml = null;
  }
  if (state.vaults.length === 0) {
    state.vaultId = null;
    empty?.classList.remove("hidden");
    main?.classList.add("hidden");
    main?.classList.remove("grid");
    renderVaultSelect();
    updateToolbar();
    renderSettingsVaults();
    return;
  }
  empty?.classList.add("hidden");
  main?.classList.remove("hidden");
  main?.classList.add("grid");

  const keep =
    (preferId && state.vaults.some((v) => v.id === preferId) && preferId) ||
    (state.vaultId && state.vaults.some((v) => v.id === state.vaultId) && state.vaultId) ||
    (state.lastVaultId && state.vaults.some((v) => v.id === state.lastVaultId) && state.lastVaultId) ||
    state.vaults[0]!.id;
  renderVaultSelect();
  await selectVault(keep, true);
  renderSettingsVaults();
}

function renderSettingsVaults() {
  const list = $("obs-settings-vault-list");
  if (!list) return;
  list.innerHTML = state.vaults.map((v) => `<div class="rounded-xl border border-border bg-background p-3">
    <div class="flex items-center justify-between gap-2"><strong class="truncate text-sm">${esc(v.name)}</strong><span class="rounded-full px-2 py-0.5 text-xs ${v.exists ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}">${v.exists ? t("workspace.available", "Disponible") : t("workspace.missing", "No disponible")}</span></div>
    <p class="mt-1 break-all font-mono text-xs text-muted-foreground">${esc(v.path)}</p>
    <p class="mt-1 text-xs text-muted-foreground">${v.noteCount ?? 0} ${t("workspace.notesCount", "notas")}</p>
  </div>`).join("");
}

export function renderVaultSelect() {
  const sel = $("obs-vault-select") as HTMLSelectElement | null;
  if (!sel) return;
  sel.innerHTML = state.vaults
    .map((v) => {
      const count = v.noteCount != null ? fmt(t("labels.noteCount", " · {count} notas"), { count: v.noteCount }) : "";
      const missing = v.exists ? "" : " ⚠";
      return `<option value="${esc(v.id)}">${esc(v.name)}${esc(count)}${missing}</option>`;
    })
    .join("");
  if (state.vaultId) sel.value = state.vaultId;
}

export async function selectVault(id: string, force = false) {
  if (!force && id === state.vaultId) return;
  const scopeSeq = state.scopeSeq;
  if (!(await confirmDiscardDirty())) {
    renderVaultSelect(); // snap the selector back to the current vault
    return;
  }
  if (scopeSeq !== state.scopeSeq) return;
  state.vaultId = id;
  if (state.lastVaultId !== id) {
    state.lastVaultId = id;
    void patchPreferences({ lastVaultId: id });
  }
  state.collapsed = new Set();
  renderVaultSelect();
  closeEditor();
  hideSearchResults();
  updateToolbar();

  const vault = currentVault();
  if (vault && !vault.exists) {
    const tree = $("obs-tree");
    if (tree) {
      tree.innerHTML = `<p class="px-3 py-4 text-xs text-destructive">${fmt(t("errors.vaultMissing", "La carpeta del vault no existe en el servidor ({path}). Desregístralo o restaura la carpeta."), { path: esc(vault.path) })}</p>`;
    }
    state.tree = { folders: [], notes: [] };
    return;
  }
  await loadTree();
}

export function updateToolbar() {
  const hasVault = !!state.vaultId;
  const vault = currentVault();
  const canWrite = !!vault?.canWrite && !!vault.exists;
  for (const id of ["obs-unregister", "obs-prepare-ai"]) {
    const btn = $(id);
    btn?.classList.toggle("hidden", !hasVault);
    btn?.classList.toggle("inline-flex", hasVault);
  }
  const prepare = $("obs-prepare-ai") as HTMLButtonElement | null;
  if (prepare) prepare.disabled = !vault?.exists;
  for (const id of ["obs-toolbar-new-note", "obs-new-note", "obs-new-folder", "obs-daily-append"]) {
    const button = $(id) as HTMLButtonElement | null;
    if (button) button.disabled = !canWrite;
  }
  const today = $("obs-today") as HTMLButtonElement | null;
  if (today) today.disabled = !hasVault || !vault?.exists;
  const status = $("obs-vault-status");
  if (status) {
    status.textContent = !vault ? t("workspace.noVault", "Sin vault") : !vault.exists ? t("workspace.missing", "No disponible") : !canWrite ? t("workspace.readOnly", "Solo lectura") : t("workspace.available", "Disponible");
    status.className = `rounded-full px-2.5 py-1 text-xs ${!vault?.exists ? "bg-amber-500/10 text-amber-600" : !canWrite ? "bg-sky-500/10 text-sky-600" : "bg-emerald-500/10 text-emerald-600"}`;
  }
}

export async function createVault() {
  const nameInput = $("obs-vault-name") as HTMLInputElement | null;
  const pathInput = $("obs-vault-path") as HTMLInputElement | null;
  const mode =
    document.querySelector<HTMLInputElement>('input[name="obs-vault-mode"]:checked')?.value === "register"
      ? "register"
      : "create";
  const name = nameInput?.value.trim() ?? "";
  const path = pathInput?.value.trim() ?? "";
  if (!name || !path) {
    showToast(t("errors.nameAndPathRequired", "Nombre y ruta son obligatorios"), false);
    return;
  }
  if (!path.startsWith("/")) {
    showToast(t("errors.pathMustBeAbsolute", "La ruta debe ser absoluta (empezar por /)"), false);
    return;
  }
  const saveBtn = $("obs-vault-save") as HTMLButtonElement | null;
  if (saveBtn) saveBtn.disabled = true;
  const res = await api.post<Vault>("/api/obsidian/vaults", { name, path, mode });
  if (saveBtn) saveBtn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("errors.createVault", "No se pudo crear el vault"), false);
    return;
  }
  ($("dlg-obs-vault") as HTMLDialogElement | null)?.close();
  if (nameInput) nameInput.value = "";
  if (pathInput) pathInput.value = "";
  showToast(mode === "create" ? t("toasts.vaultCreated", "Vault creado") : t("toasts.vaultRegistered", "Vault registrado"));
  await loadVaults(res.data?.id);
}

// ── Server folder picker for the vault path (same pattern as users module) ──
export let pathBrowserCurrent = "/";

export function parentPath(p: string): string {
  if (!p || p === "/") return "/";
  const trimmed = p.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx <= 0 ? "/" : trimmed.slice(0, idx);
}

export async function loadPathBrowser(path: string) {
  pathBrowserCurrent = path || "/";
  const current = $("obs-path-browser-current");
  const list = $("obs-path-browser-list");
  const errEl = $("obs-path-browser-error");
  if (current) current.textContent = pathBrowserCurrent;
  if (errEl) errEl.classList.add("hidden");
  if (list) list.innerHTML = `<li class="px-3 py-2 text-xs text-muted-foreground">${t("labels.loading", "Cargando…")}</li>`;
  try {
    const res = await api.get<any>(`/api/files/list?path=${encodeURIComponent(pathBrowserCurrent)}`);
    const data = (res.data as any)?.data ?? res.data ?? [];
    const dirs = (Array.isArray(data) ? data : []).filter((e: any) => e.isDir || e.type === "dir");
    if (!list) return;
    list.innerHTML = dirs.length
      ? dirs
          .map((d: any) => `
            <li><button type="button" data-obs-path-nav="${esc(d.path)}" class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent">
              <i class="ti ti-folder text-amber-500"></i><span class="truncate">${esc(d.name)}</span>
            </button></li>`)
          .join("")
      : `<li class="px-3 py-2 text-xs text-muted-foreground">${t("labels.noSubfolders", "(sin subcarpetas)")}</li>`;
  } catch {
    if (errEl) { errEl.textContent = t("errors.listPath", "No se pudo listar esta ruta (¿permisos?)."); errEl.classList.remove("hidden"); }
    if (list) list.innerHTML = "";
  }
}

export function openPathBrowser() {
  const input = $("obs-vault-path") as HTMLInputElement | null;
  const start = input?.value.trim() ?? "";
  openDialog("dlg-obs-path-browser");
  void loadPathBrowser(start.startsWith("/") ? start : "/");
}

export async function unregisterVault() {
  const vault = currentVault();
  if (!vault) return;
  if (!(await confirmDiscardDirty())) return;
  if (
    !(await openConfirm(
      fmt(t("confirm.unregisterBody", "¿Desregistrar el vault \"{name}\"? Los archivos del servidor NO se borran."), { name: vault.name }),
      { title: t("confirm.unregisterTitle", "Desregistrar vault"), confirmText: t("confirm.unregisterConfirm", "Desregistrar"), variant: "danger" },
    ))
  )
    return;
  const res = await api.delete(vaultApi());
  if (!res.ok) {
    showToast(res.error ?? t("errors.unregisterVault", "No se pudo desregistrar el vault"), false);
    return;
  }
  state.vaultId = null;
  state.dirty = false;
  closeEditor();
  showToast(t("toasts.vaultUnregistered", "Vault desregistrado"));
  await loadVaults();
}
