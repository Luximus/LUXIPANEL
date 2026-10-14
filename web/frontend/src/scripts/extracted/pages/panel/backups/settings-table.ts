// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Backups config drawer — per-table preferences (page size + which row actions
 * are shown). Reads/writes the generic DataTable prefs contract:
 *   localStorage  lxp:data-table:prefs:<tableId>  = { pageSize, hiddenActions }
 *   window event  lxp:data-table:apply-prefs      { tableId, pageSize, hiddenActions }
 * The generic DataTable consumes `apply-prefs` and applies both.
 */

interface TableCfg {
  pageSize: number;
  hiddenActions: string[];
}

function prefsKey(tableId: string): string {
  return `lxp:data-table:prefs:${tableId}`;
}

export function readCfg(tableId: string): TableCfg {
  try {
    const raw = window.localStorage.getItem(prefsKey(tableId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TableCfg>;
      return {
        pageSize: typeof parsed.pageSize === "number" ? parsed.pageSize : 25,
        hiddenActions: Array.isArray(parsed.hiddenActions) ? parsed.hiddenActions.map(String) : [],
      };
    }
  } catch {
    /* storage unavailable */
  }
  return { pageSize: 25, hiddenActions: [] };
}

function writeCfg(tableId: string, cfg: TableCfg): void {
  try {
    window.localStorage.setItem(prefsKey(tableId), JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("lxp:data-table:apply-prefs", { detail: { tableId, ...cfg } }));
}

function reflect(): void {
  // Page-size active state.
  document.querySelectorAll<HTMLElement>("[data-backups-pagesize-group]").forEach((group) => {
    const tableId = group.dataset.backupsPagesizeGroup || "";
    const cfg = readCfg(tableId);
    group.querySelectorAll<HTMLButtonElement>("[data-backups-pagesize]").forEach((btn) => {
      const active = Number(btn.dataset.backupsPagesize) === cfg.pageSize;
      btn.classList.toggle("bg-primary/10", active);
      btn.classList.toggle("text-primary", active);
      btn.classList.toggle("font-medium", active);
    });
  });
  // Action checkboxes.
  document.querySelectorAll<HTMLInputElement>("[data-backups-action-toggle]").forEach((cb) => {
    const tableId = cb.dataset.backupsTable || "";
    const actionId = cb.dataset.backupsActionToggle || "";
    cb.checked = !readCfg(tableId).hiddenActions.includes(actionId);
  });
}

let wired = false;

function showView(view: "local" | "cloud" | "table") {
  document.querySelectorAll<HTMLElement>("[data-backups-settings-view]").forEach((panel) => {
    const active = panel.dataset.backupsSettingsView === view;
    panel.classList.toggle("hidden", !active);
    if (panel.dataset.backupsSettingsView === "table") panel.classList.toggle("flex", active);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-backups-settings-nav]").forEach((button) => {
    const active = button.dataset.backupsSettingsNav === view;
    button.classList.toggle("bg-primary/10", active);
    button.classList.toggle("text-primary", active);
    button.classList.toggle("text-muted-foreground", !active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

export function initBackupsSettingsTable(): void {
  reflect();
  showView("local");
  if (wired) return;
  wired = true;

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const nav = target?.closest<HTMLButtonElement>("[data-backups-settings-nav]");
    const view = nav?.dataset.backupsSettingsNav;
    if (view === "local" || view === "cloud" || view === "table") showView(view);
    if (target?.closest("#backups-settings-modal-trigger")) {
      for (const el of document.querySelectorAll<HTMLElement>("[data-backups-pagesize-group]")) {
        const tableId = el.dataset.backupsPagesizeGroup || "";
        if (tableId) writeCfg(tableId, readCfg(tableId));
      }
      reflect();
    }
    const btn = target?.closest<HTMLButtonElement>("[data-backups-pagesize]");
    if (!btn) return;
    const tableId = btn.dataset.backupsTable || "";
    const size = Number(btn.dataset.backupsPagesize);
    if (!tableId || !size) return;
    const cfg = readCfg(tableId);
    cfg.pageSize = size;
    writeCfg(tableId, cfg);
    reflect();
  });

  document.addEventListener("change", (event) => {
    const cb = (event.target as HTMLElement | null)?.closest<HTMLInputElement>("[data-backups-action-toggle]");
    if (!cb) return;
    const tableId = cb.dataset.backupsTable || "";
    const actionId = cb.dataset.backupsActionToggle || "";
    if (!tableId || !actionId) return;
    const cfg = readCfg(tableId);
    const set = new Set(cfg.hiddenActions);
    if (cb.checked) set.delete(actionId);
    else set.add(actionId);
    cfg.hiddenActions = [...set];
    writeCfg(tableId, cfg);
  });

}
