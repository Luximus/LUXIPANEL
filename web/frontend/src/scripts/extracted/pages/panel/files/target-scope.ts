// Files page — target-scope submodule (code-move from index-script1.ts; no behavior change).
import { commitActiveTabFromEditor, getEditorApi, hideEditorView, openEditorUnsavedDialog, renderTabs, saveAllDirtyTabs, syncToolbarState } from "./editor";
import { t } from "./i18n";
import { cancelDirectoryListing, clearSelection } from "./listing";
import { ensureFileAccessPolicy, invalidateFileAccessPolicy } from "./perm-gating";
import { loadFilesManagers, renderFilesManagerTabs } from "./manager-tabs";
import { FILES_CURRENT_PATH_KEY, FILES_TARGET_SCOPE_KEY, S, navHistory, dirSizeKnown, gitRepoCache, type OpenTab } from "./state";
import { setStatus, showToast } from "./toast";
import { invalidateFilesPreferences, loadFilesPreferences } from "./preferences";
import { LOCAL_TARGET_SCOPE, api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";

  export function updateBackButton() {
    const btn = document.getElementById("btn-back") as HTMLButtonElement | null;
    if (!btn) return;
    btn.disabled = navHistory.length === 0;
  }

  export function resolveCurrentTargetScope(): string {
    // Embeds share the parent's per-tab target storage without rendering its
    // switcher. Use the same scope as API requests from the first read.
    return resolveTargetScope();
  }

  export function hasTargetScopeChanged(nextScope: string): boolean {
    const previousScope = (sessionStorage.getItem(FILES_TARGET_SCOPE_KEY) || "").trim();
    return previousScope !== nextScope;
  }

  export function persistTargetScope(scope: string): void {
    sessionStorage.setItem(FILES_TARGET_SCOPE_KEY, scope);
    S.activeTargetScope = scope;
  }

  const draftsByTarget = new Map<string, { tabs: OpenTab[]; activeTabPath: string }>();

  export async function confirmFilesTargetSwitch(): Promise<boolean> {
    if (!document.getElementById("files-browser")) return true;
    commitActiveTabFromEditor();
    if (!S.openTabs.some((tab) => tab.dirty)) return true;
    if (!document.getElementById("dialog-editor-unsaved")) return false;
    const choice = await openEditorUnsavedDialog();
    if (choice === "cancel") return false;
    if (choice === "save") {
      const saved = await saveAllDirtyTabs();
      if (!saved) showToast(t("toasts.saveError", "Error al guardar"), false);
      return saved;
    }
    for (const tab of S.openTabs) {
      if (tab.dirty) {
        tab.content = tab.originalContent;
        tab.dirty = false;
      }
    }
    return true;
  }

  export function restoreDraftsForTarget(scope: string): void {
    const saved = draftsByTarget.get(scope);
    if (!saved) return;
    S.openTabs = saved.tabs;
    S.activeTabPath = saved.activeTabPath;
    renderTabs();
    setStatus(t("status.draftsRestored", "Ediciones pendientes recuperadas para este servidor"));
  }

  export function resetStateForTargetSwitch(): void {
    cancelDirectoryListing();
    if (S.openTabs.some((tab) => tab.dirty) && S.activeTargetScope) {
      draftsByTarget.set(S.activeTargetScope, { tabs: S.openTabs.map((tab) => ({ ...tab })), activeTabPath: S.activeTabPath });
    }
    clearSelection();
    dirSizeKnown.clear();
    gitRepoCache.clear();
    invalidateFileAccessPolicy();
    S.filesActions = null;
    S.filesAllowAll = false;
    S.filesAllowPaths = [];
    S.filesDefaultBase = "/";
    invalidateFilesPreferences();
    S.currentPath = "";
    S.currentEntries = [];
    S.currentProjects = [];
    S.isSearchMode = false;
    S.searchQuery = "";
    if (S.searchDebounce) {
      clearTimeout(S.searchDebounce);
      S.searchDebounce = null;
    }
    navHistory.length = 0;
    updateBackButton();
    // The "current path" shared with the floating terminal (cd-on-connect)
    // belongs to the PREVIOUS server — drop it so nothing cds into a foreign dir.
    (window as any).__filesCurrentPath = "";
    try { sessionStorage.removeItem(FILES_CURRENT_PATH_KEY); } catch { /* ignore */ }

    const searchInput = document.getElementById("files-search") as HTMLInputElement | null;
    if (searchInput) searchInput.value = "";

    S.openTabs = [];
    S.activeTabPath = "";
    S.editingPath = "";
    const editorApi = getEditorApi();
    editorApi?.closeFile();
    const filename = document.getElementById("editor-filename");
    if (filename) filename.textContent = t("labels.noFile", "Sin archivo");
    // The target changed under the user's feet: drop the editor view and force
    // the file browser back (no dirty-confirm — the whole workspace is resetting).
    S.editorVisible = false;
    hideEditorView();
    renderTabs();
    syncToolbarState();

    setStatus(t("status.serverChangedLoading", "Servidor cambiado. Cargando archivos..."));
  }

  export async function syncTargetScopeFromSession(): Promise<void> {
    if (S.targetScopeSyncInFlight) return;
    S.targetScopeSyncInFlight = true;
    try {
      // `/api/session` reflects the per-tab bridge header (api-client sends it)
      // and returns `{ ok, user:{ targetId? } }`; api-client only unwraps a
      // `data` envelope, so the payload is the whole body here. (The old
      // `/api/sso/me` endpoint no longer exists → 404 → this sync never ran.)
      const res = await api.get<any>("/api/session");
      if (!res.ok) return;
      const body = res.data as { user?: { targetId?: string }; targetId?: string } | null;
      const sessionTargetId = String(body?.user?.targetId ?? body?.targetId ?? "").trim();
      const scope = sessionTargetId || LOCAL_TARGET_SCOPE;
      if (scope !== S.activeTargetScope) {
        resetStateForTargetSwitch();
        persistTargetScope(scope);
        restoreDraftsForTarget(scope);
        // Manager tabs are stored PER SERVER — reload the ones of the new scope
        // (a fresh target starts at "/" instead of inheriting the old paths).
        loadFilesManagers();
        renderFilesManagerTabs();
        if (!S.currentPath) {
          await ensureFileAccessPolicy();
          await loadFilesPreferences();
          (window as any).navigate(S.filesAllowAll ? "/" : (S.filesDefaultBase || "/"), { skipHistory: true });
        }
      }
    } finally {
      S.targetScopeSyncInFlight = false;
    }
  }
