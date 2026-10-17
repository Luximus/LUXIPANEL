// Files page — navigation submodule (code-move from index-script1.ts; no behavior change).
import { updateGitButtonState } from "./git";
import { fmt, t } from "./i18n";
import { cancelDirectoryListing, clearSelection, loadDirectoryListing, setViewMode } from "./listing";
import { emitFilesPathChanged, getActiveFilesManager, persistFilesManagers, renderFilesManagerTabs } from "./manager-tabs";
import { escapeAttr, escapeHtml } from "./paths";
import { ensureFileAccessPolicy, filesCan } from "./perm-gating";
import { exitContentResults } from "./search-replace";
import { S, dirSizeKnown, navHistory, selected } from "./state";
import { updateBackButton } from "./target-scope";
import { setRouteLoading, setStatus, showToast } from "./toast";
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";


  // ── Breadcrumb ─────────────────────────────────────────────
  export function renderBreadcrumb(path: string) {
    const el = document.getElementById("breadcrumb");
    if (!el) return;
    const parts = path.split("/").filter(Boolean);
    // Restricted users can't reach "/"; point the root crumb at their base.
    const rootTarget = S.filesAllowAll ? "/" : (S.filesDefaultBase || "/");
    const items = [
      `<button type="button" data-breadcrumb-path="${escapeAttr(rootTarget)}" class="shrink-0 text-xs ${parts.length ? "text-muted-foreground hover:text-foreground" : "font-semibold text-foreground"}" ${parts.length ? "" : 'aria-current="location"'}>${escapeHtml(t("labels.root", "raíz"))}</button>`,
      ...parts.map((p, i) => {
        const href = "/" + parts.slice(0, i + 1).join("/");
        const current = i === parts.length - 1;
        return `<i class="ti ti-chevron-right shrink-0 text-xs text-muted-foreground/50" aria-hidden="true"></i><button type="button" data-breadcrumb-path="${escapeAttr(href)}" class="shrink-0 text-xs ${current ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}" ${current ? 'aria-current="location"' : ""}>${escapeHtml(p)}</button>`;
      }),
    ];
    el.innerHTML = items.join("");
  }

  // ── Editable path bar state + autocomplete ──────────────────
  export let suggestItems: Array<{ name: string; path: string; visits: number }> = [];
  export let suggestSeq = 0;

  /** Normalize a typed path: ensure leading slash, collapse //, drop trailing /. */
  export function normalizePathInput(raw: string): string {
    if (!raw) return "";
    let p = raw.trim();
    if (!p.startsWith("/")) p = "/" + p;
    p = p.replace(/\/{2,}/g, "/");
    if (p.length > 1) p = p.replace(/\/+$/, "");
    return p || "/";
  }

  export function enterPathEdit() {
    if (!filesCan("files.editpath")) return; // gated: editing the path bar
    const input = document.getElementById("path-edit-input") as HTMLInputElement | null;
    const bc = document.getElementById("breadcrumb");
    if (!input || !bc) return;
    input.value = S.currentPath || "/";
    bc.classList.add("hidden");
    input.classList.remove("hidden");
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    void fetchPathSuggest(input.value);
  }

  export function exitPathEdit() {
    const input = document.getElementById("path-edit-input");
    const bc = document.getElementById("breadcrumb");
    hidePathSuggest();
    input?.classList.add("hidden");
    bc?.classList.remove("hidden");
  }

  export function hidePathSuggest() {
    suggestItems = [];
    S.suggestActive = -1;
    const box = document.getElementById("path-suggest-list");
    if (box) { box.classList.add("hidden"); box.innerHTML = ""; }
  }

  export function renderPathSuggest() {
    const box = document.getElementById("path-suggest-list");
    if (!box) return;
    if (suggestItems.length === 0) { hidePathSuggest(); return; }
    box.innerHTML = suggestItems.map((s, i) => {
      const active = i === S.suggestActive;
      const badge = s.visits > 0
        ? `<span class="ml-auto flex items-center gap-1 text-[10px] ${i === 0 ? "text-amber-500" : "text-muted-foreground"}">${i === 0 ? '<i class="ti ti-star-filled"></i>' : ""}${s.visits}</span>`
        : "";
      return `<button type="button" role="option" aria-selected="${active}" data-suggest-path="${escapeHtml(s.path)}"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60"}">
        <i class="ti ti-folder text-amber-500/80"></i><span class="truncate">${escapeHtml(s.name)}</span>${badge}</button>`;
    }).join("");
    box.classList.remove("hidden");
  }

  export async function fetchPathSuggest(value: string) {
    const seq = ++suggestSeq;
    if (!value || !value.includes("/")) { hidePathSuggest(); return; }
    try {
      const res: any = await api.get("/api/files/path-suggest", { params: { path: value } });
      if (seq !== suggestSeq) return; // a newer keystroke superseded this one
      if (res?.ok && Array.isArray(res.data?.suggestions)) {
        suggestItems = res.data.suggestions;
        S.suggestActive = suggestItems.length ? 0 : -1;
        renderPathSuggest();
      } else {
        hidePathSuggest();
      }
    } catch {
      hidePathSuggest();
    }
  }

  export function completeWithSuggestion(idx: number) {
    const item = suggestItems[idx];
    const input = document.getElementById("path-edit-input") as HTMLInputElement | null;
    if (!item || !input) return;
    input.value = item.path + "/";
    input.focus();
    void fetchPathSuggest(input.value);
  }

  let navigationEpoch = 0;
  (window as any).navigate = async (path: string, opts: { skipHistory?: boolean } = {}) => {
    const epoch = ++navigationEpoch;
    const target = S.activeTargetScope, manager = S.activeFilesManagerId;
    cancelDirectoryListing();
    await ensureFileAccessPolicy();
    if (epoch !== navigationEpoch || target !== S.activeTargetScope || manager !== S.activeFilesManagerId) return;
    // Navigating (breadcrumb, editable path bar, openProject…) leaves the
    // projects view back to the file list — the only toolbar exit while the
    // view buttons are hidden in projects mode.
    if (S.viewMode === "projects") setViewMode("list");
    // Navigating leaves the content-search results view back to the listing.
    if (S.contentResultsActive) exitContentResults();
    if (!opts.skipHistory && S.currentPath && S.currentPath !== path) {
      navHistory.push(S.currentPath);
    }
    updateBackButton();
    S.currentPath = path;
    S.isSearchMode = false;
    // Drop folder sizes from the previous directory; cancel in-flight hydration.
    dirSizeKnown.clear();
    S.dirSizeNav++;
    clearSelection();
    setStatus(fmt(t("status.loadingPath", "Cargando {path}..."), { path }));
    setRouteLoading(true);
    renderBreadcrumb(path);

    let res: any;
    try {
      // Folder sizes are filled separately via hydrateDirSizes() (cache +
      // lazy du), so we omit withDirSize and let the listing use its Redis cache.
      res = await loadDirectoryListing();
    } catch {
      showToast(t("toasts.routeLoadNetworkError", "Error de red al cargar ruta"), false);
      setStatus(t("status.loadError", "Error al cargar"));
      setRouteLoading(false);
      return;
    }
    if (epoch !== navigationEpoch || target !== S.activeTargetScope || manager !== S.activeFilesManagerId) return;
    if (res?.code === "STALE_FILES_LIST") { setRouteLoading(false); return; }
    if (!res.ok) {
      let errorMsg = res.error ?? t("toasts.listError2", "No se pudo listar");
      // Path denied (outside the group's allowed paths / no permission): instead
      // of a dead-end error, bounce to the user's default base once.
      const denied =
        res.status === 403 ||
        /access denied|fuera de los directorios|outside allowed|Missing permission|Forbidden/i.test(errorMsg);
      if (denied && S.filesDefaultBase && path !== S.filesDefaultBase) {
        showToast(fmt(t("toasts.noAccessOpening", "Sin acceso a \"{path}\". Abriendo {base}."), { path, base: S.filesDefaultBase }), false);
        setRouteLoading(false);
        await (window as any).navigate(S.filesDefaultBase, { skipHistory: true });
        return;
      }
      // Path missing on THIS server (typically a remembered folder from another
      // target, e.g. the panel host's last dir after a server switch): fall back
      // to the default base silently — a 404 here is not a user error.
      const fallbackBase = S.filesAllowAll ? "/" : (S.filesDefaultBase || "/");
      if (res.status === 404 && path !== fallbackBase) {
        setRouteLoading(false);
        await (window as any).navigate(fallbackBase, { skipHistory: true });
        return;
      }
      if (errorMsg.includes("outside allowed directories")) {
        errorMsg = fmt(t("toasts.outsideAllowed", "No se puede acceder: \"{path}\" está fuera de los directorios permitidos"), { path });
      }
      showToast(fmt(t("toasts.errorPrefix", "Error: {message}"), { message: errorMsg }), false);
      setStatus(t("status.loadError", "Error al cargar"));
      setRouteLoading(false);
      return;
    }

    // Enable/disable the Git button for this directory (cached, non-blocking).
    void updateGitButtonState(path);
    const activeManager = getActiveFilesManager();
    if (activeManager) {
      activeManager.path = path;
      persistFilesManagers();
      renderFilesManagerTabs();
    }
    emitFilesPathChanged(path, "files");
    setRouteLoading(false);
    // Record the visit (fire-and-forget) to feed path-bar autocomplete ranking.
    void api.post("/api/files/visit", { path }).catch(() => {});
  };
