// Files page — history-file-versions submodule (code-move from index-script1.ts; no behavior change).
import { getEditorApi, showEditorView } from "./editor";
import { fmt, t } from "./i18n";
import { escapeAttr, escapeHtml } from "./paths";
import { refreshCurrentView } from "./projects";
import { S, selected } from "./state";
import { showToast } from "./toast";
import { loadFavRoots } from "./tree";
import { api, resolvePanelApiPath } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { openDialog } from "/scripts/extracted/lib/dom.js";


  // ── Change history / "Modo cambios seguros" ────────────────
  export type SnapshotRow = {
    id: string;
    path: string;
    op: string;
    kind: "file" | "dir" | "absent" | "skipped";
    sizeBytes: number;
    capturedAt: string;
    note?: string;
  };
  // When set, the history dialog is scoped to a single path (e.g. opened from a
  // file's context menu). Empty = show all recent changes on this server.
  export let historyFilterPath = "";

  export function getHistoryOpLabel(op: string): string {
    const labels: Record<string, string> = {
      edit: t("historyOp.edit", "Edición"),
      delete: t("historyOp.delete", "Borrado"),
      move: t("historyOp.move", "Movido"),
      replace: t("historyOp.replace", "Reemplazo"),
      copy: t("historyOp.copy", "Copia"),
      chmod: t("historyOp.chmod", "Permisos"),
      restore: t("historyOp.restore", "Restauración"),
    };
    return labels[op] ?? op;
  }

  export function formatBytes(n: number): string {
    if (!n || n <= 0) return "—";
    const units = ["B", "KB", "MB", "GB"];
    let v = n;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
  }

  export function openHistoryDialog(forPath?: string) {
    historyFilterPath = forPath || "";
    const dlg = document.getElementById("dialog-history") as HTMLDialogElement | null;
    const subtitle = document.getElementById("history-subtitle");
    if (subtitle) subtitle.textContent = historyFilterPath || t("labels.allRecentChanges", "Todos los cambios recientes");
    if (dlg && !dlg.open) dlg.showModal();
    void loadSnapshots(historyFilterPath || undefined);
  }

  export async function loadSnapshots(forPath?: string) {
    const listEl = document.getElementById("history-list");
    if (!listEl) return;
    listEl.innerHTML = `<div class="px-4 py-8 text-center text-sm text-muted-foreground">${t("status.loading", "Cargando…")}</div>`;
    const res: any = await api.get("/api/files/snapshots", forPath ? { params: { path: forPath } } : undefined);
    if (!res.ok) {
      listEl.innerHTML = `<div class="px-4 py-8 text-center text-sm text-destructive">${escapeHtml(res.error || t("toasts.historyLoadError", "No se pudo cargar el historial"))}</div>`;
      return;
    }
    renderSnapshots(Array.isArray(res.data) ? (res.data as SnapshotRow[]) : []);
  }

  export let historySnaps: SnapshotRow[] = [];
  export let historyPage = 0;
  export const HISTORY_PAGE_SIZE = 6;

  export function renderSnapshots(snaps: SnapshotRow[]) {
    historySnaps = snaps;
    historyPage = 0;
    renderHistoryPage();
  }

  export function renderHistoryPage() {
    const listEl = document.getElementById("history-list");
    if (!listEl) return;
    const snaps = historySnaps;
    if (snaps.length === 0) {
      listEl.innerHTML = `<div class="px-4 py-8 text-center text-sm text-muted-foreground">${t("empty.noSnapshots", "Sin cambios respaldados todavía.")}</div>`;
      return;
    }
    const pageCount = Math.max(1, Math.ceil(snaps.length / HISTORY_PAGE_SIZE));
    if (historyPage > pageCount - 1) historyPage = pageCount - 1;
    if (historyPage < 0) historyPage = 0;
    const start = historyPage * HISTORY_PAGE_SIZE;
    const pageSnaps = snaps.slice(start, start + HISTORY_PAGE_SIZE);
    const rowsHtml = pageSnaps
      .map((s) => {
        const name = (s.path.replace(/\/+$/, "").split("/").pop()) || s.path;
        const opLabel = getHistoryOpLabel(s.op);
        const when = (() => { try { return new Date(s.capturedAt).toLocaleString(document.documentElement.lang || undefined); } catch { return s.capturedAt; } })();
        const kindBadge =
          s.kind === "dir" ? `<span class="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400">${t("labels.snapFolder", "carpeta")}</span>`
          : s.kind === "absent" ? `<span class="rounded bg-zinc-500/15 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">${t("labels.snapAbsent", "no existía")}</span>`
          : s.kind === "skipped" ? `<span class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">${t("labels.snapSkipped", "sin respaldo")}</span>`
          : "";
        const canCompare = s.kind === "file";
        const canDownload = s.kind === "file" || s.kind === "dir";
        const canRestore = s.kind !== "skipped";
        const da = `data-snap-id="${escapeHtml(s.id)}" data-snap-kind="${s.kind}" data-snap-path="${escapeHtml(s.path)}" data-snap-name="${escapeHtml(name)}"`;
        const btn = (action: string, icon: string, label: string, cls = "") =>
          `<button type="button" data-snap-action="${action}" ${da} class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-accent ${cls}"><i class="ti ti-${icon} text-sm"></i>${label}</button>`;
        return `
          <div class="flex flex-col gap-2 border-b border-border px-2 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-medium text-foreground" title="${escapeHtml(s.path)}">${escapeHtml(name)}</span>
                ${kindBadge}
              </div>
              <div class="mt-0.5 truncate text-xs text-muted-foreground" title="${escapeHtml(s.path)}">${escapeHtml(s.path)}</div>
              <div class="mt-0.5 text-[11px] text-muted-foreground">${escapeHtml(opLabel)} · ${escapeHtml(when)}${s.kind === "file" || s.kind === "dir" ? ` · ${formatBytes(s.sizeBytes)}` : ""}</div>
            </div>
            <div class="flex shrink-0 flex-wrap items-center gap-1.5">
              ${canRestore ? btn("restore", "history-toggle", t("actions.restore", "Restaurar")) : ""}
              ${canCompare ? btn("compare", "git-compare", t("actions.compare", "Comparar")) : ""}
              ${canDownload ? btn("download", "download", t("actions.download", "Descargar")) : ""}
              ${btn("delete", "trash", "", "text-destructive")}
            </div>
          </div>`;
      })
      .join("");

    let pager = "";
    if (pageCount > 1) {
      const from = start + 1;
      const to = Math.min(start + HISTORY_PAGE_SIZE, snaps.length);
      const navBtn = (nav: string, icon: string, disabled: boolean) =>
        `<button type="button" data-history-nav="${nav}" ${disabled ? "disabled" : ""} class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"><i class="ti ti-${icon} text-sm"></i></button>`;
      pager = `
        <div class="flex items-center justify-between gap-2 border-t border-border px-2 py-2 text-xs text-muted-foreground">
          <span>${fmt(t("labels.historyRange", "{from}–{to} de {total}"), { from: String(from), to: String(to), total: String(snaps.length) })}</span>
          <div class="flex items-center gap-1.5">
            ${navBtn("prev", "chevron-left", historyPage === 0)}
            <span>${fmt(t("labels.historyPage", "Página {page} de {pages}"), { page: String(historyPage + 1), pages: String(pageCount) })}</span>
            ${navBtn("next", "chevron-right", historyPage >= pageCount - 1)}
          </div>
        </div>`;
    }

    listEl.innerHTML = rowsHtml + pager;
  }

  export async function onHistoryListClick(ev: Event) {
    const nav = (ev.target as HTMLElement | null)?.closest("[data-history-nav]") as HTMLElement | null;
    if (nav) {
      const dir = nav.getAttribute("data-history-nav");
      if (dir === "prev") historyPage -= 1;
      else if (dir === "next") historyPage += 1;
      renderHistoryPage();
      return;
    }
    const target = (ev.target as HTMLElement | null)?.closest("[data-snap-action]") as HTMLElement | null;
    if (!target) return;
    const id = target.getAttribute("data-snap-id") || "";
    const action = target.getAttribute("data-snap-action") || "";
    const name = target.getAttribute("data-snap-name") || "";
    if (!id) return;

    if (action === "download") {
      window.open(resolvePanelApiPath(`/api/files/snapshots/${encodeURIComponent(id)}/download`), "_blank");
      return;
    }

    if (action === "compare") {
      const res: any = await api.get(`/api/files/snapshots/${encodeURIComponent(id)}/diff`);
      if (!res.ok) { showToast(res.error || t("toasts.compareError", "No se pudo comparar"), false); return; }
      const path = res.data?.path || target.getAttribute("data-snap-path") || "";
      const fileName = (path.split("/").pop()) || name || t("labels.fileCap", "Archivo").toLocaleLowerCase(document.documentElement.lang || undefined);
      await showEditorView();
      getEditorApi()?.openFile({
        path,
        name: fileName,
        content: res.data?.after ?? "",
        originalContent: res.data?.before ?? "",
      });
      // Switch to diff view once Monaco has laid out inside the now-open modal.
      setTimeout(() => getEditorApi()?.openDiff(), 140);
      return;
    }

    if (action === "restore") {
      const ok = await openConfirm(
        fmt(t("confirm.restoreSnap", "¿Restaurar \"{name}\" a esta versión? Se respaldará el estado actual antes de restaurar."), { name }),
        { title: t("confirm.restoreSnapTitle", "Restaurar cambio"), variant: "danger" },
      );
      if (!ok) return;
      const res: any = await api.post(`/api/files/snapshots/${encodeURIComponent(id)}/restore`);
      if (res.ok) {
        showToast(t("toasts.snapRestored", "Cambio restaurado"));
        refreshCurrentView();
        void loadSnapshots(historyFilterPath || undefined);
      } else {
        showToast(res.error || t("toasts.restoreError", "No se pudo restaurar"), false);
      }
      return;
    }

    if (action === "delete") {
      const ok = await openConfirm(t("confirm.deleteSnap", "¿Eliminar este punto de respaldo?"), {
        title: t("confirm.deleteSnapTitle", "Eliminar respaldo"),
        variant: "danger",
      });
      if (!ok) return;
      const res: any = await api.delete(`/api/files/snapshots/${encodeURIComponent(id)}`);
      if (res.ok) {
        showToast(t("toasts.snapDeleted", "Respaldo eliminado"));
        void loadSnapshots(historyFilterPath || undefined);
      } else {
        showToast(res.error || t("toasts.deleteError", "No se pudo eliminar"), false);
      }
    }
  }

  // ── Folder compare ("Comparar carpetas", #6) ───────────────
  export type CompareData = {
    entries: Array<{ path: string; status: "added" | "removed" | "modified"; fromPath: string; toPath: string }>;
    counts: { added: number; removed: number; modified: number; same: number };
    truncated: boolean;
  };

  export function parentOf(p: string): string {
    const trimmed = (p || "/").replace(/\/+$/, "");
    const idx = trimmed.lastIndexOf("/");
    if (idx <= 0) return "/";
    return trimmed.slice(0, idx);
  }

  export function openFolderPicker(targetInputId: string) {
    S.folderPickerOnSelect = null;
    S.folderPickerTarget = targetInputId;
    setFolderPickerContext(false);
    openDialog("dialog-folder-picker");
    renderPickerFavSelect();
    const seed = (document.getElementById(targetInputId) as HTMLInputElement | null)?.value || S.currentPath || "/";
    void loadFolderPicker(seed);
  }

  /** Populate the folder picker's "predefined routes" <select> from the saved
   *  favorites. Picking one just navigates the picker there (the user still
   *  confirms with "Select"). Row hides when there are no favorites. */
  export function renderPickerFavSelect(): void {
    const row = document.getElementById("folder-picker-fav-row");
    const sel = document.getElementById("folder-picker-fav") as HTMLSelectElement | null;
    if (!row || !sel) return;
    const favs = loadFavRoots();
    if (favs.length === 0) { row.classList.add("hidden"); return; }
    row.classList.remove("hidden");
    const placeholder = `<option value="" selected>${escapeHtml(t("folderPicker.favLabel", "Rutas predefinidas"))}…</option>`;
    sel.innerHTML = placeholder + favs.map((p) => `<option value="${escapeAttr(p)}">${escapeHtml(p)}</option>`).join("");
  }

  /** Open the folder picker seeded at `seed`, calling `onSelect(path)` when the
   *  user confirms a folder (callback mode — used to choose the tree root). */
  function setFolderPickerContext(treeRoot: boolean): void {
    document.getElementById("folder-picker-tree-options")?.classList.toggle("hidden", !treeRoot);
    const title = document.getElementById("folder-picker-title");
    if (title) title.textContent = treeRoot
      ? t("folderPicker.treeRootTitle", "Definir carpeta raíz")
      : t("folderPicker.title", "Seleccionar carpeta");
  }

  export function pickFolder(seed: string, onSelect: (path: string) => void, treeRoot = false) {
    S.folderPickerOnSelect = onSelect;
    S.folderPickerTarget = "";
    setFolderPickerContext(treeRoot);
    openDialog("dialog-folder-picker");
    renderPickerFavSelect();
    void loadFolderPicker(seed || S.currentPath || "/");
  }

  export async function loadFolderPicker(path: string) {
    S.folderPickerCurrent = path || "/";
    const currentEl = document.getElementById("folder-picker-current");
    const list = document.getElementById("folder-picker-list");
    const errEl = document.getElementById("folder-picker-error");
    if (currentEl) currentEl.textContent = S.folderPickerCurrent;
    errEl?.classList.add("hidden");
    if (list) list.innerHTML = `<li class="px-3 py-2 text-xs text-muted-foreground">${t("status.loading", "Cargando…")}</li>`;
    try {
      const res: any = await api.get("/api/files/list", { params: { path: S.folderPickerCurrent } });
      const payload = res.data as any;
      const data = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
      const dirs = (Array.isArray(data) ? data : []).filter((e: any) => e.isDir || e.type === "dir");
      if (!list) return;
      list.innerHTML = dirs.length
        ? dirs
            .map((d: any) => {
              const full = d.path || `${S.folderPickerCurrent}/${d.name}`.replace(/\/{2,}/g, "/");
              return `<li><button type="button" data-folder-nav="${escapeHtml(full)}" class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent">
                <i class="ti ti-folder text-amber-500"></i><span class="truncate">${escapeHtml(d.name)}</span>
              </button></li>`;
            })
            .join("")
        : `<li class="px-3 py-2 text-xs text-muted-foreground">${t("empty.noSubfolders", "(sin subcarpetas)")}</li>`;
    } catch {
      if (errEl) { errEl.textContent = t("toasts.listError", "No se pudo listar esta ruta (¿permisos?)."); errEl.classList.remove("hidden"); }
      if (list) list.innerHTML = "";
    }
  }

  export function openCompareDialog() {
    const dlg = document.getElementById("dialog-compare") as HTMLDialogElement | null;
    const fromEl = document.getElementById("compare-from") as HTMLInputElement | null;
    if (fromEl && !fromEl.value) fromEl.value = S.currentPath || "";
    const results = document.getElementById("compare-results");
    if (results) results.innerHTML = `<div class="px-4 py-6 text-center text-sm text-muted-foreground">${t("empty.compareHint", "Indica dos carpetas y pulsa Comparar.")}</div>`;
    if (dlg && !dlg.open) dlg.showModal();
  }

  export async function runCompare() {
    const from = (document.getElementById("compare-from") as HTMLInputElement | null)?.value?.trim() || "";
    const to = (document.getElementById("compare-to") as HTMLInputElement | null)?.value?.trim() || "";
    const results = document.getElementById("compare-results");
    if (!results) return;
    if (!from || !to) { showToast(t("toasts.indicateBothFolders", "Indica ambas carpetas"), false); return; }
    results.innerHTML = `<div class="px-4 py-6 text-center text-sm text-muted-foreground">${t("status.comparing", "Comparando (hash de cada archivo)…")}</div>`;
    const res: any = await api.get("/api/files/compare", { params: { from, to } });
    if (!res.ok) {
      results.innerHTML = `<div class="px-4 py-6 text-center text-sm text-destructive">${escapeHtml(res.error || t("toasts.compareError", "No se pudo comparar"))}</div>`;
      return;
    }
    renderCompare(res.data as CompareData);
  }

  export function renderCompare(data: CompareData) {
    const results = document.getElementById("compare-results");
    if (!results) return;
    const c = data.counts;
    const head = `<div class="px-2 pb-2 pt-1 text-xs text-muted-foreground">
      <span class="text-emerald-600 dark:text-emerald-400">+${c.added} ${t("labels.cmpAdded", "nuevos")}</span> ·
      <span class="text-amber-600 dark:text-amber-400">~${c.modified} ${t("labels.cmpModified", "modificados")}</span> ·
      <span class="text-destructive">−${c.removed} ${t("labels.cmpRemoved", "eliminados")}</span> ·
      ${c.same} ${t("labels.cmpSame", "iguales")}${data.truncated ? " · " + t("labels.listTruncated", "lista recortada") : ""}
    </div>`;
    if (data.entries.length === 0) {
      results.innerHTML = head + `<div class="px-4 py-6 text-center text-sm text-emerald-600 dark:text-emerald-400">${t("empty.noDiff", "✓ Sin diferencias.")}</div>`;
      return;
    }
    const rows = data.entries
      .map((e) => {
        const icon = e.status === "added" ? `<span class="text-emerald-600 dark:text-emerald-400">+</span>`
          : e.status === "removed" ? `<span class="text-destructive">−</span>`
          : `<span class="text-amber-600 dark:text-amber-400">~</span>`;
        const da = `data-cmp-from="${escapeHtml(e.fromPath)}" data-cmp-to="${escapeHtml(e.toPath)}" data-cmp-status="${e.status}"`;
        const btn = (action: string, label: string) =>
          `<button type="button" data-cmp-action="${action}" ${da} class="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-accent">${label}</button>`;
        const actions: string[] = [];
        if (e.status === "modified") { actions.push(btn("diff", t("actions.viewDiff", "Ver diff")), btn("to", t("actions.copyToTarget", "Copiar → contra")), btn("from", t("actions.copyFromBase", "Copiar ← base"))); }
        else if (e.status === "removed") { actions.push(btn("to", t("actions.copyToTarget", "Copiar → contra"))); }
        else if (e.status === "added") { actions.push(btn("from", t("actions.copyFromBase", "Copiar ← base"))); }
        actions.push(btn("ignore", t("actions.ignore", "Ignorar")));
        return `
          <div class="flex flex-col gap-1.5 border-b border-border px-2 py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between" data-cmp-row="1">
            <div class="min-w-0">
              <span class="font-mono text-sm">${icon} ${escapeHtml(e.path)}</span>
            </div>
            <div class="flex shrink-0 flex-wrap gap-1.5">${actions.join("")}</div>
          </div>`;
      })
      .join("");
    results.innerHTML = head + rows;
  }

  export async function onCompareClick(ev: Event) {
    const target = (ev.target as HTMLElement | null)?.closest("[data-cmp-action]") as HTMLElement | null;
    if (!target) return;
    const action = target.getAttribute("data-cmp-action") || "";
    const fromPath = target.getAttribute("data-cmp-from") || "";
    const toPath = target.getAttribute("data-cmp-to") || "";

    if (action === "ignore") {
      target.closest("[data-cmp-row]")?.remove();
      return;
    }

    if (action === "diff") {
      const [fromRes, toRes]: any[] = await Promise.all([
        api.get("/api/files/read", { params: { path: fromPath } }),
        api.get("/api/files/read", { params: { path: toPath } }),
      ]);
      if (!fromRes.ok || !toRes.ok) { showToast(t("toasts.cannotReadBothFiles", "No se pudo leer alguno de los archivos (¿binario?)"), false); return; }
      const before = typeof fromRes.data === "string" ? fromRes.data : fromRes.data?.content ?? "";
      const after = typeof toRes.data === "string" ? toRes.data : toRes.data?.content ?? "";
      await showEditorView();
      getEditorApi()?.openFile({ path: toPath, name: toPath.split("/").pop() || t("labels.fileCap", "Archivo").toLocaleLowerCase(document.documentElement.lang || undefined), content: after, originalContent: before });
      setTimeout(() => getEditorApi()?.openDiff(), 140);
      return;
    }

    // Copy actions reuse /api/files/copy. "to" pushes base→contra; "from" pulls contra→base.
    const src = action === "to" ? fromPath : toPath;
    const dst = action === "to" ? toPath : fromPath;
    const ok = await openConfirm(fmt(t("confirm.copyFile", "¿Copiar\n{src}\n→\n{dst}?"), { src, dst }), { title: t("confirm.copyFileTitle", "Copiar archivo") });
    if (!ok) return;
    const res: any = await api.post("/api/files/copy", { from: src, to: dst });
    if (res.ok) showToast(t("toasts.fileCopied", "Archivo copiado"));
    else showToast(res.error || t("toasts.copyDestError", "No se pudo copiar (¿existe la carpeta destino?)"), false);
  }

  // ── Per-file version history ("Versiones", #8) ─────────────
  export type FileHistoryData = {
    entries: Array<{ source: "git" | "snapshot"; date: string; label: string; author?: string; subject?: string; rev?: string; snapshotId?: string; kind?: string }>;
    gitRoot: string | null;
    relPath: string | null;
  };
  export let fileHistoryPath = "";

  export async function openFileHistory(path: string) {
    fileHistoryPath = path;
    const dlg = document.getElementById("dialog-file-history") as HTMLDialogElement | null;
    const scope = document.getElementById("file-history-scope");
    const body = document.getElementById("file-history-body");
    if (scope) scope.textContent = path;
    if (body) body.innerHTML = `<div class="px-4 py-8 text-center text-sm text-muted-foreground">${t("status.loadingHistory", "Cargando historial…")}</div>`;
    if (dlg && !dlg.open) dlg.showModal();
    const res: any = await api.get("/api/files/history", { params: { path } });
    if (!res.ok) {
      if (body) body.innerHTML = `<div class="px-4 py-8 text-center text-sm text-destructive">${escapeHtml(res.error || t("toasts.historyLoadError", "No se pudo cargar el historial"))}</div>`;
      return;
    }
    renderFileHistory(res.data as FileHistoryData);
  }

  export function renderFileHistory(data: FileHistoryData) {
    const body = document.getElementById("file-history-body");
    if (!body) return;
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    if (entries.length === 0) {
      body.innerHTML = `<div class="px-4 py-8 text-center text-sm text-muted-foreground">${t("empty.noVersions", "Sin versiones registradas todavía.")}</div>`;
      return;
    }
    const gitNote = data.gitRoot ? `<div class="px-2 pb-2 pt-1 text-xs text-muted-foreground">${escapeHtml(t("labels.gitRepoNote", "Repositorio Git:"))} <span class="font-mono">${escapeHtml(data.gitRoot)}</span></div>` : "";
    const when = (d: string) => { try { return new Date(d).toLocaleString(document.documentElement.lang || undefined); } catch { return d; } };
    const rows = entries
      .map((e) => {
        const when2 = when(e.date);
        const btn = (action: string, icon: string, label: string, cls = "") =>
          `<button type="button" data-fh-action="${action}" data-fh-rev="${escapeHtml(e.rev || "")}" data-fh-snap="${escapeHtml(e.snapshotId || "")}" class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-accent ${cls}"><i class="ti ti-${icon} text-sm"></i>${label}</button>`;
        if (e.source === "git") {
          return `
            <div class="border-b border-border px-2 py-3 last:border-0">
              <div class="flex items-center gap-2">
                <i class="ti ti-git-commit text-sm text-primary"></i>
                <span class="truncate text-sm font-medium">${escapeHtml(e.subject || t("labels.commitFallback", "(commit)"))}</span>
              </div>
              <div class="mt-0.5 text-[11px] text-muted-foreground">${escapeHtml(e.author || "")} · ${escapeHtml(when2)} · <span class="font-mono">${escapeHtml((e.rev || "").slice(0, 8))}</span></div>
              <div class="mt-2 flex flex-wrap gap-1.5">${btn("git-diff", "git-compare", t("actions.viewDiff", "Ver diff"))}${btn("git-restore", "history-toggle", t("actions.restore", "Restaurar"))}</div>
            </div>`;
        }
        return `
          <div class="border-b border-border px-2 py-3 last:border-0">
            <div class="flex items-center gap-2">
              <i class="ti ti-camera text-sm text-muted-foreground"></i>
              <span class="truncate text-sm font-medium">${escapeHtml(e.label)}</span>
            </div>
            <div class="mt-0.5 text-[11px] text-muted-foreground">${escapeHtml(when2)}</div>
            <div class="mt-2 flex flex-wrap gap-1.5">
              ${e.kind === "file" ? btn("snap-diff", "git-compare", t("actions.compare", "Comparar")) : ""}
              ${btn("snap-restore", "history-toggle", t("actions.restore", "Restaurar"))}
              ${e.kind === "file" || e.kind === "dir" ? btn("snap-download", "download", t("actions.download", "Descargar")) : ""}
            </div>
          </div>`;
      })
      .join("");
    body.innerHTML = gitNote + rows;
  }

  export async function diffAgainstCurrent(beforeContent: string, label: string) {
    const cur: any = await api.get("/api/files/read", { params: { path: fileHistoryPath } });
    const after = cur.ok ? (typeof cur.data === "string" ? cur.data : cur.data?.content ?? "") : "";
    await showEditorView();
    getEditorApi()?.openFile({ path: fileHistoryPath, name: `${fileHistoryPath.split("/").pop() || t("labels.fileCap", "Archivo").toLocaleLowerCase(document.documentElement.lang || undefined)} (${label})`, content: after, originalContent: beforeContent });
    setTimeout(() => getEditorApi()?.openDiff(), 140);
  }

  export async function onFileHistoryClick(ev: Event) {
    const target = (ev.target as HTMLElement | null)?.closest("[data-fh-action]") as HTMLElement | null;
    if (!target) return;
    const action = target.getAttribute("data-fh-action") || "";
    const rev = target.getAttribute("data-fh-rev") || "";
    const snap = target.getAttribute("data-fh-snap") || "";

    if (action === "git-diff") {
      const res: any = await api.get("/api/files/history/git-show", { params: { path: fileHistoryPath, rev } });
      if (!res.ok) { showToast(res.error || t("toasts.cannotReadVersion", "No se pudo leer esa versión"), false); return; }
      await diffAgainstCurrent(res.data?.content ?? "", rev.slice(0, 8));
      return;
    }
    if (action === "git-restore") {
      const res: any = await api.get("/api/files/history/git-show", { params: { path: fileHistoryPath, rev } });
      if (!res.ok) { showToast(res.error || t("toasts.cannotReadVersion", "No se pudo leer esa versión"), false); return; }
      const ok = await openConfirm(fmt(t("confirm.restoreGitVersion", "¿Restaurar el archivo a la versión {rev}? Se respaldará el estado actual antes."), { rev: rev.slice(0, 8) }), { title: t("confirm.restoreGitTitle", "Restaurar versión Git"), variant: "danger" });
      if (!ok) return;
      const w: any = await api.put("/api/files/write", { path: fileHistoryPath, content: res.data?.content ?? "" });
      if (w.ok) { showToast(t("toasts.fileRestoredGit", "Archivo restaurado a la versión Git")); refreshCurrentView(); }
      else showToast(w.error || t("toasts.restoreError", "No se pudo restaurar"), false);
      return;
    }
    if (action === "snap-diff") {
      const res: any = await api.get(`/api/files/snapshots/${encodeURIComponent(snap)}/diff`);
      if (!res.ok) { showToast(res.error || t("toasts.compareError", "No se pudo comparar"), false); return; }
      await diffAgainstCurrent(res.data?.before ?? "", "snapshot");
      return;
    }
    if (action === "snap-restore") {
      const ok = await openConfirm(t("confirm.restoreSnapshot", "¿Restaurar este snapshot? Se respaldará el estado actual antes."), { title: t("confirm.restoreSnapshotTitle", "Restaurar snapshot"), variant: "danger" });
      if (!ok) return;
      const res: any = await api.post(`/api/files/snapshots/${encodeURIComponent(snap)}/restore`);
      if (res.ok) { showToast(t("toasts.snapshotRestored", "Snapshot restaurado")); refreshCurrentView(); void openFileHistory(fileHistoryPath); }
      else showToast(res.error || t("toasts.restoreError", "No se pudo restaurar"), false);
      return;
    }
    if (action === "snap-download") {
      window.open(resolvePanelApiPath(`/api/files/snapshots/${encodeURIComponent(snap)}/download`), "_blank");
    }
  }
