// Obsidian page — document-level delegated control binding (survives SPA swaps).
import { state } from "./state";
import { $, t } from "./dom";
import { settleInput, cancelPendingInput } from "./input-dialog";
import {
  loadVaults, createVault, unregisterVault, selectVault, updateToolbar,
  openPathBrowser, loadPathBrowser, parentPath, pathBrowserCurrent,
} from "./vaults";
import { prepareAssistantContext, syncContainers, analyzeWithAi } from "./assistant";
import {
  createNote, createFolder, saveNote, renameNote, deleteNote, openNote, closeEditor, updateDirtyIndicator,
} from "./editor";
import { toggleLinksPanel, openWikilink } from "./links";
import { scheduleSearch } from "./search";
import { renderTree } from "./tree";
import { hideSearchResults } from "./search";
import { patchPreferences, loadPreferences, resetPreferences } from "./preferences";
import { applyEditorMode, renderPreview, showMobilePane } from "./preview";
import { openToday, openQuickEntry, appendQuickEntry } from "./daily";
import { openDialog } from "/scripts/extracted/lib/dom.js";

// ── Bind controls (document-level delegation → survives SPA swaps) ───────────
export function bindOnce() {
  if ((window as any).__lxpObsidianBound) return;
  (window as any).__lxpObsidianBound = true;
  let previewTimer: number | undefined;
  let allowTargetNavigation = false;

  (window as any).__obsidianBeforeTargetSwitch = async () => {
    if (!$("obs-vault-select")) return true;
    const accepted = await (async () => {
      if (!state.dirty) return true;
      const { confirmDiscardDirty } = await import("./editor");
      return confirmDiscardDirty();
    })();
    if (accepted) {
      allowTargetNavigation = true;
      window.setTimeout(() => { allowTargetNavigation = false; }, 15_000);
    }
    return accepted;
  };

  window.addEventListener("beforeunload", (event) => {
    if (!state.dirty || allowTargetNavigation || !$("obs-vault-select")) return;
    event.preventDefault();
    event.returnValue = "";
  });
  document.addEventListener("astro:before-preparation", (event) => {
    if (!state.dirty || !$("obs-vault-select") || allowTargetNavigation) return;
    if (!window.confirm(t("confirm.discardDirtyBody", "Hay cambios sin guardar en la nota actual. ¿Descartarlos?"))) event.preventDefault();
  });
  window.addEventListener("luxipanel:target-changed", () => {
    if (!$("obs-vault-select")) return;
    allowTargetNavigation = false;
    state.vaultId = null;
    closeEditor();
    state.vaults = [];
    state.tree = { folders: [], notes: [] };
    state.lastVaultId = null;
    state.searchSeq++;
    state.scopeSeq++;
    const selector = $("obs-vault-select") as HTMLSelectElement | null;
    if (selector) selector.innerHTML = "";
    const tree = $("obs-tree");
    if (tree) tree.textContent = "";
    const list = $("obs-settings-vault-list");
    if (list) list.textContent = "";
    $("obs-main")?.classList.add("hidden");
    $("obs-main")?.classList.remove("grid");
    updateToolbar();
    resetPreferences();
    void loadPreferences().then(() => loadVaults());
  });

  document.addEventListener("click", (e) => {
    const el = e.target as HTMLElement | null;
    if (!el) return;

    const settingsTab = el.closest<HTMLElement>("[data-obs-settings-tab]");
    if (settingsTab?.dataset.obsSettingsTab) {
      const name = settingsTab.dataset.obsSettingsTab;
      for (const tab of document.querySelectorAll<HTMLElement>("[data-obs-settings-tab]")) {
        const active = tab.dataset.obsSettingsTab === name;
        tab.classList.toggle("bg-primary/10", active);
        tab.classList.toggle("text-primary", active);
        tab.classList.toggle("text-muted-foreground", !active);
      }
      for (const panel of document.querySelectorAll<HTMLElement>("[data-obs-settings-panel]")) panel.classList.toggle("hidden", panel.dataset.obsSettingsPanel !== name);
      return;
    }
    const modeButton = el.closest<HTMLElement>("[data-obs-mode]");
    if (modeButton?.dataset.obsMode) {
      state.editorMode = modeButton.dataset.obsMode as typeof state.editorMode;
      applyEditorMode();
      const select = $("obs-pref-mode") as HTMLSelectElement | null;
      if (select) select.value = state.editorMode;
      void patchPreferences({ editorMode: state.editorMode });
      return;
    }
    if (el.closest("#obs-mobile-tree")) return showMobilePane("tree");
    if (el.closest("#obs-mobile-editor")) return showMobilePane("editor");
    if (el.closest("#obs-search-clear")) return hideSearchResults();
    if (el.closest("#obs-today")) return void openToday();
    if (el.closest("#obs-daily-append")) return openQuickEntry();
    if (el.closest("#obs-daily-save")) return void appendQuickEntry();
    if (el.closest("#obs-daily-cancel") || el.closest("#obs-daily-x")) {
      ($("dlg-obs-daily") as HTMLDialogElement | null)?.close();
      return;
    }

    // Toolbar / static buttons
    if (el.closest("#obs-new-vault") || el.closest("#obs-empty-cta")) {
      openDialog("dlg-obs-vault");
      return;
    }
    if (el.closest("#obs-vault-cancel") || el.closest("#obs-vault-x")) {
      ($("dlg-obs-vault") as HTMLDialogElement | null)?.close();
      return;
    }
    if (el.closest("#obs-retry-vaults")) return void loadVaults();
    if (el.closest("#obs-vault-save")) return void createVault();

    // Vault path folder picker
    if (el.closest("#obs-vault-browse")) return openPathBrowser();
    if (el.closest("#obs-path-browser-cancel") || el.closest("#obs-path-browser-x")) {
      ($("dlg-obs-path-browser") as HTMLDialogElement | null)?.close();
      return;
    }
    if (el.closest("#obs-path-browser-up")) return void loadPathBrowser(parentPath(pathBrowserCurrent));
    if (el.closest("#obs-path-browser-select")) {
      const pathInput = $("obs-vault-path") as HTMLInputElement | null;
      if (pathInput) pathInput.value = pathBrowserCurrent;
      ($("dlg-obs-path-browser") as HTMLDialogElement | null)?.close();
      return;
    }
    const pathNav = el.closest<HTMLElement>("[data-obs-path-nav]");
    if (pathNav?.dataset.obsPathNav) return void loadPathBrowser(pathNav.dataset.obsPathNav);
    if (el.closest("#obs-unregister")) return void unregisterVault();
    if (el.closest("#obs-prepare-ai")) return void prepareAssistantContext();
    if (el.closest("#obs-sync-containers")) return void syncContainers();
    if (el.closest("#obs-new-note") || el.closest("#obs-toolbar-new-note") || el.closest("#obs-tree-empty-cta")) return void createNote();
    if (el.closest("#obs-new-folder")) return void createFolder();
    if (el.closest("#obs-save")) return void saveNote();
    if (el.closest("#obs-links-toggle")) return void toggleLinksPanel();
    if (el.closest("#obs-analyze-ai")) return analyzeWithAi();

    // Input dialog
    if (el.closest("#obs-input-ok")) {
      const value = ($("obs-input-value") as HTMLInputElement | null)?.value.trim() ?? "";
      return settleInput(value || null);
    }
    if (el.closest("#obs-input-cancel") || el.closest("#obs-input-x")) return settleInput(null);

    // Tree: per-note actions first (they live inside the note row)
    const renameBtn = el.closest<HTMLElement>("[data-rename]");
    if (renameBtn?.dataset.rename) return void renameNote(renameBtn.dataset.rename);
    const deleteBtn = el.closest<HTMLElement>("[data-delete]");
    if (deleteBtn?.dataset.delete) return void deleteNote(deleteBtn.dataset.delete);

    const folderBtn = el.closest<HTMLElement>(".obs-folder");
    if (folderBtn?.dataset.folder !== undefined) {
      const p = folderBtn.dataset.folder!;
      if (state.collapsed.has(p)) state.collapsed.delete(p);
      else state.collapsed.add(p);
      renderTree();
      return;
    }
    const noteRow = el.closest<HTMLElement>(".obs-note");
    if (noteRow?.dataset.note) return void openNote(noteRow.dataset.note);

    // Search hits / backlinks (both carry data-open-note)
    const openBtn = el.closest<HTMLElement>("[data-open-note]");
    if (openBtn?.dataset.openNote) return void openNote(openBtn.dataset.openNote, Number(openBtn.dataset.openLine) || undefined);
    const wikilink = el.closest<HTMLElement>("[data-wikilink]");
    if (wikilink?.dataset.wikilink) return openWikilink(wikilink.dataset.wikilink);
  });

  document.addEventListener("input", (e) => {
    const target = e.target as HTMLElement | null;
    if (target?.id === "obs-editor") {
      if (state.notePath && !state.dirty) {
        state.dirty = true;
        updateDirtyIndicator();
      }
      window.clearTimeout(previewTimer);
      previewTimer = window.setTimeout(() => void renderPreview(), 250);
      return;
    }
    if (target?.id === "obs-search") scheduleSearch();
  });

  document.addEventListener("change", (e) => {
    const target = e.target as HTMLSelectElement | null;
    if (target?.id === "obs-vault-select") void selectVault(target.value);
    if (target?.id === "obs-pref-mode") {
      state.editorMode = target.value as typeof state.editorMode;
      applyEditorMode();
      void patchPreferences({ editorMode: state.editorMode });
    }
    if (target?.id === "obs-pref-font") {
      state.fontSize = Number(target.value);
      applyEditorMode();
      void patchPreferences({ fontSize: state.fontSize });
    }
  });

  // Esc / backdrop close of the input dialog settles its pending promise.
  document.addEventListener("close", (e) => {
    if ((e.target as HTMLElement | null)?.id === "dlg-obs-input") cancelPendingInput();
  }, true);

  document.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement | null;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && $("obs-vault-select")) {
      e.preventDefault();
      showMobilePane("tree");
      ($("obs-search") as HTMLInputElement | null)?.focus();
      return;
    }
    if (e.key === "Escape" && target?.id === "obs-search") return hideSearchResults();
    // Ctrl/⌘+S in the editor saves the note.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && target?.id === "obs-editor") {
      e.preventDefault();
      void saveNote();
      return;
    }
    // Enter in the generic input dialog confirms it.
    if (e.key === "Enter" && target?.id === "obs-input-value") {
      e.preventDefault();
      const value = ($("obs-input-value") as HTMLInputElement | null)?.value.trim() ?? "";
      settleInput(value || null);
    }
  });
}
