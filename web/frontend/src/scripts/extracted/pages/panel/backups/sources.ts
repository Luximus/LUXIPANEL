// Backups page — database picker and per-dialog source selectors.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260927b";
import { escapeHtml } from "/scripts/extracted/lib/escape.js";
import { t } from "./dom";
import { openPathBrowser } from "./path-browser";
import type { DbSelection, SourcesController } from "./types";

// ── Database picker dialog (shared, targets one SourcesController) ──────────
let dbPickerTarget: SourcesController | null = null;
let dbPickerRequestId = 0;

interface BackupDatabaseGroup {
  type: "mysql" | "postgresql";
  label: string;
  installed: boolean;
  running: boolean;
  databases: string[];
  error: boolean;
}

async function openDbPicker(target: SourcesController) {
  dbPickerTarget = target;
  const requestId = ++dbPickerRequestId;
  const dlg = document.getElementById("dialog-db-picker") as HTMLDialogElement | null;
  if (!dlg) return;
  const list = document.getElementById("db-picker-list");
  const errEl = document.getElementById("db-picker-error");
  const selectButton = document.getElementById("db-picker-select") as HTMLButtonElement | null;
  const retryButton = document.getElementById("db-picker-retry") as HTMLButtonElement | null;
  if (errEl) errEl.classList.add("hidden");
  if (selectButton) selectButton.disabled = true;
  if (retryButton) retryButton.classList.add("hidden");
  if (list) list.innerHTML = `<p class="px-1 py-2 text-xs text-muted-foreground">${t("labels.loading", "Cargando…")}</p>`;
  list?.setAttribute("aria-busy", "true");
  if (!dlg.open) dlg.showModal();

  try {
    const result = await api.get<BackupDatabaseGroup[]>("/api/backups/databases");
    if (requestId !== dbPickerRequestId || !dlg.open) return;
    if (!result.ok) throw new Error(result.error ?? t("errors.listDbFailed", "No se pudieron listar las bases de datos."));
    if (!Array.isArray(result.data)) throw new Error(t("errors.listDbFailed", "No se pudieron listar las bases de datos."));
    const usable = result.data.filter((engine) => engine.installed && engine.running);
    if (usable.length === 0) {
      if (list) list.innerHTML = `<p class="px-1 py-2 text-xs text-muted-foreground">${t("empty.noDbEngines", "No se detectaron motores de BD activos.")}</p>`;
      retryButton?.classList.remove("hidden");
      return;
    }
    const current = new Set(target.getDatabases().map((s) => `${s.engine}:${s.name}`));
    const groups: string[] = [];
    const available = new Set<string>();
    const failed: string[] = [];
    for (const eng of usable) {
      if (eng.error) failed.push(eng.label);
      const names = Array.isArray(eng.databases) ? eng.databases.filter((name): name is string => typeof name === "string" && name.length > 0) : [];
      const rows = names.map((name) => {
        const id = `${eng.type}:${name}`;
        available.add(id);
        const checked = current.has(id) ? "checked" : "";
        return `<label class="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent/50 cursor-pointer">
            <input type="checkbox" class="h-4 w-4 rounded border-input text-primary" data-db-engine="${eng.type}" data-db-name="${encodeURIComponent(name)}" ${checked} />
            <span class="truncate">${escapeHtml(name)}</span>
          </label>`;
      }).join("");
      groups.push(`<div class="space-y-1">
          <p class="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">${escapeHtml(eng.label)}</p>
          ${eng.error ? `<p class="px-2 py-1 text-xs text-destructive">${t("errors.listDbFailed", "No se pudieron listar las bases de datos.")}</p>` : rows || `<p class="px-2 py-1 text-xs text-muted-foreground">${t("empty.noDatabases", "(sin bases de datos)")}</p>`}
        </div>`);
    }
    if (list) list.innerHTML = groups.join("");
    const missingSelection = [...current].some((id) => !available.has(id));
    if (failed.length || missingSelection) {
      if (errEl) {
        errEl.textContent = failed.length
          ? `${t("errors.listDbFailed", "No se pudieron listar las bases de datos.")} ${failed.join(", ")}`
          : t("dbPickerDialog.unavailableSelection", "Una base de datos seleccionada ya no está disponible. Revisa la selección.");
        errEl.classList.remove("hidden");
      }
      retryButton?.classList.remove("hidden");
    } else if (selectButton) {
      selectButton.disabled = available.size === 0;
    }
  } catch (error) {
    if (requestId !== dbPickerRequestId || !dlg.open) return;
    if (errEl) { errEl.textContent = error instanceof Error ? error.message : t("errors.listDbFailed", "No se pudieron listar las bases de datos."); errEl.classList.remove("hidden"); }
    if (list) list.innerHTML = "";
    retryButton?.classList.remove("hidden");
  } finally {
    if (requestId === dbPickerRequestId) list?.removeAttribute("aria-busy");
  }
}

function confirmDbPicker() {
  const list = document.getElementById("db-picker-list");
  const sel: DbSelection[] = [];
  list?.querySelectorAll<HTMLInputElement>("input[data-db-name]:checked").forEach((cb) => {
    sel.push({ engine: cb.dataset.dbEngine as "mysql" | "postgresql", name: decodeURIComponent(cb.dataset.dbName ?? "") });
  });
  dbPickerTarget?.setDatabases(sel);
  (document.getElementById("dialog-db-picker") as HTMLDialogElement | null)?.close();
}

// ── Source selector factory (one per dialog, namespaced by `prefix`) ────────
const sourceControllers = new Map<string, SourcesController>();
function setupBackupSources(prefix: string): SourcesController | null {
  const root = document.querySelector<HTMLElement>(`[data-sources="${prefix}"]`);
  if (!root) return null;

  let folders: string[] = [];
  let databases: DbSelection[] = [];

  const $ = <T extends HTMLElement = HTMLElement>(suffix: string) =>
    document.getElementById(`${prefix}-${suffix}`) as T | null;

  const customPane = $(`custom`);
  const dbToggle = $<HTMLInputElement>(`db`);
  const dbDetail = $(`db-detail`);
  const dbPick = $(`db-pick`);
  const dbChips = $(`db-chips`);
  const foldersEl = $(`folders`);
  const noFoldersText = foldersEl?.dataset.noFolders ?? "";

  function scope(): "full" | "custom" {
    const checked = root!.querySelector<HTMLInputElement>(`input[name="${prefix}-scope"]:checked`);
    return (checked?.value as "full" | "custom") ?? "custom";
  }
  function dbMode(): "all" | "pick" {
    const checked = root!.querySelector<HTMLInputElement>(`input[name="${prefix}-db-mode"]:checked`);
    return (checked?.value as "all" | "pick") ?? "all";
  }

  function syncVisibility() {
    if (customPane) customPane.classList.toggle("hidden", scope() === "full");
    const dbOn = !!dbToggle?.checked;
    if (dbDetail) dbDetail.classList.toggle("opacity-40", !dbOn);
    if (dbDetail) dbDetail.classList.toggle("pointer-events-none", !dbOn);
    if (dbPick) dbPick.classList.toggle("hidden", dbMode() !== "pick");
  }

  function renderDbChips() {
    if (!dbChips) return;
    if (databases.length === 0) {
      dbChips.innerHTML = dbChips.dataset.empty ?? t("empty.noneSelected", "Ninguna seleccionada");
      return;
    }
    dbChips.innerHTML = databases.map((d, i) =>
      `<span class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
          <i class="ti ti-database text-[11px]"></i>${escapeHtml(d.name)}
          <button type="button" data-rm-db="${i}" class="hover:text-destructive"><i class="ti ti-x text-[11px]"></i></button>
        </span>`).join("");
  }

  function renderFolderChips() {
    if (!foldersEl) return;
    if (folders.length === 0) { foldersEl.innerHTML = noFoldersText; return; }
    foldersEl.innerHTML = folders.map((p, i) =>
      `<span class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-mono">
          <i class="ti ti-folder text-amber-500 text-[11px]"></i>${escapeHtml(p)}
          <button type="button" data-rm-folder="${i}" class="hover:text-destructive"><i class="ti ti-x text-[11px]"></i></button>
        </span>`).join("");
  }

  // Wire events
  root.querySelectorAll<HTMLInputElement>(`input[name="${prefix}-scope"]`).forEach((r) =>
    r.addEventListener("change", syncVisibility));
  root.querySelectorAll<HTMLInputElement>(`input[name="${prefix}-db-mode"]`).forEach((r) =>
    r.addEventListener("change", syncVisibility));
  dbToggle?.addEventListener("change", syncVisibility);
  $(`db-choose`)?.addEventListener("click", () => void openDbPicker(controller));
  $(`add-folder`)?.addEventListener("click", () =>
    openPathBrowser("source", controller, folders[folders.length - 1]));
  dbChips?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-rm-db]");
    if (!btn) return;
    databases.splice(Number(btn.dataset.rmDb), 1);
    renderDbChips();
  });
  foldersEl?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-rm-folder]");
    if (!btn) return;
    folders.splice(Number(btn.dataset.rmFolder), 1);
    renderFolderChips();
  });
  if (dbChips) dbChips.dataset.empty = dbChips.textContent ?? "";

  const controller: SourcesController = {
    addFolder(path: string) {
      const p = (path || "").trim();
      if (p && !folders.includes(p)) { folders.push(p); renderFolderChips(); }
    },
    setDatabases(sel: DbSelection[]) {
      databases = sel;
      // Auto-switch to "pick" mode when a selection is made.
      if (sel.length > 0) {
        const pickRadio = root!.querySelector<HTMLInputElement>(`input[name="${prefix}-db-mode"][value="pick"]`);
        if (pickRadio) pickRadio.checked = true;
        if (dbToggle) dbToggle.checked = true;
      }
      renderDbChips();
      syncVisibility();
    },
    getDatabases: () => databases,
    hydrate(value) {
      const scopeValue = value.fullServer ? "full" : "custom";
      const scopeRadio = root!.querySelector<HTMLInputElement>(`input[name="${prefix}-scope"][value="${scopeValue}"]`);
      if (scopeRadio) scopeRadio.checked = true;
      if (dbToggle) dbToggle.checked = Boolean(value.includeDatabases);
      if ($<HTMLInputElement>(`mail`)) $<HTMLInputElement>(`mail`)!.checked = Boolean(value.includeMail);
      if ($<HTMLInputElement>(`panel`)) $<HTMLInputElement>(`panel`)!.checked = Boolean(value.includePanelConfig);
      folders = Array.isArray(value.includePaths) ? [...value.includePaths] : [];
      databases = Array.isArray(value.databaseSelections) ? [...value.databaseSelections] : [];
      const mode = databases.length > 0 ? "pick" : "all";
      const modeRadio = root!.querySelector<HTMLInputElement>(`input[name="${prefix}-db-mode"][value="${mode}"]`);
      if (modeRadio) modeRadio.checked = true;
      renderDbChips();
      renderFolderChips();
      syncVisibility();
    },
  };

  syncVisibility();
  renderDbChips();
  renderFolderChips();

  // Public collect() stashed on the element for the form submit handlers.
  (root as any).__collect = () => {
    if (scope() === "full") return { fullServer: true };
    return {
      includeDatabases: !!dbToggle?.checked,
      databaseSelections: dbToggle?.checked && dbMode() === "pick" ? databases : [],
      includeMail: !!$<HTMLInputElement>(`mail`)?.checked,
      includePanelConfig: !!$<HTMLInputElement>(`panel`)?.checked,
      includePaths: folders.slice(),
    };
  };
  sourceControllers.set(prefix, controller);
  return controller;
}

export function hydrateSources(prefix: string, value: Parameters<SourcesController["hydrate"]>[0]) {
  sourceControllers.get(prefix)?.hydrate(value);
}

export function collectSources(prefix: string): Record<string, unknown> {
  const root = document.querySelector<HTMLElement>(`[data-sources="${prefix}"]`);
  const fn = root && (root as any).__collect;
  return typeof fn === "function" ? fn() : {};
}

export function bindSourcesControls() {
  // Database picker dialog
  const closeDbPicker = () => {
    dbPickerRequestId++;
    dbPickerTarget = null;
    (document.getElementById("dialog-db-picker") as HTMLDialogElement | null)?.close();
  };
  document.getElementById("db-picker-close")?.addEventListener("click", closeDbPicker);
  document.getElementById("db-picker-cancel")?.addEventListener("click", closeDbPicker);
  document.getElementById("db-picker-select")?.addEventListener("click", confirmDbPicker);
  document.getElementById("db-picker-retry")?.addEventListener("click", () => {
    if (dbPickerTarget) void openDbPicker(dbPickerTarget);
  });

  // Source selectors (one per dialog)
  setupBackupSources("bk");
  setupBackupSources("sch");
}
