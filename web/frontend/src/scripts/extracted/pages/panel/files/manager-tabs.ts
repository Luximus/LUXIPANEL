// Files page — manager-tabs submodule (code-move from index-script1.ts; no behavior change).
import { t } from "./i18n";
import { escapeAttr, getBaseName, getParentPath } from "./paths";
import { FILES_CURRENT_PATH_KEY, FILES_LEFT_TAB_KEY, FILES_MANAGER_ACTIVE_KEY, FILES_MANAGER_TABS_KEY, S, scopedFilesStorageKey } from "./state";
import { resolveCurrentTargetScope } from "./target-scope";
import { effectiveTreeRoot } from "./tree";
import { LOCAL_TARGET_SCOPE } from "/scripts/extracted/lib/api-client.js?v=20260506a";

  /** Storage key for the manager tabs of the CURRENT server (see
   *  `scopedFilesStorageKey`): local = legacy key, remote = per-target bucket. */
  export function managerStorageKey(base: string): string {
    const scope = (S.activeTargetScope || resolveCurrentTargetScope() || LOCAL_TARGET_SCOPE).trim();
    return scopedFilesStorageKey(base, scope);
  }


  // Lifecycle-scoped so the window listeners are torn down on SPA nav. The old
  // permanent `S.leftPanelResizerBound` guard leaked: it kept `mousemove`/
  // `mouseup` closures that captured DOM nodes Astro replaced on swap (retained
  // forever), and blocked re-binding so the fresh resizer had no handler.
  let leftPanelResizerController: AbortController | null = null;

  export function setupLeftPanelResizer() {
    const resizer = document.getElementById("files-left-bottom-resizer");
    const top = document.getElementById("files-left-content");
    const bottom = document.getElementById("terminal-pane");
    if (!resizer || !top || !bottom) return;
    leftPanelResizerController?.abort();
    leftPanelResizerController = new AbortController();
    const { signal } = leftPanelResizerController;

    const STORAGE_KEY = "panel-files-left-bottom-height";
    const saved = Number(window.localStorage.getItem(STORAGE_KEY) || "38");
    const initialBottom = Number.isFinite(saved) ? Math.min(65, Math.max(20, saved)) : 38;
    top.style.flex = `0 0 ${100 - initialBottom}%`;
    bottom.style.flex = `0 0 ${initialBottom}%`;

    let dragging = false;
    const onMove = (event: MouseEvent) => {
      if (!dragging) return;
      const parentRect = resizer.parentElement?.getBoundingClientRect();
      if (!parentRect) return;
      const y = event.clientY - parentRect.top;
      const pctTop = Math.max(30, Math.min(80, (y / parentRect.height) * 100));
      const pctBottom = 100 - pctTop;
      top.style.flex = `0 0 ${pctTop}%`;
      bottom.style.flex = `0 0 ${pctBottom}%`;
      window.localStorage.setItem(STORAGE_KEY, String(pctBottom));
    };

    resizer.addEventListener("mousedown", () => {
      dragging = true;
      document.body.style.userSelect = "none";
    }, { signal });
    window.addEventListener("mousemove", onMove, { signal });
    window.addEventListener("mouseup", () => {
      dragging = false;
      document.body.style.userSelect = "";
    }, { signal });
  }

  // Tear the resizer listeners down before the layout is swapped out.
  if (typeof document !== "undefined") {
    document.addEventListener("astro:before-swap", () => {
      leftPanelResizerController?.abort();
      leftPanelResizerController = null;
    });
  }

  export function applyLeftSidebarTab(tab: "files" | "snippets" | "history") {
    S.activeLeftSidebarTab = tab;
    const filesPane = document.getElementById("files-browser");
    const snippetsPane = document.getElementById("panel-snippets");
    const historyPane = document.getElementById("panel-history");
    const filesTab = document.getElementById("tab-files");
    const snippetsTab = document.getElementById("tab-snippets");
    const historyTab = document.getElementById("tab-history");
    if (!filesPane || !snippetsPane || !historyPane || !filesTab || !snippetsTab || !historyTab) return;

    filesPane.classList.toggle("hidden", tab !== "files");
    snippetsPane.classList.toggle("hidden", tab !== "snippets");
    historyPane.classList.toggle("hidden", tab !== "history");
    if (tab === "files") {
      filesPane.classList.add("flex");
      snippetsPane.classList.remove("flex");
      historyPane.classList.remove("flex");
    } else if (tab === "snippets") {
      snippetsPane.classList.add("flex");
      filesPane.classList.remove("flex");
      historyPane.classList.remove("flex");
    } else {
      historyPane.classList.add("flex");
      filesPane.classList.remove("flex");
      snippetsPane.classList.remove("flex");
    }

    filesTab.className = tab === "files"
      ? "flex-1 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30"
      : "flex-1 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground";
    if (tab === "files") {
      snippetsTab.className = "flex-1 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground";
      historyTab.className = "flex-1 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground";
    }
    window.localStorage.setItem(FILES_LEFT_TAB_KEY, tab);
  }

  export function emitFilesPathChanged(path: string, source: "files" | "terminal" = "files") {
    (window as any).__filesCurrentPath = path;
    sessionStorage.setItem(FILES_CURRENT_PATH_KEY, path);
    window.dispatchEvent(new CustomEvent("luxipanel:files-path-changed", { detail: { path, source } }));
  }

  export function loadFilesManagers() {
    // Start from EMPTY: after a target switch the in-memory tabs belong to the
    // previous server, and a remote bucket with no saved tabs must fall back
    // to the default "/" tab — not keep the old paths alive.
    S.filesManagers = [];
    try {
      const raw = window.localStorage.getItem(managerStorageKey(FILES_MANAGER_TABS_KEY));
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed) && parsed.length) {
        S.filesManagers = parsed
          .filter((entry) => entry && typeof entry.id === "string")
          .map((entry: any, index: number) => ({
            id: String(entry.id),
            label: typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : `Gestor ${index + 1}`,
            path: typeof entry.path === "string" && entry.path.trim() ? entry.path.trim() : "/",
            treeRoot: typeof entry.treeRoot === "string" && entry.treeRoot.trim() ? entry.treeRoot.trim() : undefined,
          }));
      }
    } catch {
      S.filesManagers = [];
    }
    if (!S.filesManagers.length) S.filesManagers = [{ id: "mgr-1", label: t("managers.default", "Gestor 1"), path: "/" }];
    const savedActive = window.localStorage.getItem(managerStorageKey(FILES_MANAGER_ACTIVE_KEY));
    S.activeFilesManagerId = S.filesManagers.some((entry) => entry.id === savedActive) ? String(savedActive) : S.filesManagers[0]!.id;
  }

  export function persistFilesManagers() {
    window.localStorage.setItem(managerStorageKey(FILES_MANAGER_TABS_KEY), JSON.stringify(S.filesManagers));
    window.localStorage.setItem(managerStorageKey(FILES_MANAGER_ACTIVE_KEY), S.activeFilesManagerId);
  }

  /** A tab names the folder it is actually showing; its root remains separate
   *  and appears in the tree picker. A small parent path disambiguates peers. */
  export function managerTabLabel(entry: { path?: string; treeRoot?: string }): string {
    const currentPath = entry.path || effectiveTreeRoot(entry);
    return getBaseName(currentPath) || t("workspace.root", "Raíz");
  }

  export function renderFilesManagerTabs() {
    const host = document.getElementById("files-manager-tabs");
    if (!host) return;
    const previousScrollLeft = host.scrollLeft;
    const focusedManagerId = host.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).getAttribute("data-manager-id") : null;
    host.innerHTML = S.filesManagers.map((entry) => {
      const active = entry.id === S.activeFilesManagerId;
      const currentPath = entry.path || effectiveTreeRoot(entry);
      const label = managerTabLabel(entry);
      const parent = currentPath === "/" ? "/" : getParentPath(currentPath);
      const safeId = escapeAttr(entry.id);
      const safeLabel = escapeAttr(label);
      const safePath = escapeAttr(currentPath);
      const canClose = S.filesManagers.length > 1;
      return `<div role="presentation" class="relative flex min-w-0 shrink-0 items-stretch rounded-t-lg border ${active ? "-mb-px h-12 border-border border-b-card border-t-2 border-t-primary bg-card text-foreground" : "mb-1 h-11 border-transparent text-muted-foreground hover:border-border hover:bg-card/70"}">
        <button type="button" role="tab" data-manager-id="${safeId}" aria-selected="${active}" tabindex="${active ? "0" : "-1"}" class="flex min-w-28 max-w-48 items-center gap-2 rounded-t-lg py-1.5 pl-3 ${canClose ? "pr-8" : "pr-3"} text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50" title="${safePath}" aria-label="${escapeAttr(t("workspace.folderTab", "Carpeta"))}: ${safePath}">
          <i class="ti ${active ? "ti-folder-open text-primary" : "ti-folder text-muted-foreground"} shrink-0 text-base" aria-hidden="true"></i>
          <span class="flex min-w-0 flex-col leading-tight"><span class="truncate text-xs font-semibold">${safeLabel}</span><span class="max-w-32 truncate text-[10px] text-muted-foreground">${escapeAttr(parent)}</span></span>
        </button>
        ${canClose ? `<button type="button" data-manager-close="${safeId}" class="absolute right-1 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" aria-label="${escapeAttr(t("workspace.closeFolderTab", "Cerrar pestaña de carpeta"))}: ${safePath}" title="${escapeAttr(t("workspace.closeFolderTab", "Cerrar pestaña de carpeta"))}"><i class="ti ti-x text-xs" aria-hidden="true"></i></button>` : ""}
      </div>`;
    }).join("");
    host.scrollLeft = previousScrollLeft;
    if (focusedManagerId) {
      Array.from(host.querySelectorAll<HTMLElement>("[data-manager-id]"))
        .find((tab) => tab.dataset.managerId === focusedManagerId)?.focus({ preventScroll: true });
    }
  }

  export function getActiveFilesManager() {
    return S.filesManagers.find((entry) => entry.id === S.activeFilesManagerId) ?? S.filesManagers[0] ?? null;
  }
