// Files page — bind-controls submodule (code-move; no behavior change): AI
// quick-ask, saved-view restore, editor lifecycle events (save/diff/content/
// tabs), save & diff buttons, close editor/diff, new-file dialog.
import { attemptCloseEditor, closeTab, getActiveTab, getEditorApi, openOrActivateTab, openValidateDialog, promoteTabToPermanent, renderTabs, setActiveTab, syncToolbarState, writeActiveFileContent } from "./editor";
import { bindEditorAi } from "./editor-ai";
import { bindEditorFind } from "./editor-find";
import { fmt, t } from "./i18n";
import { setViewMode, updateHiddenToggleUI } from "./listing";
import { getBaseName, joinPath } from "./paths";
import { setProjectsViewActive } from "./projects";
import { S, SHOW_HIDDEN_KEY, FILES_VIEW_KEY } from "./state";
import type { FilesViewMode } from "./state";
import { showToast } from "./toast";
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
import { aiSelectedEntries } from "./state";
import { clearAiSelection } from "./ai-selection";

export function bindEditor(tabsEl: HTMLElement) {
    window.addEventListener("luxipanel:target-changed", clearAiSelection);
    // AI assistant quick-ask: hand the question to the floating assistant in a
    // fresh chat and auto-send it (no extra Enter needed). The current path is
    // attached as context so the model knows where the user is exploring.
    document.getElementById("files-ai-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.getElementById("files-ai-input") as HTMLInputElement | null;
      const question = (input?.value ?? "").trim();
      if (!question) return;
      const ctxPath = S.currentPath || "/";
      const prompt = `${question}\n\n${fmt(t("seeds.aiAskContext", "(Contexto: estoy explorando la ruta \"{path}\" en el administrador de archivos de LUXIPANEL.)"), { path: ctxPath })}`;
      requestAssistant({
        kind: "prompt",
        prompt,
        submit: "auto",
        conversation: "new",
        origin: { module: "files", action: "quickAsk" },
        ...(aiSelectedEntries.length ? { serverEntries: aiSelectedEntries.map((entry) => ({ ...entry, targetScope: resolveTargetScope() })) } : {}),
      });
      if (input) input.value = "";
      clearAiSelection();
    });

    // Restaurar la vista guardada. `setViewMode` persiste CUALQUIERA de las tres
    // (incluida "projects"), pero aquí solo se restauraba "grid": quien dejaba
    // abierta la vista de proyectos y recargaba volvía a la lista, con su
    // preferencia descartada en silencio. Se valida contra los valores conocidos
    // en vez de castear a ciegas — localStorage lo escribe el usuario y puede
    // traer cualquier cosa.
    const saved = localStorage.getItem(FILES_VIEW_KEY);
    const savedView: FilesViewMode | null =
      saved === "grid" || saved === "projects" || saved === "list" ? saved : null;
    // "list" es ya el estado inicial: no hace falta re-aplicarla (y así se evita
    // el trabajo de setViewMode en la carga normal).
    if (savedView && savedView !== "list") setViewMode(savedView);

    // Restore the "show hidden files" preference (default off).
    S.showHidden = localStorage.getItem(SHOW_HIDDEN_KEY) === "1";
    updateHiddenToggleUI();

    // Assert the projects-only toolbar buttons ("Reescanear", desktop + mobile
    // menu) start hidden on load: the default "list" view never calls
    // setViewMode, so without this they'd show outside the projects view (the
    // mobile menu item in particular lacks a `hidden` class). They become
    // visible only once the user enters the projects view.
    setProjectsViewActive(S.viewMode === "projects");

    window.addEventListener("lxp-files-editor-save", () => {
      S.saveBtn?.click();
    });

    const setDiffEnabled = (dirty: boolean) => {
      if (!S.diffBtn) return;
      // Enable the diff button only when the file has unsaved changes; keep it
      // visible-but-disabled otherwise (comparing a file with itself is moot).
      S.diffBtn.classList.remove("hidden");
      S.diffBtn.disabled = !dirty;
      S.diffBtn.classList.toggle("opacity-40", !dirty);
      S.diffBtn.classList.toggle("pointer-events-none", !dirty);
      S.diffBtn.setAttribute("aria-pressed", String(dirty));
    };
    setDiffEnabled(false);
    window.addEventListener("lxp-files-editor-dirty-change", (event: Event) => {
      setDiffEnabled(Boolean((event as CustomEvent<{ dirty: boolean }>).detail?.dirty));
    });

    window.addEventListener("lxp-files-editor-diff-change", (event: Event) => {
      const open = Boolean((event as CustomEvent<{ open: boolean }>).detail?.open);
      S.diffBtn?.classList.toggle("bg-accent", open);
      S.diffBtn?.classList.toggle("text-foreground", open);
      S.diffBtn?.classList.toggle("text-muted-foreground", !open);
      S.diffBtn?.setAttribute("aria-pressed", String(open));
    });

    window.addEventListener("lxp-files-editor-content-change", (event: Event) => {
      const active = getActiveTab();
      if (!active) return;
      const detail = (event as CustomEvent<{ content: string; dirty: boolean }>).detail;
      if (typeof detail?.content === "string") {
        active.content = detail.content;
      }
      active.dirty = Boolean(detail?.dirty);
      // Editing a preview tab pins it (VS Code): a dirty preview must never be
      // silently replaced by the next single-click open (would drop changes).
      if (active.dirty && active.preview) active.preview = false;
      renderTabs();
      syncToolbarState();
    });

    tabsEl.addEventListener("click", async (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-tab-action]");
      if (!target) return;
      const path = target.getAttribute("data-tab-path") ?? "";
      const action = target.getAttribute("data-tab-action");
      if (!path || !action) return;
      if (action === "activate") {
        setActiveTab(path);
      } else if (action === "close") {
        await closeTab(path);
      }
    });

    // Double-clicking a tab pins it (VS Code parity with the tree double-click).
    tabsEl.addEventListener("dblclick", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-tab-action="activate"]');
      const path = target?.getAttribute("data-tab-path") ?? "";
      if (path) promoteTabToPermanent(path);
    });

    S.saveBtn?.addEventListener("click", async () => {
      const active = getActiveTab();
      const editorApi = getEditorApi();
      if (!active || !editorApi) return;
      const content = editorApi.getValue();
      // #7: validate before writing. On invalid, open the validation dialog
      // (Ver error / Corregir con IA / Guardar de todas formas). Fail-open if
      // the validation request itself errors.
      const v: any = await api.post("/api/files/validate", { path: active.path, content });
      if (v.ok && v.data && v.data.valid === false && Array.isArray(v.data.errors) && v.data.errors.length > 0) {
        openValidateDialog(active.path, content, v.data.validator, v.data.errors);
        return;
      }
      await writeActiveFileContent(active.path, content);
    });

    S.diffBtn?.addEventListener("click", () => {
      const editorApi = getEditorApi();
      const active = getActiveTab();
      if (!editorApi?.isDirty() || !active) return;
      if (document.getElementById("file-diff-panel")?.classList.contains("hidden")) {
        editorApi.openDiff();
      } else {
        editorApi.closeDiff();
      }
    });

    document.getElementById("btn-close-diff")?.addEventListener("click", () => {
      getEditorApi()?.closeDiff();
    });

    document.getElementById("btn-close-editor")?.addEventListener("click", () => {
      // Close the modal; open tabs (and their content) stay in memory and
      // reappear next time a file is opened. If there are unsaved changes,
      // prompt first (save & exit / discard & exit / cancel).
      void attemptCloseEditor();
    });

    const newFileDialog = document.getElementById("dialog-new-file") as HTMLDialogElement | null;
    document.getElementById("new-file-close")?.addEventListener("click", () => newFileDialog?.close());
    document.getElementById("new-file-cancel")?.addEventListener("click", () => newFileDialog?.close());
    document.getElementById("form-new-file")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const rawName = (document.getElementById("new-file-name") as HTMLInputElement).value.trim();
      if (!rawName) return;
      const targetPath = joinPath(S.currentPath || "/", rawName);
      const existing = await api.get("/api/files/stat", { params: { path: targetPath } });
      if (existing.ok) {
        showToast(t("toasts.nameAlreadyExists", "Ya existe un archivo o carpeta con ese nombre"), false);
        return;
      }
      const res = await api.put("/api/files/write", { path: targetPath, content: "" });
      if (!res.ok) {
        showToast(res.error ?? t("toasts.createFileError", "Error al crear archivo"), false);
        return;
      }
      newFileDialog?.close();
      const fileName = getBaseName(targetPath);
      showToast(t("toasts.fileCreated", "Archivo creado"));
      await (window as any).navigate(S.currentPath || "/", { skipHistory: true });
      openOrActivateTab(targetPath, fileName, "");
    });

    // In-file find bar (VS Code-style, left of Save). Re-bound per fresh DOM.
    bindEditorFind();
    // AI editor bar (foot of the editor panel; interacts with the active file).
    bindEditorAi();

    // Monaco is initialized lazily on first file open (ensureEditor / showEditorView).
    renderTabs();
    syncToolbarState();
}
