// Files page script — ENTRY point.
// Split into cohesive submodules under files/. This entry wires them + runs
// the init()/initWhenReady() lifecycle. Submodules register their window.*
// onclick globals as a side effect of being imported here.
import { bindControls } from "./bind-controls";
import { fmt, loadI18n, t } from "./i18n";
import { renderFiles } from "./listing";
import { applyLeftSidebarTab, getActiveFilesManager, loadFilesManagers, persistFilesManagers, renderFilesManagerTabs, setupLeftPanelResizer } from "./manager-tabs";
import { escapeHtml, normalizeSearch } from "./paths";
import { applyFilePermGating, ensureFileAccessPolicy, invalidateFileAccessPolicy } from "./perm-gating";
import { onFilesDepsStatus, renderProjects } from "./projects";
import { exitContentResults, runContentSearch, runNameSearch, updateSearchModeUI } from "./search-replace";
import { S, selected } from "./state";
import { clearMediaViewer, mediaNav, syncEditorWorkspaceView } from "./editor";
import { confirmFilesTargetSwitch, hasTargetScopeChanged, persistTargetScope, resetStateForTargetSwitch, resolveCurrentTargetScope, syncTargetScopeFromSession } from "./target-scope";
import { setStatus } from "./toast";
import { clearTreeSearch, initFilesSettingsRoots, initFilesTree, scheduleTreeSearch } from "./tree";
import { renderFavRootSelect, renderTreeExpansionModeOptions } from "./tree";
import { loadFilesPreferences } from "./preferences";
import { applyFilesMode } from "./tools";
import { setShowHidden } from "./listing";
import { syncFileShortcutInputs } from "./shortcuts";
import { restoreDraftsForTarget } from "./target-scope";
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { initModuleDeps } from "/scripts/extracted/lib/module-deps.js?v=20260609a";
import { SESSION_REFRESHED_EVENT } from "/scripts/extracted/lib/panel-events.js";

import "./navigation";
import "./context-menu";


  // ── Init ──────────────────────────────────────────────────
  function init() {
    const browserEl = document.getElementById("files-browser") as HTMLElement | null;
    if (!browserEl) return;
    // Run the full init once per FRESH DOM instance. Astro's ClientRouter
    // swaps the DOM on every entry (so we must re-bind AND re-list), but can
    // also fire astro:page-load several times for the SAME entry — the flag on
    // the (re-created) element dedupes those without blocking real re-entries
    // the way the old time-based cooldown did (that left re-entered tabs empty).
    if (browserEl.dataset.lxpFilesInit === "1") return;
    browserEl.dataset.lxpFilesInit = "1";
    (window as any).__filesBeforeTargetSwitch = confirmFilesTargetSwitch;
    loadI18n();
    // Reset de flags que guardan bindings DOM. El DOM se reemplaza en
    // cada nav SPA → estos flags quedaban true del visit anterior y los
    // bindings nuevos se saltaban. NO reseteamos `S.filesManagerBound`
    // porque éste guarda un window listener (window persiste cross-nav).
    S.leftPanelResizerBound = false;
    S.controlsBound = false;
    S.fileSettingsBound = false;
    S.searchBound = false;
    setupLeftPanelResizer();
    if (!bindControls()) {
      // bindControls falló (DOM no listo); permite reintentar en el próximo frame.
      browserEl.dataset.lxpFilesInit = "";
      requestAnimationFrame(init);
      return;
    }

    const scope = resolveCurrentTargetScope();
    if (!S.activeTargetScope || hasTargetScopeChanged(scope)) {
      resetStateForTargetSwitch();
      persistTargetScope(scope);
      restoreDraftsForTarget(scope);
    }
    if (!S.preferencesListenerBound) {
      S.preferencesListenerBound = true;
      window.addEventListener("luxipanel:files-preferences-loaded", () => {
        applyFilesMode();
        setShowHidden(S.showHidden, false);
        renderFavRootSelect();
        renderTreeExpansionModeOptions();
        syncFileShortcutInputs();
      });
    }
    void loadFilesPreferences();

    // Apply the persisted editor-vs-browser view to this freshly-swapped DOM
    // (ClientRouter replaced #files-browser/#files-editor-panel on SPA re-entry).
    syncEditorWorkspaceView();

    selected.clear();

    // Chequeo de dependencias del sistema (re-entrante; endpoints default
    // /api/system-deps/files[/install]). Ambos callbacks pasan por el mismo
    // handler para cubrir también instalaciones de deps opcionales (git).
    void initModuleDeps({
      module: "files",
      onReady: onFilesDepsStatus,
      onMissing: onFilesDepsStatus,
    });

    // DOM bindings (re-atan en cada init porque el swap SPA reemplaza el
    // DOM; sin esto los botones quedaban sin listener tras navegar y
    // volver). El cooldown del init() dedupea fires en la misma entrada.
    loadFilesManagers();
    renderFilesManagerTabs();
    document.getElementById("btn-new-files-manager-tab")?.addEventListener("click", () => {
      const id = `mgr-${Date.now()}`;
      // A new tab ALWAYS opens at root ("/", or the allowed base for restricted
      // users) with its own fresh tree section (no inherited root). The user can
      // then set this tab's own root independently of every other tab.
      const startPath = S.filesAllowAll ? "/" : S.filesDefaultBase;
      S.filesManagers.push({ id, label: startPath, path: startPath });
      S.activeFilesManagerId = id;
      persistFilesManagers();
      renderFilesManagerTabs();
      (window as any).navigate(startPath, { skipHistory: true });
    });
    const managerTabHost = document.getElementById("files-manager-tabs");
    managerTabHost?.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const closeId = target.closest("[data-manager-close]")?.getAttribute("data-manager-close");
      if (closeId) {
        if (S.filesManagers.length <= 1) return;
        S.filesManagers = S.filesManagers.filter((entry) => entry.id !== closeId);
        if (S.activeFilesManagerId === closeId) S.activeFilesManagerId = S.filesManagers[0]!.id;
        persistFilesManagers();
        renderFilesManagerTabs();
        managerTabHost.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
        const next = getActiveFilesManager();
        if (next) (window as any).navigate(next.path || "/", { skipHistory: true });
        return;
      }
      const managerId = target.closest("[data-manager-id]")?.getAttribute("data-manager-id");
      if (!managerId || managerId === S.activeFilesManagerId) return;
      const manager = S.filesManagers.find((entry) => entry.id === managerId);
      if (!manager) return;
      S.activeFilesManagerId = managerId;
      persistFilesManagers();
      renderFilesManagerTabs();
      Array.from(managerTabHost.querySelectorAll<HTMLElement>("[data-manager-id]"))
        .find((tab) => tab.dataset.managerId === managerId)?.focus();
      (window as any).navigate(manager.path || "/", { skipHistory: true });
    });
    managerTabHost?.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const source = (event.target as HTMLElement).closest<HTMLElement>('[role="tab"][data-manager-id]');
      if (!source) return;
      const tabs = Array.from(managerTabHost.querySelectorAll<HTMLElement>('[role="tab"][data-manager-id]'));
      const index = tabs.indexOf(source);
      if (index < 0 || tabs.length < 2) return;
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[nextIndex]?.click();
      managerTabHost.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    });

    // Window listener: solo bindear UNA vez (window persiste cross-nav).
    // Si re-bindeáramos en cada init acumularíamos handlers duplicados.
    if (!S.filesManagerBound) {
      S.filesManagerBound = true;
      window.addEventListener("luxipanel:terminal-cwd-changed", (event: Event) => {
        const detail = (event as CustomEvent<{ path?: string }>).detail;
        const path = typeof detail?.path === "string" ? detail.path : "";
        if (!path || path === S.currentPath) return;
        const activeManager = getActiveFilesManager();
        if (activeManager) {
          activeManager.path = path;
          persistFilesManagers();
          renderFilesManagerTabs();
        }
        (window as any).navigate(path, { skipHistory: true });
      });
    }

    // Media preview modal (carrusel): cierre + navegación + swipe + teclas,
    // DELEGADOS en `document` y bindeados UNA sola vez (window/document persiste
    // cross-nav SPA). Antes se enganchaba un listener por id (#media-prev/-next)
    // en CADA init; eso deja el handler pegado al nodo del <dialog> vivo en ese
    // instante, pero el shell #files-browser es un island React `client:only`
    // que monta async y la nav SPA reemplaza el <dialog>: el click terminaba en
    // un botón sin listener (flechas "muertas"). La delegación matchea el botón
    // por `closest()` en el momento del click, así que funciona con cualquier
    // <dialog> presente. El handler resuelve el dialog fresco por id y valida
    // `open` (no actúa con el visor cerrado). `clearMediaViewer` corta autoplay
    // y revoca la object URL activa + las de prefetch (sin fugas).
    if (!S.mediaNavBound) {
      S.mediaNavBound = true;
      const mediaDialog = () => document.getElementById("dialog-media") as HTMLDialogElement | null;
      document.addEventListener("click", (ev) => {
        const btn = (ev.target as HTMLElement | null)?.closest?.("#media-prev,#media-next,#media-close");
        if (!btn) return;
        const dlg = mediaDialog();
        if (!dlg?.open) return;
        if (btn.id === "media-close") { clearMediaViewer(); dlg.close(); }
        else if (btn.id === "media-prev") mediaNav(-1);
        else if (btn.id === "media-next") mediaNav(1);
      });
      // El evento `close` del <dialog> NO burbujea → escuchar en fase de captura.
      document.addEventListener("close", (ev) => {
        if ((ev.target as HTMLElement | null)?.id === "dialog-media") clearMediaViewer();
      }, true);
      // Swipe táctil sobre el área de la imagen.
      document.addEventListener("touchstart", (ev) => {
        const dlg = mediaDialog();
        if (!dlg?.open || !(ev.target as HTMLElement | null)?.closest?.("#media-body")) return;
        S.mediaTouchStartX = (ev as TouchEvent).changedTouches[0]?.clientX ?? null;
      }, { passive: true });
      document.addEventListener("touchend", (ev) => {
        if (S.mediaTouchStartX == null) return;
        const endX = (ev as TouchEvent).changedTouches[0]?.clientX ?? S.mediaTouchStartX;
        const dx = endX - S.mediaTouchStartX;
        S.mediaTouchStartX = null;
        if (Math.abs(dx) < 45) return; // umbral para ignorar taps
        if (!mediaDialog()?.open) return;
        mediaNav(dx < 0 ? 1 : -1); // swipe izq → siguiente, der → anterior
      }, { passive: true });
      // Teclas ← / → mientras el visor está abierto.
      document.addEventListener("keydown", (ev) => {
        if (!mediaDialog()?.open) return;
        if (ev.key === "ArrowLeft") { ev.preventDefault(); mediaNav(-1); }
        else if (ev.key === "ArrowRight") { ev.preventDefault(); mediaNav(1); }
      });
    }

    // Live permission updates: after the session keepalive rotates the JWT with
    // the user's current group permissions, re-fetch the policy and re-apply the
    // gating + re-list (so removing/adding permissions takes effect with NO
    // re-login). Bound once (window persists cross-nav).
    if (!S.sessionRefreshBound) {
      S.sessionRefreshBound = true;
      window.addEventListener(SESSION_REFRESHED_EVENT, () => {
        void (async () => {
          invalidateFileAccessPolicy();
          S.filesActions = null;
          await ensureFileAccessPolicy();
          applyFilePermGating();
          if (S.currentPath) (window as any).navigate(S.currentPath, { skipHistory: true });
        })();
      });
    }

    // DOM tabs del sidebar (sin guard — re-atan en fresh DOM cada init).
    {
      document.getElementById("tab-files")?.addEventListener("click", () => applyLeftSidebarTab("files"));
      document.getElementById("tab-snippets")?.addEventListener("click", () => applyLeftSidebarTab("snippets"));
      document.getElementById("tab-history")?.addEventListener("click", () => applyLeftSidebarTab("history"));
    }
    applyLeftSidebarTab("files");
    // Always (re)render a directory: on first load there's no S.currentPath so we
    // resolve the start path; on SPA re-entry the DOM was swapped (empty table)
    // but S.currentPath persists, so we re-list it to repaint the fresh DOM.
    void (async () => {
      await ensureFileAccessPolicy();
      applyFilePermGating();
      const activeManager = getActiveFilesManager();
      let startPath = S.currentPath || activeManager?.path || "/";
      // A path-restricted user can't open "/", so a root/empty start opens at
      // their default base. (navigate() also bounces denied paths as a safety net.)
      if (!S.filesAllowAll && (startPath === "/" || !startPath)) startPath = S.filesDefaultBase;
      if (activeManager && activeManager.path !== startPath) {
        activeManager.path = startPath;
        persistFilesManagers();
        renderFilesManagerTabs();
      }
      (window as any).navigate(startPath, { skipHistory: true });
    })();
    // Left folder-tree navigator (mirrors the listing; clicking a folder loads
    // it on the right). Binds once per fresh DOM, builds from the root.
    initFilesTree();
    initFilesSettingsRoots();
    void syncTargetScopeFromSession();
    const searchInput = document.getElementById("files-search") as HTMLInputElement | null;
    if (searchInput && !S.searchBound) {
      S.searchBound = true;
      updateSearchModeUI();
      searchInput.addEventListener("input", () => {
        // Content mode: don't live-grep on every keystroke (heavy SSH); wait
        // for Enter. Just clear results when the box is emptied.
        if (S.searchMode === "content") {
          if (!searchInput.value.trim()) {
            const results = document.getElementById("content-search-results");
            if (results) results.innerHTML = `<div class="px-4 py-6 text-center text-sm text-muted-foreground">${escapeHtml(t("empty.typeAndEnter", "Escribe y pulsa Enter para buscar."))}</div>`;
          }
          return;
        }
        S.searchQuery = normalizeSearch(searchInput.value);
        if (S.searchDebounce) clearTimeout(S.searchDebounce);
        // Dual filter: the tree (left) searches recursively on the server from
        // its root (debounced, ≥2 chars) and shows the hits as a flat list;
        // below that threshold it falls back to the instant DOM filter over the
        // loaded nodes. The right listing keeps its own recursive search.
        if (!S.searchQuery) clearTreeSearch();
        else scheduleTreeSearch(S.searchQuery);
        if (S.viewMode === "projects") {
          renderProjects(S.currentProjects);
          return;
        }
        if (!S.searchQuery) {
          S.isSearchMode = false;
          renderFiles(S.currentEntries);
          if (S.currentPath) setStatus(fmt(S.currentEntries.length === 1 ? t("status.itemCountOne", "{n} elemento") : t("status.itemCountMany", "{n} elementos"), { n: S.currentEntries.length }));
          return;
        }
        S.searchDebounce = setTimeout(() => void runNameSearch(S.searchQuery), 300);
      });
      // Enter in content mode runs the grep; Escape exits content results.
      searchInput.addEventListener("keydown", (ev: KeyboardEvent) => {
        if (S.searchMode !== "content") return;
        if (ev.key === "Enter") { ev.preventDefault(); void runContentSearch(); }
        else if (ev.key === "Escape" && S.contentResultsActive) { ev.preventDefault(); exitContentResults(); }
      });
    }
  }
  // Cooldown + page-load: antes solo escuchaba after-swap, así que en F5
  // init corría solo a module-eval. Ahora coordina con page-load y se
  // throttlea para evitar 3 fires/entrada.
  // FilesWorkspace is a `client:only` React island that renders #files-browser
  // ASYNCHRONOUSLY — often AFTER astro:page-load fires. The old code called
  // init() once and bailed when #files-browser wasn't there yet, so on SPA
  // re-entry the freshly-mounted shell never got wired/listed (empty view,
  // "only the first time"). Poll briefly until the shell exists, then init.
  function initWhenReady() {
    let tries = 0;
    const attempt = () => {
      if (document.getElementById("files-browser")) { init(); return; }
      if (tries++ < 120) requestAnimationFrame(attempt);
    };
    attempt();
  }
  document.addEventListener("astro:page-load", initWhenReady);
  document.addEventListener("astro:after-swap", initWhenReady);
  initWhenReady();
