// Files page — listing submodule (code-move from index-script1.ts; no behavior change).
import { mediaKind, openMediaModal, openOrActivateTab } from "./editor";
import { fmt, t } from "./i18n";
import { fileIcon, gitStatusColor } from "./icons";
import { defaultZipName, escAttr, escapeAttr, escapeHtml, fmtDate, fmtSize, getBaseName, getParentPath, getSearchQuery, modeToSymbolic, setDialogValue, typeLabel } from "./paths";
import { canReadPathClient, ensureFileAccessPolicy, filesCan, isAlwaysDeniedSystemPath } from "./perm-gating";
import { loadProjects, setProjectsViewActive, updateProjectsControls } from "./projects";
import { S, SHOW_HIDDEN_KEY, FILES_VIEW_KEY, dirSizeKnown, selected } from "./state";
import { updateAiSelectionNotice } from "./ai-selection";
import { patchFilesPreferences } from "./preferences";
import { createFilePages, FILES_BATCH_SIZE } from "./file-pages";
import { fetchFilesPage } from "./list-request";
import type { FilesViewMode } from "./state";
import { setStatus, showToast } from "./toast";
import { api, resolvePanelApiPath, scopeHeaders } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { escapeJsAttr } from "/scripts/extracted/lib/escape.js";
import { openDialog } from "/scripts/extracted/lib/dom.js";

let gridBulkBarTimer: ReturnType<typeof setTimeout> | undefined;
let directoryActive = false;
let directoryContext = "";
let localEntries: any[] = [], localShown = 0;
let scrollBinding: AbortController | undefined;
let scrollResize: ResizeObserver | undefined;
let checkScroll = () => {};

function listingContext() {
  return JSON.stringify([S.activeTargetScope, S.activeFilesManagerId, S.currentPath, S.sortKey, S.sortDir, S.showHidden && filesCan("files.hidden"), getSearchQuery(), S.isSearchMode]);
}

const directoryPages = createFilePages(listingContext, (offset, limit) => fetchFilesPage(S.currentPath, offset, limit, {
  sortKey: S.sortKey, sortDir: S.sortDir, showHidden: S.showHidden && filesCan("files.hidden"), query: getSearchQuery(),
}), (state, added, replace) => {
  if (added !== null) {
    S.currentEntries = state.items;
    if (replace) renderFiles(S.currentEntries);
    else {
      appendFiles(added);
      if (!S.isSearchMode) void hydrateDirSizes(S.currentEntries);
    }
    if (!state.loading) setStatus(fmt(state.total === 1 ? t("status.itemCountOne", "{n} elemento") : t("status.itemCountMany", "{n} elementos"), { n: state.total }));
  }
  updateFileScroll();
});

export function cancelDirectoryListing() {
  S.listingVersion++;
  directoryActive = false;
  directoryPages.cancel();
  localEntries = []; localShown = 0;
  S.dirSizeNav++;
  updateFileScroll();
}

export function loadDirectoryListing() {
  directoryActive = true;
  directoryContext = listingContext();
  return directoryPages.first();
}

function appendFiles(entries: any[]) {
  if (!entries.length) return;
  if (S.viewMode === "list") renderListView(entries, undefined, true);
  else if (S.viewMode === "grid") renderGridView(entries, undefined, true);
  syncCheckAll();
}

export async function loadMoreFiles(retry = false) {
  if (S.contentResultsActive || S.viewMode === "projects") return;
  if (directoryActive && !S.isSearchMode) {
    if (directoryContext !== listingContext() || (directoryPages.get().error && !retry)) return;
    if (retry && !directoryPages.get().items.length) {
      await (window as any).navigate(S.currentPath, { skipHistory: true });
    } else await directoryPages.next();
  } else if (localShown < localEntries.length) {
    const start = localShown;
    const snapshot = localEntries;
    localShown = Math.min(localShown + FILES_BATCH_SIZE, localEntries.length);
    await Promise.resolve();
    if (snapshot !== localEntries) return;
    appendFiles(localEntries.slice(start, localShown));
    updateFileScroll();
  }
}

function updateFileScroll() {
  const state = directoryActive && !S.isSearchMode ? directoryPages.get() : null;
  const more = state?.hasMore ?? localShown < localEntries.length;
  for (const id of ["view-list", "view-grid"]) {
    const view = document.getElementById(id);
    const status = view?.querySelector<HTMLElement>("[data-files-more]");
    view?.setAttribute("aria-busy", String(!!state?.loading));
    if (!status) continue;
    status.classList.toggle("hidden", !more && !state?.loading && !state?.error);
    status.replaceChildren();
    if (state?.loading) status.textContent = t("status.loading", "Cargando…");
    else if (state?.error) {
      status.append(document.createTextNode(t("toasts.listError2", "No se pudo listar") + " "));
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "rounded border border-border px-3 py-1.5 text-foreground";
      retry.textContent = t("projectMapDrawer.retry", "Reintentar");
      retry.addEventListener("click", () => void loadMoreFiles(true), { signal: scrollBinding?.signal });
      status.append(retry);
    }
  }
  requestAnimationFrame(() => checkScroll());
}

/** Bind to the actual scroll containers, including resized/previously hidden drawers. */
export function bindFileScroll() {
  scrollBinding?.abort(); scrollResize?.disconnect();
  scrollBinding = new AbortController();
  const views = ["view-list", "view-grid"].map(id => document.getElementById(id)).filter((view): view is HTMLElement => !!view);
  checkScroll = () => {
    if (document.hidden) return;
    const view = views.find(view => view.isConnected && !view.classList.contains("hidden") && view.clientHeight > 0);
    if (view && view.scrollHeight - view.scrollTop - view.clientHeight <= 120) void loadMoreFiles();
  };
  for (const view of views) view.addEventListener("scroll", checkScroll, { passive: true, signal: scrollBinding.signal });
  if (typeof ResizeObserver !== "undefined") {
    scrollResize = new ResizeObserver(checkScroll);
    views.forEach(view => scrollResize!.observe(view));
  }
  window.addEventListener("lxp:module:visibility", checkScroll, { signal: scrollBinding.signal });
  window.addEventListener("lxp:module:dispose", () => {
    cancelDirectoryListing(); scrollBinding?.abort(); scrollResize?.disconnect(); checkScroll = () => {};
  }, { signal: scrollBinding.signal });
  updateFileScroll();
}

  export function filterEntries(entries: any[]) {
    const query = getSearchQuery();
    if (!query) return entries;
    return entries.filter((entry) => {
      const name = String(entry?.name ?? "").toLowerCase();
      const fullPath = `${S.currentPath}/${entry?.name ?? ""}`.replace("//", "/").toLowerCase();
      return name.includes(query) || fullPath.includes(query);
    });
  }

  export function filterProjects(projects: any[]) {
    const query = getSearchQuery();
    if (!query) return projects;
    return projects.filter((project) => {
      const haystack = [
        project?.name,
        project?.path,
        project?.branch,
        project?.url,
        project?.lastCommit,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  /** Size cell markup. Files show their byte size directly; directories show
   *  the recursive size — known ones immediately, the rest a pulsing "…"
   *  placeholder tagged with `data-dsz` so hydrateDirSizes() can fill it in. */
  export function sizeCellHtml(e: any, fullPath: string): string {
    if (!e.isDir) return fmtSize(e.size);
    const known = dirSizeKnown.get(fullPath);
    if (typeof known === "number") {
      return `<span data-dsz="${escAttr(fullPath)}">${fmtSize(known)}</span>`;
    }
    return `<span data-dsz="${escAttr(fullPath)}" class="opacity-50 animate-pulse">…</span>`;
  }

  /** Write a resolved/failed folder size into every cell rendered for `path`. */
  export function setDirSizeCell(path: string, bytes: number | null) {
    const text = bytes === null ? "—" : fmtSize(bytes);
    document.querySelectorAll<HTMLElement>("[data-dsz]").forEach((el) => {
      if (el.getAttribute("data-dsz") !== path) return;
      el.textContent = text;
      el.classList.remove("opacity-50", "animate-pulse");
    });
  }

  /** Fill folder sizes for the current listing: one batch cache read first,
   *  then compute the misses via `du` with bounded concurrency. A nav token
   *  cancels stale work when the user moves to another directory. */
  export async function hydrateDirSizes(entries: any[]) {
    const token = ++S.dirSizeNav;
    const dirs = (Array.isArray(entries) ? entries : []).filter((e) => e && e.isDir);
    if (dirs.length === 0) return;
    // Make sure the file-access policy is loaded so we can skip denied paths.
    await ensureFileAccessPolicy();
    if (token !== S.dirSizeNav) return;
    const pathOf = (e: any) => `${S.currentPath}/${e.name}`.replace("//", "/");
    const allPaths = dirs.map(pathOf);
    // System dirs the backend always 403s (e.g. /proc, /sys, /usr at "/") get no
    // size request — even with allowAll. Paint the "unknown" placeholder so the
    // cell leaves the loading "…" state instead of pulsing forever.
    for (const p of allPaths) {
      if (isAlwaysDeniedSystemPath(p)) setDirSizeCell(p, null);
    }
    const pending = allPaths
      .filter((p) => !dirSizeKnown.has(p) && !isAlwaysDeniedSystemPath(p) && canReadPathClient(p));
    if (pending.length === 0) return;

    // Phase 1 — single round-trip, cached sizes only.
    let cached: Record<string, number | null> = {};
    try {
      const res: any = await api.post("/api/files/dir-sizes", { path: pending });
      if (res?.ok) cached = res.data?.sizes ?? {};
    } catch { /* fall through to live compute */ }
    if (token !== S.dirSizeNav) return;

    const misses: string[] = [];
    for (const p of pending) {
      const v = cached[p];
      if (typeof v === "number" && v >= 0) {
        dirSizeKnown.set(p, v);
        setDirSizeCell(p, v);
      } else {
        misses.push(p);
      }
    }

    // Phase 2 — compute misses lazily; cap concurrency so we don't flood SSH.
    const CONCURRENCY = 3;
    let idx = 0;
    const worker = async () => {
      while (idx < misses.length) {
        if (token !== S.dirSizeNav) return;
        const p = misses[idx++];
        try {
          const res: any = await api.get("/api/files/dir-size", { params: { path: p } });
          if (token !== S.dirSizeNav) return;
          if (res?.ok && typeof res.data?.size === "number") {
            dirSizeKnown.set(p, res.data.size);
            setDirSizeCell(p, res.data.size);
          } else {
            setDirSizeCell(p, null);
          }
        } catch {
          if (token !== S.dirSizeNav) return;
          setDirSizeCell(p, null);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, misses.length) }, worker));
  }

  // ── Selection ──────────────────────────────────────────────
  export function toggleSelect(path: string, checked: boolean) {
    checked ? selected.add(path) : selected.delete(path);
    updateBulkBar();
    syncCheckAll();
  }

  export function clearSelection() {
    selected.clear();
    updateBulkBar();
    document.querySelectorAll<HTMLInputElement>(".row-check").forEach((cb) => { cb.checked = false; });
    const checkAll = document.getElementById("check-all") as HTMLInputElement | null;
    if (checkAll) checkAll.checked = false;
    document.querySelectorAll<HTMLElement>(".grid-card").forEach((c) => c.classList.remove("ring-2", "ring-primary"));
  }

  export function updateBulkBar() {
    updateAiSelectionNotice();
    const bar = document.getElementById("bulk-bar");
    const count = document.getElementById("bulk-count");
    if (!bar || !count) return;
    if (selected.size > 0) {
      bar.classList.remove("hidden");
      bar.classList.add("flex");
      count.textContent = fmt(selected.size === 1 ? t("labels.selectedCountOne", "{n} elemento seleccionado") : t("labels.selectedCountMany", "{n} elementos seleccionados"), { n: selected.size });
    } else {
      bar.classList.add("hidden");
      bar.classList.remove("flex");
    }
  }

  export function syncCheckAll() {
    const allChecks = document.querySelectorAll<HTMLInputElement>(".row-check");
    const checkAll = document.getElementById("check-all") as HTMLInputElement | null;
    if (!checkAll) return;
    checkAll.checked = allChecks.length > 0 && Array.from(allChecks).every((c) => c.checked);
    checkAll.indeterminate = !checkAll.checked && selected.size > 0;
  }

  // ── View mode ──────────────────────────────────────────────
  export function setViewMode(mode: FilesViewMode) {
    S.viewMode = mode;
    const listEl = document.getElementById("view-list")!;
    const gridEl = document.getElementById("view-grid")!;
    const projEl = document.getElementById("view-projects")!;
    const listBtn = document.getElementById("btn-view-list")!;
    const gridBtn = document.getElementById("btn-view-grid")!;
    const projBtn = document.getElementById("btn-view-projects")!;

    // Hide all views
    listEl.classList.add("hidden");
    gridEl.classList.add("hidden");
    projEl.classList.add("hidden");
    // Switching the file view exits the content-search results view.
    const csEl = document.getElementById("view-content-search");
    if (csEl && !csEl.classList.contains("hidden")) {
      csEl.classList.add("hidden");
      csEl.classList.remove("flex");
      S.contentResultsActive = false;
    }

    // Reset all buttons to inactive state
    [listBtn, gridBtn, projBtn].forEach(btn => {
      btn.classList.remove("bg-accent", "text-foreground");
      btn.classList.add("text-muted-foreground", "hover:bg-accent");
    });

    if (mode === "list") {
      listEl.classList.remove("hidden");
      listBtn.classList.remove("text-muted-foreground", "hover:bg-accent");
      listBtn.classList.add("bg-accent", "text-foreground");
      clearSelection();
      renderFiles(S.isSearchMode ? localEntries : S.currentEntries);
    } else if (mode === "grid") {
      gridEl.classList.remove("hidden");
      gridBtn.classList.remove("text-muted-foreground", "hover:bg-accent");
      gridBtn.classList.add("bg-accent", "text-foreground");
      clearSelection();
      renderFiles(S.isSearchMode ? localEntries : S.currentEntries);
    } else if (mode === "projects") {
      projEl.classList.remove("hidden");
      projBtn.classList.remove("text-muted-foreground", "hover:bg-accent");
      projBtn.classList.add("bg-accent", "text-foreground");
      loadProjects();
    }

    // Disable file-mutation actions that don't apply to the projects view,
    // and refresh the rescan-button enabled state.
    setProjectsViewActive(mode === "projects");
    updateProjectsControls();

    localStorage.setItem(FILES_VIEW_KEY, mode);
  }
  /** Reflect the toggle's on/off state on the toolbar button (active style + eye
   *  icon) and on the "Show hidden files" switch in the File settings modal. */
  export function updateHiddenToggleUI(): void {
    const toggle = document.getElementById("files-show-hidden-toggle") as HTMLInputElement | null;
    if (toggle && toggle.checked !== S.showHidden) toggle.checked = S.showHidden;
    const btn = document.getElementById("btn-toggle-hidden");
    if (!btn) return;
    btn.classList.toggle("bg-accent", S.showHidden);
    btn.classList.toggle("text-foreground", S.showHidden);
    btn.classList.toggle("text-muted-foreground", !S.showHidden);
    btn.setAttribute("aria-pressed", S.showHidden ? "true" : "false");
    const icon = btn.querySelector("i");
    if (icon) icon.className = `ti ${S.showHidden ? "ti-eye" : "ti-eye-off"} text-sm`;
  }
  export function setShowHidden(next: boolean, persist = true): void {
    S.showHidden = next;
    try { localStorage.setItem(SHOW_HIDDEN_KEY, next ? "1" : "0"); } catch { /* ignore */ }
    if (persist) void patchFilesPreferences({ showHidden: next }).then((res) => {
      if (res.ok) return;
      if (S.showHidden === next) setShowHidden(!next, false);
      showToast(res.error || t("toasts.saveError2", "No se pudo guardar"), false);
    });
    updateHiddenToggleUI();
    if (S.viewMode !== "projects") renderFiles(S.isSearchMode ? localEntries : S.currentEntries);
  }

  // ── Render — List ──────────────────────────────────────────
  export function rowPathFor(e: any): string {
    if (S.isSearchMode && e.path) return e.path;
    const entryName = typeof e?.name === "string" ? e.name : "";
    return `${S.currentPath}/${entryName}`.replace("//", "/");
  }

  export function renderListView(sorted: any[], emptyMessage = t("empty.selectDirectory", "Selecciona un directorio para explorar"), append = false) {
    const tbody = document.getElementById("file-tbody");
    if (!tbody) return;
    if (sorted.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="px-4 py-8 text-center text-sm text-muted-foreground">
        <i class="ti ti-folder-open text-3xl block mb-2 mx-auto opacity-30"></i>${emptyMessage}</td></tr>`;
      return;
    }

    const html = sorted.map((e: any) => {
      const entryName = typeof e?.name === "string" ? e.name : t("labels.unnamed", "(sin nombre)");
      const fullPath = rowPathFor(e);
      const iconCls = fileIcon(entryName, e.isDir, e.isHidden, e.hasGit, e.gitStatus);
      const nameColor = gitStatusColor(e.gitStatus);
      const isSelected = selected.has(fullPath);
      const subtitle = S.isSearchMode ? `<div class="text-[10px] text-muted-foreground/70 truncate">${escapeHtml(fullPath)}</div>` : "";
      // XSS-safe interpolation for the inline on*= handlers below: escapeJsAttr
      // JS-escapes AND HTML-escapes so a filename can't break out of the '…' JS
      // string literal (escapeAttr only HTML-escaped → the parser decoded the
      // entity back to a real quote and executed injected code) nor out of the
      // "…" attribute (the old entryNameJs never escaped double quotes).
      const fullPathEsc = escapeJsAttr(fullPath);
      const entryNameJs = escapeJsAttr(entryName);
      const entryNameEsc = escapeHtml(entryName);
      return `
        <tr class="group border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-context-menu ${isSelected ? "bg-primary/5" : ""}"
          oncontextmenu="showFileContextMenu(event, '${fullPathEsc}', '${entryNameJs}', ${e.isDir})">
          <td class="px-3 py-2 w-8">
            <input type="checkbox" class="row-check rounded border-border" ${isSelected ? "checked" : ""}
              onchange="toggleRowSelect('${fullPathEsc}', this.checked)" aria-label="${escapeAttr(fmt(t("aria.selectRow", "Seleccionar {name}"), { name: entryName }))}" />
          </td>
          <td class="px-2 py-2 w-6 text-base">
            ${iconCls}
          </td>
          <td class="px-4 py-2 font-medium text-sm cursor-pointer ${nameColor} ${e.isHidden ? "opacity-40" : ""}" ondblclick="handleDblClick('${fullPathEsc}', ${e.isDir})">
            ${entryNameEsc}
            ${subtitle}
          </td>
          <td class="fcol-type px-4 py-2 text-xs text-muted-foreground hidden xl:table-cell">${escapeHtml(typeLabel(e))}</td>
          <td class="fcol-size px-4 py-2 text-xs text-muted-foreground hidden sm:table-cell">${sizeCellHtml(e, fullPath)}</td>
          <td class="fcol-owner px-4 py-2 text-xs text-muted-foreground hidden md:table-cell truncate">${e.owner ? escapeHtml(String(e.owner)) : "—"}</td>
          <td class="fcol-group px-4 py-2 text-xs text-muted-foreground hidden xl:table-cell truncate">${e.group ? escapeHtml(String(e.group)) : "—"}</td>
          <td class="fcol-modified px-4 py-2 text-xs text-muted-foreground hidden lg:table-cell">${fmtDate(e.mtime)}</td>
          <td class="fcol-perms px-4 py-2 text-[11px] font-mono text-muted-foreground hidden lg:table-cell leading-tight">
            <div>${e.mode ?? "—"}</div>
            <div class="text-muted-foreground/60">${modeToSymbolic(e.mode) || "—"}</div>
          </td>
        </tr>`;
    }).join("");
    if (append) {
      const batch = document.createElement("tbody");
      batch.innerHTML = html;
      tbody.append(...batch.childNodes);
    } else tbody.innerHTML = html;
  }

  // ── Render — Grid ──────────────────────────────────────────
  export function renderGridView(sorted: any[], emptyMessage = t("empty.folderEmpty", "Carpeta vacía"), append = false) {
    const grid = document.getElementById("file-grid");
    if (!grid) return;
    if (sorted.length === 0) {
      grid.innerHTML = `<div class="col-span-full py-12 text-center text-sm text-muted-foreground">
        <i class="ti ti-folder-open text-4xl block mb-2 opacity-30"></i>${emptyMessage}</div>`;
      return;
    }

    const html = sorted.map((e: any) => {
      const entryName = typeof e?.name === "string" ? e.name : t("labels.unnamed", "(sin nombre)");
      const fullPath = rowPathFor(e);
      const iconCls = fileIcon(entryName, e.isDir, e.isHidden, e.hasGit, e.gitStatus);
      const nameColor = gitStatusColor(e.gitStatus);
      const isSelected = selected.has(fullPath);
      const truncName = entryName.length > 18 ? entryName.slice(0, 15) + "…" : entryName;
      const sizeLabel = sizeCellHtml(e, fullPath);
      // XSS-safe interpolation for the inline on*= handlers below: escapeJsAttr
      // JS-escapes AND HTML-escapes so a filename can't break out of the '…' JS
      // string literal (escapeAttr only HTML-escaped → the parser decoded the
      // entity back to a real quote and executed injected code) nor out of the
      // "…" attribute (the old entryNameJs never escaped double quotes).
      const fullPathEsc = escapeJsAttr(fullPath);
      const entryNameJs = escapeJsAttr(entryName);
      const entryNameEsc = escapeHtml(entryName);
      const truncNameEsc = escapeHtml(truncName);
      // Image files show a real thumbnail (raw bytes, read-gated) with the
      // type icon as a fallback if it fails to load.
      const thumb = (!e.isDir && mediaKind(entryName) === "image" && filesCan("files.read"))
        ? `<img src="${resolvePanelApiPath("/api/files/raw")}?path=${encodeURIComponent(fullPath)}" loading="lazy" alt="${escapeAttr(entryName)}"
             class="mt-2 h-14 w-14 rounded object-cover bg-muted"
             onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
           <span class="text-4xl mt-2 leading-none" style="display:none">${iconCls}</span>`
        : `<span class="text-4xl mt-2 leading-none">${iconCls}</span>`;
      return `
        <div class="grid-card group relative flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-3 cursor-pointer
          hover:border-primary/40 hover:bg-accent transition-all ${isSelected ? "ring-2 ring-primary border-primary/40 bg-primary/5" : ""}"
          ondblclick="handleDblClick('${fullPathEsc}', ${e.isDir})"
          onclick="toggleGridCard(event, '${fullPathEsc}')"
          oncontextmenu="showFileContextMenu(event, '${fullPathEsc}', '${entryNameJs}', ${e.isDir})"
          title="${entryNameEsc}"
          role="option" aria-selected="${isSelected}">
          <div class="absolute top-2 left-2 ${isSelected ? "" : "opacity-0 group-hover:opacity-100"} transition-opacity">
            <div class="h-4 w-4 rounded border border-primary flex items-center justify-center ${isSelected ? "bg-primary" : "bg-background"}">
              ${isSelected ? `<i class="ti ti-check text-[10px] text-white"></i>` : ""}
            </div>
          </div>
          ${thumb}
          <div class="w-full text-center">
            <p class="text-xs font-medium truncate leading-tight ${nameColor} ${e.isHidden ? "opacity-40" : ""}">${truncNameEsc}</p>
            <p class="text-[10px] text-muted-foreground ${e.isHidden ? "opacity-40" : ""}">${sizeLabel}</p>
          </div>
        </div>`;
    }).join("");
    if (append) grid.insertAdjacentHTML("beforeend", html);
    else grid.innerHTML = html;
  }

  // ── Column sorting (list view headers) ─────────────────────
  /** Reflect the active sort column/direction in the header carets. */
  export function updateSortIndicators() {
    document.querySelectorAll<HTMLElement>("#view-list th.fsort").forEach((th) => {
      const key = th.getAttribute("data-sort");
      const ind = th.querySelector<HTMLElement>(".fsort-ind");
      if (!ind) return;
      if (key === S.sortKey) { ind.textContent = S.sortDir === 1 ? "↑" : "↓"; ind.style.opacity = "1"; }
      else { ind.textContent = ""; ind.style.opacity = "0"; }
    });
  }

  /** Make the list-view column headers clickable: first click sorts ascending,
   *  re-clicking the same column toggles the direction. */
  export function setupColumnSorting() {
    document.querySelectorAll<HTMLElement>("#view-list th.fsort").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort") as typeof S.sortKey | null;
        if (!key) return;
        if (S.sortKey === key) S.sortDir = S.sortDir === 1 ? -1 : 1;
        else { S.sortKey = key; S.sortDir = 1; }
        updateSortIndicators();
        renderFiles(S.isSearchMode ? localEntries : S.currentEntries);
      });
    });
    updateSortIndicators();
  }

  // ── renderFiles (dispatches to list/grid) ──────────────────
  /**
   * Filtra + ordena las entradas EXACTAMENTE como se pintan en la tabla/grid
   * (mismo filtro de ocultos, mismas reglas de orden). Fuente única para
   * `renderFiles` y para el visor de imágenes tipo carrusel, que necesita
   * recorrer la carpeta en el mismo orden que ve el usuario.
   */
  export function visibleSortedEntries(entries: any[]): any[] {
    if (!Array.isArray(entries)) { entries = []; }
    let filtered = (S.isSearchMode ? entries : filterEntries(entries)).filter((entry) => !!entry && typeof entry === "object");
    // Hide dotfiles unless the user holds the "ver ocultos" permission AND has
    // turned the "Show hidden files" toggle on (default off, like ls vs ls -a).
    if (!(filesCan("files.hidden") && S.showHidden)) {
      filtered = filtered.filter((entry) => !(entry.isHidden ?? String(entry?.name ?? "").startsWith(".")));
    }
    const nameCmp = (a: any, b: any) =>
      (typeof a?.name === "string" ? a.name : "").localeCompare(
        typeof b?.name === "string" ? b.name : "",
        undefined,
        { numeric: true, sensitivity: "base" },
      );
    const toMs = (v: any) => { const n = new Date(v).getTime(); return Number.isFinite(n) ? n : 0; };
    return [...filtered].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1; // folders first, always
      let r: number;
      if (S.sortKey === "type") r = typeLabel(a).localeCompare(typeLabel(b), undefined, { sensitivity: "base" }) || nameCmp(a, b);
      else if (S.sortKey === "size") r = ((Number(a?.size) || 0) - (Number(b?.size) || 0)) || nameCmp(a, b);
      else if (S.sortKey === "modified") r = (toMs(a?.mtime) - toMs(b?.mtime)) || nameCmp(a, b);
      else r = nameCmp(a, b);
      return r * S.sortDir;
    });
  }

  export function renderFiles(entries: any[]) {
    const remote = directoryActive && !S.isSearchMode && entries === S.currentEntries;
    if (remote && directoryContext !== listingContext()) {
      void (window as any).navigate(S.currentPath, { skipHistory: true });
      return;
    }
    const sorted = remote ? entries : visibleSortedEntries(entries);
    localEntries = remote ? [] : sorted;
    localShown = remote ? 0 : Math.min(FILES_BATCH_SIZE, sorted.length);
    const visible = remote ? sorted : sorted.slice(0, localShown);
    const query = getSearchQuery();
    const emptyMessage = query ? fmt(t("empty.noResultsFor", "No se encontraron resultados para \"{query}\""), { query }) : t("empty.selectDirectory", "Selecciona un directorio para explorar");
    if (S.viewMode === "list") renderListView(visible, emptyMessage);
    else renderGridView(visible, query ? emptyMessage : t("empty.folderEmpty", "Carpeta vacía"));
    for (const id of ["view-list", "view-grid"]) {
      const view = document.getElementById(id);
      if (view) view.scrollTop = 0;
    }
    syncCheckAll();
    updateFileScroll();
    // Fill recursive folder sizes (cache first, then live du). Skip in search
    // mode: result paths aren't children of S.currentPath.
    if (!S.isSearchMode) void hydrateDirSizes(visible);
  }

  // Grid card click: single click selects, double click navigates/edits
  (window as any).toggleGridCard = (e: MouseEvent, path: string) => {
    // Don't fire on dblclick (handled separately)
    if (gridBulkBarTimer !== undefined) clearTimeout(gridBulkBarTimer);
    if (e.detail >= 2) { updateBulkBar(); return; }
    const isSelected = selected.has(path);
    isSelected ? selected.delete(path) : selected.add(path);
    // Showing the bulk bar moves the cards. Keep the double-click target in
    // place until the second click, while reflecting selection immediately.
    gridBulkBarTimer = setTimeout(updateBulkBar, 500);
    // Re-render just this card's selected state
    document.querySelectorAll<HTMLElement>(".grid-card").forEach((card) => {
      const cardPath = (card.getAttribute("data-lxp-handler-dblclick") ?? card.getAttribute("ondblclick"))?.match(/'([^']+)'/)?.[1];
      if (!cardPath) return;
      const sel = selected.has(cardPath);
      card.setAttribute("aria-selected", String(sel));
      if (sel) {
        card.classList.add("ring-2", "ring-primary", "border-primary/40", "bg-primary/5");
      } else {
        card.classList.remove("ring-2", "ring-primary", "border-primary/40", "bg-primary/5");
      }
      // Indicator dot
      const dot = card.querySelector<HTMLElement>("div.absolute div");
      if (dot && sel) {
        dot.classList.add("bg-primary");
        dot.innerHTML = `<i class="ti ti-check text-[10px] text-white"></i>`;
      } else if (dot) {
        dot.classList.remove("bg-primary");
        dot.innerHTML = "";
      }
    });
  };

  // List row checkbox
  (window as any).toggleRowSelect = (path: string, checked: boolean) => toggleSelect(path, checked);

  // ── Download ───────────────────────────────────────────────
  (window as any).downloadEntry = async (path: string, name: string, isDir: boolean) => {
    const params = new URLSearchParams({ path });
    if (isDir) params.set("zip", "true");
    setStatus(fmt(t("status.downloading", "Descargando {name}..."), { name }));
    try {
      // Raw fetch (blob download) must carry the per-tab isolation headers that
      // `api.*` injects automatically, or the backend resolves the request
      // against the panel host / a stale cookie instead of the connected server
      // (→ 403 or wrong-server data). `scopeHeaders()` adds X-Bridge-Session-Id;
      // GET is non-mutating so no CSRF is required.
      const response = await fetch(resolvePanelApiPath(`/api/files/download?${params.toString()}`), {
        credentials: "include",
        headers: scopeHeaders(),
        cache: "no-store",
      });
      if (!response.ok) { showToast(t("toasts.downloadError", "Error al descargar"), false); setStatus(t("status.error", "Error")); return; }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = isDir ? `${name}.zip` : name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      setStatus(fmt(t("status.downloaded", "{name} descargado"), { name }));
    } catch {
      showToast(t("toasts.downloadNetworkError", "Error de red al descargar"), false);
      setStatus(t("status.error", "Error"));
    }
  };

  (window as any).extractArchive = async (path: string, name: string) => {
    const destDir = getParentPath(path);
    setStatus(fmt(t("status.extracting", "Extrayendo {name}..."), { name }));
    const res = await api.post("/api/files/extract", { archive: path, destDir });
    if (!res.ok) {
      showToast(res.error ?? t("toasts.extractError", "Error al extraer archivo"), false);
      setStatus(t("status.error", "Error"));
      return;
    }
    showToast(fmt(t("toasts.extracted", "Archivo extraído: {name}"), { name }));
    (window as any).navigate(destDir, { skipHistory: true });
    (window as any).__lxpFilesTreeRefresh?.([destDir]);
  };

  (window as any).openCompressDialog = (paths: string[], label?: string) => {
    if (!paths.length) return;
    S.compressTargetPaths = paths.slice();
    S.compressTargetLabel = label || fmt(paths.length === 1 ? t("labels.itemCountOne", "{n} elemento") : t("labels.itemCountMany", "{n} elementos"), { n: paths.length });
    const archiveName = defaultZipName(paths);
    setDialogValue("compress-name", archiveName);
    const targetEl = document.getElementById("compress-target");
    const summaryEl = document.getElementById("compress-summary");
    if (targetEl) targetEl.textContent = S.compressTargetLabel;
    if (summaryEl) {
      const items = paths.map((p) => getBaseName(p) || p).join(", ");
      summaryEl.textContent = fmt(t("labels.compressSummary", "Se creará {archiveName} con: {items}"), { archiveName, items });
    }
    openDialog("dialog-compress");
  };

  (window as any).handleDblClick = (path: string, isDir: boolean, opts?: { preview?: boolean }) => {
    if (isDir) { (window as any).navigate(path); return; }
    // Opening a file needs read permission (gated so files.view alone = browse only).
    if (!filesCan("files.read")) { showToast(t("toasts.noPermissionOpen", "Sin permiso para abrir archivos"), false); return; }
    const name = path.split("/").pop() || path;
    const kind = mediaKind(name);
    if (kind) { openMediaModal(path, name, kind); return; }
    // `opts` carries the preview flag from the tree's single-click; the table's
    // double-click passes nothing → permanent open (unchanged semantics).
    (window as any).handleEdit(path, name, opts);
  };
