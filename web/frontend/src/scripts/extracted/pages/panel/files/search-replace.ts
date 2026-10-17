// Files page — search-replace submodule (code-move from index-script1.ts; no behavior change).
import { getEditorApi } from "./editor";
import { fmt, t } from "./i18n";
import { clearSelection, renderFiles, setViewMode } from "./listing";
import { escapeHtml, normalizeSearch } from "./paths";
import { refreshCurrentView } from "./projects";
import { S } from "./state";
import { setStatus, showToast } from "./toast";
import { clearTreeSearch, scheduleTreeSearch } from "./tree";
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";


  // ── Content search ("Buscar en archivos", #9) ──────────────
  export type ContentSearchData = {
    files: Array<{ path: string; name: string; matches: Array<{ line: number; text: string }> }>;
    totalMatches: number;
    truncated: boolean;
  };

  // ── Search-box mode + case toggles ─────────────────────────
  /** Inject (once) the CSS that hides the case + replace buttons unless we're in
   *  text-in-files mode. Driven by a <body> class (NOT per-element classes) so
   *  it survives React re-renders of FilesWorkspace — same rationale as the
   *  permission gating. The files.write gate on #btn-search-replace uses
   *  `display:none !important`, so it still wins when the user can't replace. */
  export function ensureSearchModeStyle(): void {
    if (document.getElementById("lxp-search-mode-style")) return;
    const st = document.createElement("style");
    st.id = "lxp-search-mode-style";
    st.textContent =
      "#btn-search-case,#btn-search-replace{display:none;}" +
      "body.lxp-search-content #btn-search-case,body.lxp-search-content #btn-search-replace{display:inline-flex;}";
    document.head.appendChild(st);
  }

  /** Reflect the active search mode in the input icon/placeholder, the toggle
   *  button highlight, and the visibility of the case + replace buttons. */
  export function updateSearchModeUI() {
    ensureSearchModeStyle();
    const input = document.getElementById("files-search") as HTMLInputElement | null;
    const icon = document.getElementById("files-search-icon");
    const modeBtn = document.getElementById("btn-search-mode");
    const content = S.searchMode === "content";
    document.body.classList.toggle("lxp-search-content", content);
    if (input) input.placeholder = content ? t("search.placeholderContent", "Buscar texto en los archivos…") : t("search.placeholderName", "Buscar carpetas y archivos");
    if (icon) icon.className = `ti ${content ? "ti-file-search" : "ti-search"} pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm`;
    if (modeBtn) {
      modeBtn.setAttribute("aria-pressed", content ? "true" : "false");
      modeBtn.setAttribute("title", content ? t("search.toggleToName", "Cambiar a búsqueda por nombre") : t("search.toggleToContent", "Cambiar a búsqueda de texto en archivos"));
      modeBtn.classList.toggle("bg-accent", content);
      modeBtn.classList.toggle("text-foreground", content);
      modeBtn.classList.toggle("text-muted-foreground", !content);
    }
  }

  export function toggleSearchMode() {
    S.searchMode = S.searchMode === "name" ? "content" : "name";
    updateSearchModeUI();
    const input = document.getElementById("files-search") as HTMLInputElement | null;
    const q = input?.value ?? "";
    if (S.searchMode === "name") {
      // Leaving content search: drop its results and re-apply the name filter
      // to both the right listing and the left tree.
      exitContentResults();
      S.searchQuery = normalizeSearch(q);
      if (S.searchQuery) scheduleTreeSearch(S.searchQuery); else clearTreeSearch();
      if (S.searchQuery && S.currentPath) void runNameSearch(S.searchQuery);
      else {
        S.isSearchMode = false;
        if (S.currentPath) void (window as any).navigate(S.currentPath, { skipHistory: true });
        else renderFiles(S.currentEntries);
      }
    } else {
      // Entering content search: the tree search only applies in name mode.
      clearTreeSearch();
      if (q.trim()) void runContentSearch();
      else { showContentResults(); }
    }
    input?.focus();
  }

  export function toggleSearchCase() {
    S.searchCaseSensitive = !S.searchCaseSensitive;
    const btn = document.getElementById("btn-search-case");
    if (btn) {
      btn.setAttribute("aria-pressed", S.searchCaseSensitive ? "true" : "false");
      btn.classList.toggle("bg-accent", S.searchCaseSensitive);
      btn.classList.toggle("text-foreground", S.searchCaseSensitive);
      btn.classList.toggle("text-muted-foreground", !S.searchCaseSensitive);
    }
    // Re-run content search so the toggle takes effect immediately.
    if (S.searchMode === "content" && (document.getElementById("files-search") as HTMLInputElement | null)?.value.trim()) {
      void runContentSearch();
    }
  }

  /** Reveal the content-search results view, hiding the list/grid. */
  export function showContentResults() {
    S.contentResultsActive = true;
    document.getElementById("view-list")?.classList.add("hidden");
    document.getElementById("view-grid")?.classList.add("hidden");
    const view = document.getElementById("view-content-search");
    view?.classList.remove("hidden");
    view?.classList.add("flex");
    const scope = document.getElementById("content-search-scope");
    if (scope) scope.textContent = S.currentPath || "—";
  }

  /** Hide the content-search results view and restore the active file view. */
  export function exitContentResults() {
    if (!S.contentResultsActive) return;
    S.contentResultsActive = false;
    const view = document.getElementById("view-content-search");
    view?.classList.add("hidden");
    view?.classList.remove("flex");
    if (S.viewMode !== "projects") setViewMode(S.viewMode);
  }

  /** Recursive name search (the old live "Buscar carpetas y archivos"). */
  export async function runNameSearch(query: string) {
    if (!S.currentPath) { renderFiles(S.currentEntries); return; }
    const path = S.currentPath, target = S.activeTargetScope, manager = S.activeFilesManagerId, version = S.listingVersion;
    setStatus(fmt(t("status.searchingFor", "Buscando \"{query}\" en subcarpetas..."), { query }));
    const res = await api.get<any>("/api/files/search", { params: { path: S.currentPath, q: query } });
    if (version !== S.listingVersion || path !== S.currentPath || target !== S.activeTargetScope || manager !== S.activeFilesManagerId || query !== S.searchQuery) return;
    if (!res.ok) {
      showToast(res.error ?? t("toasts.searchError", "Error al buscar"), false);
      setStatus(t("status.searchError", "Error al buscar"));
      return;
    }
    const payload = res.data as any;
    const hits = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
    S.isSearchMode = true;
    clearSelection();
    renderFiles(hits);
    setStatus(fmt(t("status.searchResults", "{n} resultado(s) para \"{query}\""), { n: hits.length, query }));
  }

  export async function runContentSearch() {
    const q = (document.getElementById("files-search") as HTMLInputElement | null)?.value ?? "";
    if (!S.currentPath) { showToast(t("toasts.openFolderFirst", "Abre una carpeta primero"), false); return; }
    if (!q.trim()) { showToast(t("toasts.enterSearchText", "Escribe el texto a buscar"), false); return; }
    showContentResults();
    const results = document.getElementById("content-search-results");
    if (!results) return;
    results.innerHTML = `<div class="px-4 py-6 text-center text-sm text-muted-foreground">${fmt(t("status.searchingIn", "Buscando en {path}…"), { path: escapeHtml(S.currentPath) })}</div>`;
    const params: Record<string, string> = { path: S.currentPath, mode: "text", q };
    if (S.searchCaseSensitive) params["caseSensitive"] = "true";
    const res: any = await api.get("/api/files/grep", { params });
    if (!res.ok) {
      results.innerHTML = `<div class="px-4 py-6 text-center text-sm text-destructive">${escapeHtml(res.error || t("toasts.searchError", "Error al buscar"))}</div>`;
      return;
    }
    renderContentResults(res.data as ContentSearchData);
  }

  export function renderContentResults(data: ContentSearchData) {
    const results = document.getElementById("content-search-results");
    if (!results) return;
    const files = Array.isArray(data?.files) ? data.files : [];
    if (files.length === 0) {
      results.innerHTML = `<div class="px-4 py-6 text-center text-sm text-muted-foreground">${t("empty.noSearchMatches", "Sin coincidencias.")}</div>`;
      return;
    }
    const header = `<div class="px-2 pb-2 pt-1 text-xs text-muted-foreground">${fmt(t("labels.searchMatchCount", "{total} coincidencia(s) en {files} archivo(s)"), { total: data.totalMatches, files: files.length })}${data.truncated ? " · " + t("labels.searchTruncated", "resultados recortados") : ""}</div>`;
    const blocks = files
      .map((f) => {
        const rows = f.matches
          .map(
            (m) => `
            <button type="button" data-cs-path="${escapeHtml(f.path)}" data-cs-line="${m.line}"
              class="flex w-full items-start gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-accent">
              <span class="shrink-0 font-mono text-muted-foreground">${m.line}</span>
              <span class="min-w-0 flex-1 truncate font-mono text-foreground">${escapeHtml(m.text.trim())}</span>
            </button>`,
          )
          .join("");
        return `
          <div class="border-b border-border py-2 last:border-0">
            <div class="flex items-center gap-2 px-2 py-1">
              <i class="ti ti-file-text text-sm text-muted-foreground"></i>
              <span class="truncate text-sm font-medium" title="${escapeHtml(f.path)}">${escapeHtml(f.name)}</span>
              <span class="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">${f.matches.length}</span>
            </div>
            <div class="truncate px-2 text-[11px] text-muted-foreground" title="${escapeHtml(f.path)}">${escapeHtml(f.path)}</div>
            <div class="mt-1 space-y-0.5">${rows}</div>
          </div>`;
      })
      .join("");
    results.innerHTML = header + blocks;
  }

  export async function onContentResultClick(ev: Event) {
    const target = (ev.target as HTMLElement | null)?.closest("[data-cs-path]") as HTMLElement | null;
    if (!target) return;
    const path = target.getAttribute("data-cs-path") || "";
    const line = Number(target.getAttribute("data-cs-line") || "1");
    if (!path) return;
    const name = path.split("/").pop() || path;
    await (window as any).handleEdit(path, name);
    // Jump to the matched line once the editor has the file loaded.
    setTimeout(() => getEditorApi()?.gotoLine(line), 220);
  }

  // ── Mass replace ("Reemplazo masivo", #10) ─────────────────
  export type ReplacePreviewData = {
    files: Array<{ path: string; name: string; replacements: Array<{ line: number; before: string; after: string }> }>;
    totalReplacements: number;
    truncated: boolean;
  };
  export let replacePreviewedOk = false;

  export function openReplaceDialog(prefill?: { search?: string; mode?: "text" | "regex"; caseSensitive?: boolean }) {
    const dlg = document.getElementById("dialog-replace") as HTMLDialogElement | null;
    const scope = document.getElementById("replace-scope");
    if (scope) scope.textContent = S.currentPath || "—";
    const searchEl = document.getElementById("replace-search") as HTMLInputElement | null;
    const modeEl = document.getElementById("replace-mode") as HTMLSelectElement | null;
    const caseEl = document.getElementById("replace-case") as HTMLInputElement | null;
    if (searchEl && prefill?.search !== undefined) searchEl.value = prefill.search;
    if (modeEl && prefill?.mode) modeEl.value = prefill.mode;
    if (caseEl && prefill?.caseSensitive !== undefined) caseEl.checked = prefill.caseSensitive;
    const preview = document.getElementById("replace-preview");
    if (preview) preview.innerHTML = `<div class="px-4 py-6 text-center text-sm text-muted-foreground">${escapeHtml(t("empty.defineSearchReplace", "Define la búsqueda y el reemplazo, luego pulsa Vista previa."))}</div>`;
    document.getElementById("replace-footer")?.classList.add("hidden");
    replacePreviewedOk = false;
    if (dlg && !dlg.open) dlg.showModal();
    setTimeout(() => (document.getElementById("replace-with") as HTMLInputElement | null)?.focus(), 40);
  }

  export function readReplaceOpts() {
    return {
      search: (document.getElementById("replace-search") as HTMLInputElement | null)?.value ?? "",
      replacement: (document.getElementById("replace-with") as HTMLInputElement | null)?.value ?? "",
      mode: ((document.getElementById("replace-mode") as HTMLSelectElement | null)?.value === "regex" ? "regex" : "text") as "text" | "regex",
      caseSensitive: (document.getElementById("replace-case") as HTMLInputElement | null)?.checked ?? false,
    };
  }

  export async function runReplacePreview() {
    const preview = document.getElementById("replace-preview");
    if (!preview) return;
    if (!S.currentPath) { showToast(t("toasts.openFolderFirst", "Abre una carpeta primero"), false); return; }
    const opts = readReplaceOpts();
    if (!opts.search.trim()) { showToast(t("toasts.enterSearchText", "Escribe el texto a buscar"), false); return; }
    document.getElementById("replace-footer")?.classList.add("hidden");
    replacePreviewedOk = false;
    preview.innerHTML = `<div class="px-4 py-6 text-center text-sm text-muted-foreground">${t("status.calculatingPreview", "Calculando vista previa…")}</div>`;
    const res: any = await api.post("/api/files/replace/preview", { path: S.currentPath, ...opts });
    if (!res.ok) {
      preview.innerHTML = `<div class="px-4 py-6 text-center text-sm text-destructive">${escapeHtml(res.error || t("toasts.previewError", "Error en la vista previa"))}</div>`;
      return;
    }
    renderReplacePreview(res.data as ReplacePreviewData);
  }

  export function renderReplacePreview(data: ReplacePreviewData) {
    const preview = document.getElementById("replace-preview");
    const footer = document.getElementById("replace-footer");
    const summary = document.getElementById("replace-summary");
    if (!preview) return;
    const files = Array.isArray(data?.files) ? data.files : [];
    if (files.length === 0) {
      preview.innerHTML = `<div class="px-4 py-6 text-center text-sm text-muted-foreground">${t("empty.noReplaceMatches", "Sin coincidencias para reemplazar.")}</div>`;
      footer?.classList.add("hidden");
      replacePreviewedOk = false;
      return;
    }
    const blocks = files
      .map((f) => {
        const rows = f.replacements
          .map(
            (r) => `
            <div class="rounded-md px-2 py-1 text-xs">
              <div class="flex items-start gap-2"><span class="shrink-0 font-mono text-muted-foreground">${r.line}</span>
                <span class="min-w-0 flex-1 truncate font-mono text-destructive line-through" title="${escapeHtml(r.before)}">${escapeHtml(r.before.trim())}</span></div>
              <div class="flex items-start gap-2"><span class="shrink-0 font-mono text-transparent">${r.line}</span>
                <span class="min-w-0 flex-1 truncate font-mono text-emerald-600 dark:text-emerald-400" title="${escapeHtml(r.after)}">${escapeHtml(r.after.trim())}</span></div>
            </div>`,
          )
          .join("");
        return `
          <div class="border-b border-border py-2 last:border-0">
            <div class="flex items-center gap-2 px-2 py-1">
              <i class="ti ti-file-text text-sm text-muted-foreground"></i>
              <span class="truncate text-sm font-medium" title="${escapeHtml(f.path)}">${escapeHtml(f.name)}</span>
              <span class="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">${f.replacements.length}</span>
            </div>
            <div class="truncate px-2 text-[11px] text-muted-foreground" title="${escapeHtml(f.path)}">${escapeHtml(f.path)}</div>
            <div class="mt-1 space-y-1">${rows}</div>
          </div>`;
      })
      .join("");
    preview.innerHTML = blocks;
    if (summary) summary.textContent = fmt(t("labels.replaceCount", "{total} reemplazo(s) en {files} archivo(s)"), { total: data.totalReplacements, files: files.length }) + (data.truncated ? " · " + t("labels.listTruncated", "lista recortada") : "");
    footer?.classList.remove("hidden");
    replacePreviewedOk = true;
  }

  export async function applyReplace() {
    if (!replacePreviewedOk) { showToast(t("toasts.generatePreviewFirst", "Genera la vista previa primero"), false); return; }
    if (!S.currentPath) return;
    const opts = readReplaceOpts();
    if (!opts.search.trim()) return;
    const ok = await openConfirm(
      t("confirm.applyReplace", "¿Aplicar el reemplazo? Se respaldará cada archivo antes de modificarlo (recuperable desde Historial)."),
      { title: t("confirm.applyReplaceTitle", "Aplicar reemplazo"), variant: "danger" },
    );
    if (!ok) return;
    const res: any = await api.post("/api/files/replace/apply", { path: S.currentPath, ...opts });
    if (res.ok) {
      const d = res.data || {};
      showToast(fmt(t("toasts.replaceApplied", "{total} reemplazo(s) en {files} archivo(s)"), { total: d.totalReplacements ?? 0, files: d.filesChanged ?? 0 }));
      (document.getElementById("dialog-replace") as HTMLDialogElement | null)?.close();
      refreshCurrentView();
    } else {
      showToast(res.error || t("toasts.replaceError", "No se pudo aplicar el reemplazo"), false);
    }
  }
