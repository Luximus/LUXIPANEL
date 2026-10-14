// Files page — bind-controls submodule (code-move; no behavior change): top
// toolbar wiring — view modes, hidden toggle, open-files, new file, forwarded
// desktop actions, change-history dialog, search/replace controls, project map.
import { showEditorView, updateOpenFilesButton } from "./editor";
import { historyFilterPath, loadSnapshots, onHistoryListClick, openHistoryDialog } from "./history-file-versions";
import { setShowHidden, setViewMode } from "./listing";
import { applyReplace, exitContentResults, onContentResultClick, openReplaceDialog, runReplacePreview, toggleSearchCase, toggleSearchMode } from "./search-replace";
import { S } from "./state";
import { openProjectMap } from "./tools";

export function bindToolbar(viewListBtn: HTMLElement, viewGridBtn: HTMLElement, viewProjectsBtn: HTMLElement, newFileBtn: HTMLElement) {
    viewListBtn.addEventListener("click", () => setViewMode("list"));
    viewGridBtn.addEventListener("click", () => setViewMode("grid"));
    viewProjectsBtn.addEventListener("click", () => setViewMode("projects"));
    document.getElementById("btn-toggle-hidden")?.addEventListener("click", () => setShowHidden(!S.showHidden));
    // Open-files quick access: the toolbar button opens the editor modal
    // directly — it already shows every open file as a tab (no extra list modal).
    document.getElementById("btn-open-files")?.addEventListener("click", () => { if (S.openTabs.length > 0) void showEditorView(); });
    updateOpenFilesButton();
    newFileBtn.addEventListener("click", () => {
      const nameInput = document.getElementById("new-file-name") as HTMLInputElement | null;
      if (nameInput) nameInput.value = "";
      const dialog = document.getElementById("dialog-new-file") as HTMLDialogElement | null;
      dialog?.showModal();
      nameInput?.focus();
    });

    // Desktop inline action buttons forward to the existing (mobile) menu
    // buttons so there's a single set of handlers. The menu still exists in the
    // DOM (md:hidden) and its click handlers fire when triggered programmatically.
    const forwardActions: Array<[string, string]> = [
      ["btn-projects-d", "btn-view-projects"],
      ["btn-new-file-d", "btn-new-file"],
      ["btn-project-map-d", "btn-project-map"],
      ["btn-git-d", "btn-git"],
      ["btn-compare-d", "btn-compare"],
      ["btn-exposure-d", "btn-exposure"],
      ["btn-malware-d", "btn-malware"],
      ["btn-history-d", "btn-history"],
      ["btn-upload-d", "btn-upload"],
      ["btn-mkdir-d", "btn-mkdir"],
    ];
    for (const [from, to] of forwardActions) {
      document.getElementById(from)?.addEventListener("click", () => document.getElementById(to)?.click());
    }

    // Change history ("Modo cambios seguros"): open the snapshots dialog and
    // wire its row actions. Re-bound each init because the SPA swap replaces
    // these nodes (same as the other dialogs above).
    document.getElementById("btn-history")?.addEventListener("click", () => openHistoryDialog());
    document.getElementById("history-close")?.addEventListener("click", () =>
      (document.getElementById("dialog-history") as HTMLDialogElement | null)?.close(),
    );
    document.getElementById("history-refresh")?.addEventListener("click", () =>
      void loadSnapshots(historyFilterPath || undefined),
    );
    document.getElementById("history-list")?.addEventListener("click", onHistoryListClick);

    // Search controls live in the toolbar search box now (no modal): a mode
    // toggle (name ⇄ text-in-files), a case-sensitivity toggle, and a replace
    // button. Content-search results replace the file listing.
    document.getElementById("btn-search-mode")?.addEventListener("click", () => toggleSearchMode());
    document.getElementById("btn-search-case")?.addEventListener("click", () => toggleSearchCase());
    document.getElementById("content-search-results")?.addEventListener("click", onContentResultClick);
    document.getElementById("content-search-back")?.addEventListener("click", () => exitContentResults());

    // Mass replace (#10): open from the search box (prefilled), preview, apply.
    document.getElementById("btn-search-replace")?.addEventListener("click", () => {
      const q = (document.getElementById("files-search") as HTMLInputElement | null)?.value ?? "";
      openReplaceDialog({ search: S.searchMode === "content" ? q : "", mode: "text", caseSensitive: S.searchCaseSensitive });
    });
    document.getElementById("replace-close")?.addEventListener("click", () =>
      (document.getElementById("dialog-replace") as HTMLDialogElement | null)?.close(),
    );
    document.getElementById("replace-cancel")?.addEventListener("click", () =>
      (document.getElementById("dialog-replace") as HTMLDialogElement | null)?.close(),
    );
    document.getElementById("form-replace")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      void runReplacePreview();
    });
    document.getElementById("replace-apply")?.addEventListener("click", () => void applyReplace());

    // Smart project map (#4): detect the stack of the current folder and show
    // a navigable logical map (public root, config, routes, views, logs…).
    document.getElementById("btn-project-map")?.addEventListener("click", () => openProjectMap());
}
