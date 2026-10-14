// Files page — editor submodule (code-move from index-script1.ts; no behavior change).
import { fmt, t } from "./i18n";
import { renderFiles, rowPathFor, setViewMode, visibleSortedEntries } from "./listing";
import { escapeAttr, escapeHtml, getParentPath } from "./paths";
import { ensureFilesPermStyle, filesCan } from "./perm-gating";
import { S, selected } from "./state";
import { setStatus, showLoadingToast, showToast } from "./toast";
import { api, resolvePanelApiPath, scopeHeaders } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";

let monacoAssetsPromise: Promise<typeof import("/scripts/extracted/pages/panel/files/panel-files-monaco.js")> | null = null;
function loadMonacoAssets() {
  if (monacoAssetsPromise) return monacoAssetsPromise;
  monacoAssetsPromise = Promise.all([
    import("/scripts/extracted/pages/panel/files/panel-files-monaco.js?v=20260929-drawer-speed"),
    new Promise<void>((resolve, reject) => {
      const href = "/scripts/extracted/pages/panel/files/panel-files-monaco.css?v=20260929-drawer-speed";
      const existing = document.querySelector<HTMLLinkElement>('link[data-lxp-files-monaco-css]');
      if (existing?.dataset.loaded === "true") { resolve(); return; }
      const link = existing ?? document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.lxpFilesMonacoCss = "";
      link.addEventListener("load", () => { link.dataset.loaded = "true"; resolve(); }, { once: true });
      link.addEventListener("error", () => { link.remove(); reject(new Error("Monaco CSS failed to load")); }, { once: true });
      if (!existing) document.head.appendChild(link);
    }),
  ]).then(([module]) => module).catch((error) => { monacoAssetsPromise = null; throw error; });
  return monacoAssetsPromise;
}


  // ── Double click ───────────────────────────────────────────
  /** Detect media files by extension → "image" | "video" | "audio" | null. */
  export function mediaKind(name: string): "image" | "video" | "audio" | null {
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "ico"].includes(ext)) return "image";
    if (["mp4", "webm", "ogv", "mov", "m4v", "mkv"].includes(ext)) return "video";
    if (["mp3", "wav", "ogg", "oga", "m4a", "flac", "aac", "opus"].includes(ext)) return "audio";
    return null;
  }

  // ── Visor de imágenes tipo carrusel ──────────────────────────
  // Descarga un archivo del target por el MISMO camino que el visor y el
  // botón de descarga: fetch al endpoint raw (READ-gated) CON las cabeceras de
  // aislamiento por pestaña (`scopeHeaders()` → X-Bridge-Session-Id + CSRF) y
  // se sirve desde un object URL. Un `<img src="/api/…">` crudo no puede llevar
  // esas cabeceras y en target remoto vuelve roto.
  async function fetchMediaObjectUrl(path: string): Promise<string> {
    const url = `${resolvePanelApiPath("/api/files/raw")}?path=${encodeURIComponent(path)}`;
    const res = await fetch(url, { credentials: "include", headers: scopeHeaders(), cache: "no-store" });
    if (!res.ok) throw Object.assign(new Error("media-http"), { status: res.status });
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  function revokeMediaUrl(u: string | undefined | null): void {
    if (!u) return;
    try { URL.revokeObjectURL(u); } catch { /* noop */ }
  }

  /** Revoca la object URL activa y todas las de prefetch; resetea la galería. */
  export function clearMediaViewer(): void {
    const body = document.getElementById("media-body");
    if (body) body.innerHTML = "";
    revokeMediaUrl(S.mediaObjectUrl);
    S.mediaObjectUrl = "";
    for (const u of Object.values(S.mediaPrefetch)) revokeMediaUrl(u);
    S.mediaPrefetch = {};
    S.mediaGallery = [];
    S.mediaIndex = -1;
    S.mediaLoadToken++; // invalida cualquier fetch en vuelo
  }

  /** Actualiza contador «n de N», nombre y estado (habilitado) de las flechas. */
  function updateMediaChrome(): void {
    const total = S.mediaGallery.length;
    const cur = S.mediaGallery[S.mediaIndex];
    const title = document.getElementById("media-filename");
    if (title && cur) title.textContent = cur.name;
    const counter = document.getElementById("media-counter");
    if (counter) {
      const many = total > 1;
      counter.textContent = many ? fmt(t("media.counter", "{n} de {total}"), { n: S.mediaIndex + 1, total }) : "";
      counter.classList.toggle("hidden", !many);
    }
    const prev = document.getElementById("media-prev") as HTMLButtonElement | null;
    const next = document.getElementById("media-next") as HTMLButtonElement | null;
    const many = total > 1;
    for (const [btn, disabled] of [[prev, S.mediaIndex <= 0], [next, S.mediaIndex >= total - 1]] as const) {
      if (!btn) continue;
      btn.classList.toggle("hidden", !many);
      btn.disabled = disabled;
      btn.classList.toggle("opacity-30", disabled);
      btn.classList.toggle("pointer-events-none", disabled);
    }
    const dl = document.getElementById("media-download") as HTMLAnchorElement | null;
    if (dl && cur) {
      // Un `<a href>` no puede llevar X-Bridge-Session-Id → en target remoto
      // resolvería contra el host del panel. Se enruta por el helper de descarga
      // (cabeceras + guardar-como). Se re-cablea en cada slide.
      dl.href = "#";
      dl.onclick = (ev) => {
        ev.preventDefault();
        const download = (window as any).downloadEntry as ((p: string, n: string, isDir: boolean) => Promise<void>) | undefined;
        if (download) void download(cur.path, cur.name, false);
      };
      dl.classList.toggle("hidden", !filesCan("files.download"));
    }
  }

  /** Precarga (sin bloquear) la object URL de una posición vecina si existe. */
  function prefetchMediaAt(index: number): void {
    const item = S.mediaGallery[index];
    if (!item || item.kind !== "image") return;
    if (S.mediaPrefetch[item.path]) return;
    void fetchMediaObjectUrl(item.path)
      .then((u) => {
        // Si la galería se cerró/cambió mientras tanto, revoca y descarta.
        if (S.mediaGallery[index]?.path === item.path) S.mediaPrefetch[item.path] = u;
        else revokeMediaUrl(u);
      })
      .catch(() => { /* precarga best-effort */ });
  }

  /** Renderiza el elemento en `index` cargándolo por blob+scopeHeaders. */
  async function loadMediaAt(index: number): Promise<void> {
    const item = S.mediaGallery[index];
    const body = document.getElementById("media-body");
    if (!item || !body) return;
    S.mediaIndex = index;
    const token = ++S.mediaLoadToken;
    updateMediaChrome();

    const render = (objUrl: string) => {
      // La object URL mostrada pasa a ser la "activa"; revoca la anterior salvo
      // que se conserve en prefetch (no debería, ya se saca del mapa).
      if (S.mediaObjectUrl && S.mediaObjectUrl !== objUrl) revokeMediaUrl(S.mediaObjectUrl);
      S.mediaObjectUrl = objUrl;
      if (item.kind === "image") {
        body.innerHTML = `<img src="${objUrl}" alt="${escapeAttr(item.name)}" class="max-h-[78vh] max-w-full object-contain select-none" draggable="false" />`;
      } else if (item.kind === "video") {
        body.innerHTML = `<video src="${objUrl}" class="max-h-[78vh] max-w-full" autoplay controls playsinline></video>`;
      } else {
        body.innerHTML = `<audio src="${objUrl}" autoplay controls class="w-full"></audio>`;
      }
      // Precarga vecinas para que ‹ › sean instantáneas.
      prefetchMediaAt(index + 1);
      prefetchMediaAt(index - 1);
    };

    // Cache hit: instantáneo, sin spinner.
    const cached = S.mediaPrefetch[item.path];
    if (cached) { delete S.mediaPrefetch[item.path]; render(cached); return; }

    body.innerHTML = `<div class="p-6 text-sm text-muted-foreground"><i class="ti ti-loader animate-spin mr-2"></i>${t("status.loading", "Cargando…")}</div>`;
    try {
      const objUrl = await fetchMediaObjectUrl(item.path);
      if (token !== S.mediaLoadToken) { revokeMediaUrl(objUrl); return; } // navegación más reciente ganó
      render(objUrl);
    } catch (e: any) {
      if (token !== S.mediaLoadToken) return;
      const status = e?.status;
      body.innerHTML = status
        ? `<div class="p-6 text-sm text-destructive">${fmt(t("toasts.mediaLoadError", "No se pudo cargar el archivo ({status})."), { status })}</div>`
        : `<div class="p-6 text-sm text-destructive">${escapeHtml(t("media.networkLoadError", "Error de red al cargar el archivo."))}</div>`;
    }
  }

  /** Navega delta posiciones (−1 anterior / +1 siguiente) dentro de la galería. */
  export function mediaNav(delta: number): void {
    const target = S.mediaIndex + delta;
    if (target < 0 || target >= S.mediaGallery.length) return; // sin wrap en extremos
    void loadMediaAt(target);
  }

  export async function openMediaModal(path: string, name: string, kind: "image" | "video" | "audio"): Promise<void> {
    const dlg = document.getElementById("dialog-media") as HTMLDialogElement | null;
    const body = document.getElementById("media-body");
    if (!dlg || !body) return;
    // Limpia cualquier estado/URLs de una apertura previa antes de construir la
    // nueva galería (evita fugas de object URLs).
    clearMediaViewer();
    // Galería = imágenes de la carpeta actual EN EL ORDEN MOSTRADO (mismo
    // predicado de extensión que dispara el visor). Vídeo/audio no forman
    // carrusel: se muestran como un único elemento.
    if (kind === "image" && !S.isSearchMode) {
      S.mediaGallery = visibleSortedEntries(S.currentEntries)
        .filter((e: any) => !e?.isDir && mediaKind(typeof e?.name === "string" ? e.name : "") === "image")
        .map((e: any) => ({ path: rowPathFor(e), name: (typeof e?.name === "string" ? e.name : ""), kind: "image" as const }));
      S.mediaIndex = S.mediaGallery.findIndex((g) => g.path === path);
    }
    // Fallback (target no encontrado, modo búsqueda, o no-imagen): un solo item.
    if (S.mediaIndex < 0) {
      S.mediaGallery = [{ path, name, kind }];
      S.mediaIndex = 0;
    }
    if (!dlg.open) dlg.showModal();
    await loadMediaAt(S.mediaIndex);
  }
  export const getEditorApi = () => (window as any).__lxpFilesMonacoEditor as {
    openFile(payload: { path: string; name: string; content: string; originalContent?: string }): void;
    getValue(): string;
    setValue(value: string): void;
    closeFile(): void;
    markSaved(value?: string): void;
    openDiff(): void;
    closeDiff(): void;
    isDirty(): boolean;
    gotoLine(line: number): void;
    getSelection(): { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number; text: string } | null;
    applyEdit(edit: { mode: "replaceAll"; content: string } | { mode: "replaceRange"; range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }; content: string }): boolean;
    focus(): void;
    find(query: string, opts?: { isRegex?: boolean; matchCase?: boolean; wholeWord?: boolean }): { total: number; index: number; error?: boolean };
    findNext(): { total: number; index: number };
    findPrev(): { total: number; index: number };
    clearFind(returnFocus?: boolean): void;
    layout(): void;
  } | undefined;

  // Monaco is mounted lazily (same pattern as the NGINX "modo avanzado" modal):
  // the editor lives inside a closed <dialog> with no size, so we instantiate it
  // only on the first file open — after showModal() — and then re-layout.
  export let editorInitialized = false;
  export let editorInitPromise: Promise<void> | null = null;
  // Tracks the DOM node Monaco was mounted on. Astro's ClientRouter swaps the
  // #file-editor host on SPA re-entry; when it changes we must re-init so Monaco
  // re-anchors to the fresh, visible host (otherwise layout()/edits hit the old
  // detached node and the editor looks blank/inert).
  let editorHostEl: HTMLElement | null = null;
  // Guard against concurrent toggles (shortcut/button racing).
  let editorToggleInFlight = false;

  export function ensureEditor(): Promise<void> {
    const host = document.getElementById("file-editor");
    const hostChanged = editorInitialized && host !== null && host !== editorHostEl;
    if (editorInitialized && !hostChanged) return editorInitPromise ?? Promise.resolve();
    if (editorInitPromise && !hostChanged) return editorInitPromise;
    editorHostEl = host;
    editorInitPromise = (async () => {
      const { initFilesMonacoEditor } = await loadMonacoAssets();
      await initFilesMonacoEditor({ hostId: "file-editor", diffHostId: "file-diff-editor" });
      editorInitialized = true;
      editorHostEl = document.getElementById("file-editor");
    })().catch((error) => { editorInitPromise = null; throw error; });
    return editorInitPromise;
  }

  export function getEditorPanel(): HTMLDialogElement | null {
    return document.getElementById("files-editor-panel") as HTMLDialogElement | null;
  }

  /** Reflect S.editorVisible on every sidebar toggle button (aria-pressed). */
  export function syncEditorToggleButtons(): void {
    document.querySelectorAll<HTMLElement>("[data-files-editor-toggle]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(S.editorVisible));
    });
  }

  /** Open a right-hand drawer above the explorer and lay out Monaco once visible. */
  export async function showEditorView(): Promise<void> {
    S.editorVisible = true;
    const panel = getEditorPanel();
    if (panel) {
      panel.classList.remove("hidden");
      panel.removeAttribute("aria-hidden");
      panel.removeAttribute("inert");
      panel.style.overflow = "hidden";
      panel.querySelector<HTMLElement>(".relative.min-h-0")?.style.setProperty("overflow", "hidden");
      panel.querySelector<HTMLElement>("#files-editor-ai")?.style.setProperty("flex", "none");
      panel.oncancel = (event) => {
        event.preventDefault();
        void attemptCloseEditor();
      };
      if (!panel.open || panel.hasAttribute("data-lxp-closing")) panel.showModal();
    }
    syncEditorToggleButtons();
    await ensureEditor();
    if (!S.editorVisible || panel !== getEditorPanel() || !panel?.open) return;
    // On the first open Monaco's API doesn't exist until ensureEditor resolves,
    // so re-sync the active tab now (idempotent on later opens).
    syncEditorToActiveTab();
    requestAnimationFrame(() => {
      getEditorApi()?.layout();
      // No active file → focus the Close button so keyboard users aren't stranded.
      if (!getActiveTab()) document.getElementById("btn-close-editor")?.focus();
    });
  }

  /** Close only the editor drawer; the explorer stays mounted underneath. */
  export function hideEditorView(): void {
    S.editorVisible = false;
    const panel = getEditorPanel();
    const returnFocus = () => {
      const toggle = document.querySelector<HTMLElement>("[data-files-editor-toggle]");
      (toggle ?? document.getElementById("files-manager-tabs"))?.focus?.();
    };
    if (panel) {
      if (panel.open) {
        panel.addEventListener("close", returnFocus, { once: true });
        panel.close();
      } else returnFocus();
      panel.classList.add("hidden");
      panel.setAttribute("aria-hidden", "true");
      panel.setAttribute("inert", "");
    } else returnFocus();
    syncEditorToggleButtons();
  }

  /** Restore the drawer state after an Astro DOM swap. */
  export function syncEditorWorkspaceView(): void {
    if (S.editorVisible) void showEditorView();
    else hideEditorView();
  }

  /** Toggle the editor view. Opening → showEditorView; closing → attemptCloseEditor
   *  (which keeps the dirty-confirm flow). Idempotent under concurrent calls. */
  export async function toggleEditor(): Promise<void> {
    if (editorToggleInFlight) return;
    editorToggleInFlight = true;
    try {
      if (S.editorVisible) await attemptCloseEditor();
      else await showEditorView();
    } finally {
      editorToggleInFlight = false;
    }
  }

  /**
   * Three-way confirmation shown when the editor is closed with unsaved
   * changes: save & exit, discard & exit, or cancel (stay). Resolves to the
   * chosen action; Escape / the X button count as "cancel".
   */
  export function openEditorUnsavedDialog(): Promise<"save" | "discard" | "cancel"> {
    const dlg = document.getElementById("dialog-editor-unsaved") as HTMLDialogElement | null;
    if (!dlg) return Promise.resolve("discard");
    return new Promise((resolve) => {
      const saveBtn = document.getElementById("editor-unsaved-save");
      const discardBtn = document.getElementById("editor-unsaved-discard");
      const cancelBtn = document.getElementById("editor-unsaved-cancel");
      const closeBtn = document.getElementById("editor-unsaved-close");
      let done = false;
      const cleanup = () => {
        saveBtn?.removeEventListener("click", onSave);
        discardBtn?.removeEventListener("click", onDiscard);
        cancelBtn?.removeEventListener("click", onCancel);
        closeBtn?.removeEventListener("click", onCancel);
        dlg.removeEventListener("close", onClose);
      };
      const finish = (result: "save" | "discard" | "cancel") => {
        if (done) return;
        done = true;
        cleanup();
        if (dlg.open) dlg.close();
        resolve(result);
      };
      const onSave = () => finish("save");
      const onDiscard = () => finish("discard");
      const onCancel = () => finish("cancel");
      const onClose = () => finish("cancel"); // Escape closes the dialog
      saveBtn?.addEventListener("click", onSave);
      discardBtn?.addEventListener("click", onDiscard);
      cancelBtn?.addEventListener("click", onCancel);
      closeBtn?.addEventListener("click", onCancel);
      dlg.addEventListener("close", onClose);
      if (!dlg.open) dlg.showModal();
    });
  }

  /** Write every dirty tab to disk. Returns false if any write failed. */
  export async function saveAllDirtyTabs(): Promise<boolean> {
    commitActiveTabFromEditor();
    let allOk = true;
    for (const tab of S.openTabs) {
      if (!tab.dirty) continue;
      const res = await api.put("/api/files/write", { path: tab.path, content: tab.content });
      if (!res.ok) { allOk = false; continue; }
      tab.originalContent = tab.content;
      tab.dirty = false;
    }
    const active = getActiveTab();
    if (active) getEditorApi()?.markSaved(active.content);
    renderTabs();
    syncToolbarState();
    return allOk;
  }

  /**
   * Close the editor, but if any open tab has unsaved changes first prompt the
   * user (save & exit / discard & exit / cancel). Used by both the X button and
   * the Escape key.
   */
  export async function attemptCloseEditor() {
    commitActiveTabFromEditor();
    if (!S.openTabs.some((tab) => tab.dirty)) {
      hideEditorView();
      return;
    }
    const choice = await openEditorUnsavedDialog();
    if (choice === "cancel") return;
    if (choice === "save") {
      const ok = await saveAllDirtyTabs();
      if (!ok) {
        showToast(t("toasts.saveError", "Error al guardar"), false);
        return; // keep the editor open so the user can retry
      }
      showToast(t("toasts.fileSaved", "Archivo guardado"));
    }
    hideEditorView();
  }

  // ── Pre-save validation ("Validar antes de guardar", #7) ───
  export async function writeActiveFileContent(path: string, content: string) {
    const res = await api.put("/api/files/write", { path, content });
    if (!res.ok) { showToast(t("toasts.saveError", "Error al guardar"), false); return; }
    const tab = getTab(path);
    if (tab) {
      tab.content = content;
      tab.originalContent = content;
      tab.dirty = false;
    }
    getEditorApi()?.markSaved(content);
    renderTabs();
    syncToolbarState();
    showToast(t("toasts.fileSaved", "Archivo guardado"));
  }

  export function openValidateDialog(path: string, content: string, validator: string, errors: Array<{ line?: number; column?: number; message: string }>) {
    S.pendingValidate = { path, content, validator, errors };
    const dlg = document.getElementById("dialog-validate") as HTMLDialogElement | null;
    const summary = document.getElementById("validate-summary");
    const list = document.getElementById("validate-errors");
    if (summary) summary.textContent = fmt(t("validate.summary", "Validador: {validator} · {name}"), { validator, name: path.split("/").pop() || path });
    if (list) {
      list.innerHTML = errors
        .map((e) => {
          const loc = e.line ? `<span class="font-mono text-xs text-muted-foreground">L${e.line}${e.column ? ":" + e.column : ""}</span> ` : "";
          return `<li>${loc}${escapeHtml(e.message)}</li>`;
        })
        .join("");
    }
    // "Ver error" only useful when we have a line.
    document.getElementById("validate-goto")?.classList.toggle("hidden", !errors.some((e) => e.line));
    if (dlg && !dlg.open) dlg.showModal();
  }

  export function bindValidateDialog() {
    const dlg = () => document.getElementById("dialog-validate") as HTMLDialogElement | null;
    document.getElementById("validate-close")?.addEventListener("click", () => dlg()?.close());
    document.getElementById("validate-save-anyway")?.addEventListener("click", async () => {
      const p = S.pendingValidate;
      dlg()?.close();
      if (p) await writeActiveFileContent(p.path, p.content);
    });
    document.getElementById("validate-goto")?.addEventListener("click", () => {
      const line = S.pendingValidate?.errors.find((e) => e.line)?.line;
      dlg()?.close();
      if (line) getEditorApi()?.gotoLine(line);
    });
    document.getElementById("validate-fix-ai")?.addEventListener("click", () => {
      const p = S.pendingValidate;
      dlg()?.close();
      if (!p) return;
      const errLines = p.errors.map((e) => `- ${e.line ? fmt(t("seeds.lineLabel", "línea {line}: "), { line: e.line }) : ""}${e.message}`).join("\n");
      const snippet = p.content.length > 8000 ? p.content.slice(0, 8000) + "\n" + t("seeds.truncated", "…(truncado)") : p.content;
      const prompt = fmt(t("seeds.fixValidationPrompt", "Corrige el siguiente archivo \"{path}\" que falla la validación ({validator}):\n\n{errors}\n\nContenido actual:\n```\n{content}\n```"), { path: p.path, validator: p.validator, errors: errLines, content: snippet });
      requestAssistant({
        kind: "prompt",
        prompt,
        submit: "auto",
        conversation: "new",
        origin: { module: "files", action: "validateFix" },
      });
    });
  }

  export function getTab(path: string) {
    return S.openTabs.find((tab) => tab.path === path);
  }

  /** The single active preview tab, if any (VS Code allows at most one). */
  export function getPreviewTab() {
    return S.openTabs.find((tab) => tab.preview) ?? null;
  }

  /** Pin a preview tab as permanent (drops the preview flag) and re-render the
   *  tab-bar so the italic styling clears. No-op for permanent/missing tabs.
   *  Used by the promotion triggers: tree double-click, edit-makes-dirty, and
   *  double-click on the tab itself. */
  export function promoteTabToPermanent(path: string) {
    const tab = getTab(path);
    if (tab?.preview) {
      tab.preview = false;
      renderTabs();
    }
  }

  export function getActiveTab() {
    return getTab(S.activeTabPath) ?? null;
  }

  export function updateTabDirty(tab: { content: string; originalContent: string; dirty: boolean }) {
    tab.dirty = tab.content !== tab.originalContent;
  }

  // ── Open files quick-access (toolbar button + modal) ───────
  /** Reflect the open-files count on the toolbar button: enabled only when at
   *  least one file is open, greyed-out/non-clickable otherwise. Gating is done
   *  with a <body> class + CSS (see ensureFilesPermStyle) so it survives React
   *  re-renders of the toolbar, mirroring the perm-gating approach. */
  export function updateOpenFilesButton() {
    const count = S.openTabs.length;
    document.body.classList.toggle("files-has-open", count > 0);
    const btn = document.getElementById("btn-open-files");
    if (btn) btn.setAttribute("aria-disabled", count > 0 ? "false" : "true");
    const badge = document.getElementById("open-files-count");
    if (badge) {
      badge.textContent = String(count);
      badge.classList.toggle("hidden", count === 0);
    }
  }

  export function renderTabs() {
    updateOpenFilesButton();
    const tabsEl = document.getElementById("file-tabs");
    if (!tabsEl) return;

    if (S.openTabs.length === 0) {
      tabsEl.innerHTML = `<div class="px-2 py-1 text-xs text-muted-foreground">${t("labels.noOpenFiles", "No hay archivos abiertos")}</div>`;
      return;
    }

    tabsEl.innerHTML = S.openTabs
      .map((tab) => {
        const active = tab.path === S.activeTabPath;
        const dirtyDot = tab.dirty ? `<span class="ml-2 inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden="true"></span>` : "";
        const baseBorder = active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground";
        return `
          <div class="group flex shrink-0 items-stretch overflow-hidden rounded-lg border text-xs transition-colors ${baseBorder}" data-tab-path="${escapeHtml(tab.path)}">
            <button
              type="button"
              class="flex min-w-0 items-center gap-1.5 px-3 py-1.5"
              data-tab-action="activate"
              data-tab-path="${escapeHtml(tab.path)}"
              title="${escapeHtml(tab.path)}"
              aria-current="${active ? "true" : "false"}"
            >
              <span class="max-w-44 truncate font-medium ${tab.preview ? "italic" : ""}">${escapeHtml(tab.name)}</span>
              ${dirtyDot}
            </button>
            <button
              type="button"
              class="border-l border-inherit px-2 py-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              data-tab-action="close"
              data-tab-path="${escapeHtml(tab.path)}"
              aria-label="${escapeAttr(fmt(t("labels.closeTabAria", "Cerrar {name}"), { name: tab.name }))}"
              title="${escapeAttr(t("actions.close", "Cerrar"))}"
            >
              <i class="ti ti-x text-[11px]"></i>
            </button>
          </div>`;
      })
      .join("");
  }

  export function syncToolbarState() {
    const active = getActiveTab();
    // Keep the in-file find bar's availability + highlights in sync with the
    // active tab (set by editor-find.ts; no-op before it binds). Decoupled via
    // window to avoid an import cycle editor ↔ editor-find.
    (window as any).__lxpFilesFindRefresh?.();
    // Same for the AI editor bar: enable/disable + re-render the per-file
    // conversation panel as the active tab changes.
    (window as any).__lxpFilesAiRefresh?.();
    if (S.saveBtn) S.saveBtn.disabled = !active;
    if (S.diffBtn) {
      const dirty = Boolean(active?.dirty);
      S.diffBtn.classList.toggle("hidden", !dirty);
      S.diffBtn.setAttribute("aria-pressed", String(Boolean(active && !document.getElementById("file-diff-panel")?.classList.contains("hidden"))));
    }
  }

  export function syncEditorToActiveTab() {
    const active = getActiveTab();
    const editorApi = getEditorApi();
    if (!active || !editorApi) return;
    S.editingPath = active.path;
    editorApi.openFile({
      path: active.path,
      name: active.name,
      content: active.content,
      originalContent: active.originalContent,
    });
    const filename = document.getElementById("editor-filename");
    if (filename) filename.textContent = active.name;
    editorApi.layout();
  }

  export function commitActiveTabFromEditor() {
    const active = getActiveTab();
    const editorApi = getEditorApi();
    if (!active || !editorApi) return;
    active.content = editorApi.getValue();
    updateTabDirty(active);
  }

  export function setActiveTab(path: string) {
    if (!path) return;
    commitActiveTabFromEditor();
    S.activeTabPath = path;
    S.editingPath = path;
    syncEditorToActiveTab();
    renderTabs();
    syncToolbarState();
  }

  export async function closeTab(path: string) {
    const tab = getTab(path);
    if (!tab) return;

    commitActiveTabFromEditor();

    if (tab.dirty) {
      const confirmed = await openConfirm(fmt(t("confirm.closeTabUnsaved", "\"{name}\" tiene cambios sin guardar. ¿Cerrar de todas formas?"), { name: tab.name }), {
        title: t("confirm.closeTabTitle", "Cerrar pestaña"),
        variant: "danger", // openConfirm: solo default|danger
      });
      if (!confirmed) return;
    }

    const index = S.openTabs.findIndex((item) => item.path === path);
    S.openTabs = S.openTabs.filter((item) => item.path !== path);

    if (S.activeTabPath === path) {
      const nextTab = S.openTabs[index] ?? S.openTabs[index - 1] ?? null;
      if (nextTab) {
        setActiveTab(nextTab.path);
        return;
      } else {
        S.activeTabPath = "";
        S.editingPath = "";
        getEditorApi()?.closeFile();
        const filename = document.getElementById("editor-filename");
        if (filename) filename.textContent = t("labels.noFile", "Sin archivo");
        // No tabs left → nothing to edit; hide the editor view.
        hideEditorView();
      }
    }

    renderTabs();
    syncToolbarState();
  }

  export function openOrActivateTab(path: string, name: string, content: string, opts?: { preview?: boolean }) {
    // Show the editor view and mount Monaco before we push content into it.
    void showEditorView();
    const preview = Boolean(opts?.preview);
    const existing = getTab(path);
    if (existing) {
      existing.name = name || existing.name;
      // A permanent open of an already-preview tab pins it (double-click / table).
      if (!preview && existing.preview) existing.preview = false;
      S.activeTabPath = path;
      S.editingPath = path;
      syncEditorToActiveTab();
      renderTabs();
      syncToolbarState();
      return;
    }

    commitActiveTabFromEditor();
    // Preview open: REUSE the existing (non-dirty) preview slot so a single
    // click never stacks tabs — it swaps the file shown in that one preview
    // tab. A dirty preview was already promoted (edit ⇒ pin), so it's kept.
    if (preview) {
      const slot = getPreviewTab();
      if (slot && !slot.dirty) {
        slot.path = path;
        slot.name = name;
        slot.content = content;
        slot.originalContent = content;
        slot.dirty = false;
        slot.preview = true;
        S.activeTabPath = path;
        S.editingPath = path;
        syncEditorToActiveTab();
        renderTabs();
        syncToolbarState();
        return;
      }
    }
    S.openTabs.push({
      path,
      name,
      content,
      originalContent: content,
      dirty: false,
      preview,
    });
    S.activeTabPath = path;
    S.editingPath = path;
    syncEditorToActiveTab();
    renderTabs();
    syncToolbarState();
  }

  (window as any).handleEdit = async (path: string, name: string, opts?: { preview?: boolean }) => {
    const preview = Boolean(opts?.preview);
    const existing = getTab(path);
    if (existing) {
      void showEditorView();
      // Already open (preview or permanent): just activate. A permanent request
      // (double-click / table) also pins a previously-preview tab.
      if (!preview && existing.preview) existing.preview = false;
      setActiveTab(path);
      return;
    }
    const res = await api.get<any>("/api/files/read", { params: { path } });
    if (!res.ok) { showToast(t("toasts.cannotReadFile", "No se puede leer el archivo (¿binario?)"), false); return; }
    const content = typeof res.data === "string" ? res.data : (res.data as any)?.content ?? "";
    openOrActivateTab(path, name, content, { preview });
  };

  // ── Delete ─────────────────────────────────────────────────
  (window as any).handleDelete = async (path: string, name: string, isDir: boolean) => {
    const dialog = document.getElementById("confirm-modal-wrapper") as HTMLDialogElement | null;
    const titleEl = document.getElementById("confirm-modal-title");
    const msgEl = document.getElementById("confirm-modal-message");
    const okBtn = document.getElementById("confirm-modal-ok") as HTMLButtonElement | null;
    const cancelBtn = document.getElementById("confirm-modal-cancel") as HTMLButtonElement | null;
    const closeBtn = document.getElementById("confirm-modal-close") as HTMLButtonElement | null;
    const iconWrap = document.getElementById("confirm-modal-icon-wrap");
    const iconEl = document.getElementById("confirm-modal-icon");

    if (!dialog || !okBtn || !cancelBtn) {
      if (!window.confirm(fmt(t("confirm.deleteNative", "¿Eliminar \"{name}\"?"), { name }))) return;
    } else {
      if (titleEl) titleEl.textContent = fmt(t("confirm.deleteTitle", "Eliminar {kind}"), { kind: isDir ? t("labels.folder", "carpeta") : t("labels.file", "archivo") });
      if (msgEl) msgEl.textContent = fmt(t("confirm.deleteBody", "¿Eliminar {kind} \"{name}\"?{extra}"), { kind: isDir ? t("labels.theFolder", "la carpeta") : t("labels.theFile", "el archivo"), name, extra: isDir ? ` ${t("confirm.deleteFolderExtra", "Se eliminará todo su contenido.")}` : "" });
      if (okBtn) {
        okBtn.className = "flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors";
        okBtn.textContent = t("actions.yesDelete", "Sí, eliminar");
      }
      if (iconWrap) iconWrap.className = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10";
      if (iconEl) iconEl.className = "ti ti-alert-triangle text-destructive text-base";

      dialog.showModal();

      const confirmed = await new Promise<boolean>((resolve) => {
        const done = (val: boolean) => {
          okBtn.removeEventListener("click", onOk);
          cancelBtn.removeEventListener("click", onCancel);
          closeBtn?.removeEventListener("click", onCancel);
          dialog.close();
          resolve(val);
        };
        const onOk = () => done(true);
        const onCancel = () => done(false);
        okBtn.addEventListener("click", onOk);
        cancelBtn.addEventListener("click", onCancel);
        closeBtn?.addEventListener("click", onCancel);
      });

      if (!confirmed) return;
    }

    // Optimistic delete: drop the row from the list immediately and show a
    // spinner; the real removal runs in the background so the UI never blocks
    // on a slow `rm -rf` (large folders). Roll back the row if it fails.
    const prevEntries = S.currentEntries;
    const updateCount = () => setStatus(fmt(S.currentEntries.length === 1 ? t("status.itemCountOne", "{n} elemento") : t("status.itemCountMany", "{n} elementos"), { n: S.currentEntries.length }));
    S.currentEntries = S.currentEntries.filter((e) => rowPathFor(e) !== path);
    selected.delete(path);
    renderFiles(S.currentEntries);
    updateCount();
    const closeSpinner = showLoadingToast(fmt(t("toasts.deletingItem", "Eliminando \"{name}\"…"), { name }));

    api.delete("/api/files", { path, recursive: isDir })
      .then((res) => {
        closeSpinner();
        if (res.ok) {
          showToast(t("toasts.deleted", "Eliminado"));
          // Resync the tree folder that held the deleted item (may be another
          // expanded folder, not the current dir, when deleted from the tree).
          (window as any).__lxpFilesTreeRefresh?.([getParentPath(path)]);
          return;
        }
        S.currentEntries = prevEntries; renderFiles(S.currentEntries); updateCount();
        showToast(res.error ?? t("toasts.deleteError2", "Error al eliminar"), false);
      })
      .catch(() => {
        closeSpinner();
        S.currentEntries = prevEntries; renderFiles(S.currentEntries); updateCount();
        showToast(t("toasts.deleteError2", "Error al eliminar"), false);
      });
  };

  (window as any).openProject = (path: string) => {
    setViewMode("list");
    (window as any).navigate(path);
  };

  // Global entry point for the sidebar toggle (PanelLayout) and the configurable
  // shortcut. Idempotent; a no-op if the files page hasn't loaded this module.
  (window as any).toggleEditor = () => void toggleEditor();
