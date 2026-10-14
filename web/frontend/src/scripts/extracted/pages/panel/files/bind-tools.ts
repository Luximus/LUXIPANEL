// Files page — bind-controls submodule (code-move; no behavior change): tool
// dialogs wiring — exposure, validate, compare, folder picker, file history,
// git, malware/quarantine, cleanup, image, meta tags, client/dev mode, shares,
// cleanup-AI, git-clone, quick-ask assistant.
import { bindValidateDialog } from "./editor";
import { onGitBodyChange, onGitBodyClick, onGitBodyInput, openGitDialog, submitGitClone } from "./git";
import { loadFolderPicker, onCompareClick, onFileHistoryClick, openCompareDialog, openFolderPicker, parentOf, runCompare } from "./history-file-versions";
import { fmt, t } from "./i18n";
import { S } from "./state";
import { showToast } from "./toast";
import { addMetaTag, applyFilesMode, cleanupScanPath, createShare, deleteCleanupSelected, loadCleanup, loadExposure, loadMalwareScan, loadQuarantine, loadShares, onExposureClick, onImageLargeClick, onImageOpClick, onMalwareResultClick, onQuarantineClick, onShareListClick, openExposureDialog, openMalwareDialog, removeMetaTag, saveMeta } from "./tools";
import { patchFilesPreferences } from "./preferences";
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";

export function bindTools() {

    // Web exposure scanner (#3/#16): list sensitive files inside nginx public
    // roots and offer probe / block / download / delete per finding.
    document.getElementById("btn-exposure")?.addEventListener("click", () => openExposureDialog());
    document.getElementById("exposure-close")?.addEventListener("click", () =>
      (document.getElementById("dialog-exposure") as HTMLDialogElement | null)?.close(),
    );
    document.getElementById("exposure-refresh")?.addEventListener("click", () => void loadExposure());
    document.getElementById("exposure-body")?.addEventListener("click", onExposureClick);

    // Pre-save validation dialog (#7).
    bindValidateDialog();

    // Folder compare (#6).
    document.getElementById("btn-compare")?.addEventListener("click", () => openCompareDialog());
    document.getElementById("compare-close")?.addEventListener("click", () =>
      (document.getElementById("dialog-compare") as HTMLDialogElement | null)?.close(),
    );
    document.getElementById("form-compare")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      void runCompare();
    });
    document.getElementById("compare-results")?.addEventListener("click", onCompareClick);

    // Folder picker (reused by the Compare dialog's "Examinar" buttons): browse
    // the client server's filesystem and pick a directory instead of typing it.
    document.getElementById("compare-from-browse")?.addEventListener("click", () => openFolderPicker("compare-from"));
    document.getElementById("compare-to-browse")?.addEventListener("click", () => openFolderPicker("compare-to"));
    const closeFolderPicker = () => (document.getElementById("dialog-folder-picker") as HTMLDialogElement | null)?.close();
    document.getElementById("folder-picker-close")?.addEventListener("click", closeFolderPicker);
    document.getElementById("folder-picker-cancel")?.addEventListener("click", closeFolderPicker);
    document.getElementById("folder-picker-up")?.addEventListener("click", () => void loadFolderPicker(parentOf(S.folderPickerCurrent)));
    document.getElementById("folder-picker-select")?.addEventListener("click", () => {
      // Callback mode (e.g. "set tree root") takes precedence over the legacy
      // input-writing mode used by the Compare dialog's browse buttons.
      if (S.folderPickerOnSelect) {
        const cb = S.folderPickerOnSelect;
        S.folderPickerOnSelect = null;
        closeFolderPicker();
        cb(S.folderPickerCurrent);
        return;
      }
      const target = document.getElementById(S.folderPickerTarget) as HTMLInputElement | null;
      if (target) target.value = S.folderPickerCurrent;
      closeFolderPicker();
    });
    document.getElementById("folder-picker-list")?.addEventListener("click", (ev) => {
      const btn = (ev.target as HTMLElement | null)?.closest("[data-folder-nav]") as HTMLElement | null;
      if (btn) void loadFolderPicker(btn.getAttribute("data-folder-nav") || "/");
    });
    // Predefined-routes <select>: navigate the picker to the chosen favorite so
    // the user can review it and confirm with "Select" (same flow as browsing).
    document.getElementById("folder-picker-fav")?.addEventListener("change", (ev) => {
      const sel = ev.target as HTMLSelectElement | null;
      const val = sel?.value || "";
      if (sel) sel.value = ""; // reset to placeholder so re-picking the same route fires again
      if (val) void loadFolderPicker(val);
    });

    // Per-file version history (#8).
    document.getElementById("file-history-close")?.addEventListener("click", () =>
      (document.getElementById("dialog-file-history") as HTMLDialogElement | null)?.close(),
    );
    document.getElementById("file-history-body")?.addEventListener("click", onFileHistoryClick);

    // Git panel (#14, phase 1).
    document.getElementById("btn-git")?.addEventListener("click", () => openGitDialog());
    document.getElementById("git-close")?.addEventListener("click", () =>
      (document.getElementById("dialog-git") as HTMLDialogElement | null)?.close(),
    );
    document.getElementById("git-body")?.addEventListener("click", onGitBodyClick);
    document.getElementById("git-body")?.addEventListener("input", onGitBodyInput);
    document.getElementById("git-body")?.addEventListener("change", onGitBodyChange);
    document.getElementById("git-clone-close")?.addEventListener("click", () =>
      (document.getElementById("dialog-git-clone") as HTMLDialogElement | null)?.close(),
    );

    // Malware / quarantine (#12/#13).
    document.getElementById("btn-malware")?.addEventListener("click", () => openMalwareDialog());
    document.getElementById("malware-close")?.addEventListener("click", () =>
      (document.getElementById("dialog-malware") as HTMLDialogElement | null)?.close(),
    );
    document.getElementById("malware-rescan")?.addEventListener("click", () => void loadMalwareScan());
    document.getElementById("malware-q-refresh")?.addEventListener("click", () => void loadQuarantine());
    document.getElementById("malware-results")?.addEventListener("click", onMalwareResultClick);
    document.getElementById("malware-quarantine")?.addEventListener("click", onQuarantineClick);

    // Smart cleanup (#11).
    document.getElementById("cleanup-close")?.addEventListener("click", () =>
      (document.getElementById("dialog-cleanup") as HTMLDialogElement | null)?.close(),
    );
    document.getElementById("cleanup-rescan")?.addEventListener("click", () => void loadCleanup());
    document.getElementById("cleanup-delete")?.addEventListener("click", () => void deleteCleanupSelected());

    // Image optimization (#22).
    document.getElementById("image-close")?.addEventListener("click", () =>
      (document.getElementById("dialog-image") as HTMLDialogElement | null)?.close(),
    );
    document.getElementById("image-single")?.addEventListener("click", onImageOpClick);
    document.getElementById("image-large")?.addEventListener("click", onImageLargeClick);

    // Tags + comments (#23/#24).
    document.getElementById("meta-close")?.addEventListener("click", () =>
      (document.getElementById("dialog-meta") as HTMLDialogElement | null)?.close(),
    );
    document.getElementById("meta-presets")?.addEventListener("click", (ev) => {
      const t = (ev.target as HTMLElement | null)?.closest("[data-tag]") as HTMLElement | null;
      if (t) addMetaTag(t.getAttribute("data-tag") || "");
    });
    document.getElementById("meta-tags")?.addEventListener("click", (ev) => {
      const t = (ev.target as HTMLElement | null)?.closest("[data-rm-tag]") as HTMLElement | null;
      if (t) removeMetaTag(t.getAttribute("data-rm-tag") || "");
    });
    document.getElementById("meta-add-form")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const input = document.getElementById("meta-add") as HTMLInputElement | null;
      if (input?.value.trim()) { addMetaTag(input.value.trim()); input.value = ""; }
    });
    document.getElementById("meta-save")?.addEventListener("click", () => void saveMeta());

    // Client/dev mode (#25): load + apply gating, and wire the toggle.
    document.getElementById("files-mode-select")?.addEventListener("change", async (e) => {
      const mode = (e.target as HTMLSelectElement).value === "client" ? "client" : "developer";
      const res = await patchFilesPreferences({ mode });
      if (res.ok) { S.filesClientMode = mode === "client"; applyFilesMode(); showToast(fmt(t("toasts.modeActivated", "Modo {mode} activado"), { mode: mode === "client" ? t("labels.modeClient", "cliente") : t("labels.modeDeveloper", "desarrollador") })); }
      else { (e.target as HTMLSelectElement).value = S.filesClientMode ? "client" : "developer"; showToast(res.error || t("toasts.modeChangeError", "No se pudo cambiar el modo"), false); }
    });

    // Share links (#17).
    document.getElementById("share-close")?.addEventListener("click", () =>
      (document.getElementById("dialog-share") as HTMLDialogElement | null)?.close(),
    );
    document.getElementById("form-share")?.addEventListener("submit", (ev) => { ev.preventDefault(); void createShare(); });
    document.getElementById("share-refresh")?.addEventListener("click", () => void loadShares());
    document.getElementById("share-copy")?.addEventListener("click", async () => {
      const u = (document.getElementById("share-url") as HTMLInputElement | null)?.value || "";
      if (u) { try { await navigator.clipboard.writeText(u); showToast(t("toasts.linkCopied", "Enlace copiado")); } catch { showToast(t("toasts.copyFailed", "No se pudo copiar"), false); } }
    });
    document.getElementById("share-list")?.addEventListener("click", onShareListClick);
    document.getElementById("cleanup-ai")?.addEventListener("click", () => {
      const prompt = fmt(t("seeds.cleanupPrompt", "Estoy limpiando la carpeta \"{path}\" para liberar espacio. Revisa qué archivos/carpetas son seguros de borrar (regenerables) y cuáles debo conservar, y dame recomendaciones."), { path: cleanupScanPath });
      requestAssistant({
        kind: "prompt",
        prompt,
        submit: "auto",
        conversation: "new",
        origin: { module: "files", action: "cleanup" },
      });
    });
    document.getElementById("form-git-clone")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      void submitGitClone();
    });

}
