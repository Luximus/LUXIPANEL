// Files page — bind-controls submodule (code-move; no behavior change): project
// scan triggers, drag-and-drop upload, select-all, sortable columns, bulk
// actions (delete / download / compress).
import { fmt, t } from "./i18n";
import { stageSelectedForAi } from "./ai-selection";
import { bindFileScroll, clearSelection, setupColumnSorting, updateBulkBar } from "./listing";
import { scanProjects } from "./projects";
import { S, selected } from "./state";
import { setStatus, showToast } from "./toast";
import { api, uploadFile } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";

export function bindListing() {
    bindFileScroll();
    // ── Projects ───────────────────────────────────────────────
    // All scan/rescan triggers (toolbar, mobile menu, in-view rescan, empty CTA)
    // funnel into scanProjects().
    for (const id of ["btn-scan-projects", "btn-projects-rescan", "btn-projects-scan-cta"]) {
      document.getElementById(id)?.addEventListener("click", () => { void scanProjects(); });
    }

    // ── Drag and drop upload ───────────────────────────────────
    document.getElementById("files-browser")?.addEventListener("dragover", (e) => { (e as DragEvent).preventDefault(); });
    document.getElementById("files-browser")?.addEventListener("drop", async (e: Event) => {
      (e as DragEvent).preventDefault();
      if (!S.currentPath) { showToast(t("toasts.selectDirFirst", "Selecciona un directorio primero"), false); return; }
      const files = Array.from((e as DragEvent).dataTransfer?.files ?? []);
      if (!files.length) return;
      setStatus(fmt(t("status.uploading", "Subiendo {n} archivo(s)..."), { n: files.length }));
      let ok = 0;
      for (const file of files) {
        const res = await uploadFile(`/api/files/upload?dest=${encodeURIComponent(S.currentPath)}&filename=${encodeURIComponent(file.name)}`, file);
        if (res.ok) ok++;
      }
      showToast(ok === files.length ? fmt(t("toasts.uploadedAll", "{n} archivo(s) subido(s)"), { n: ok }) : fmt(t("toasts.uploadedPartial", "{ok}/{total} subido(s)"), { ok, total: files.length }), ok === files.length);
      (window as any).navigate(S.currentPath);
      (window as any).__lxpFilesTreeRefresh?.([S.currentPath]);
    });

    // Select all checkbox
    document.getElementById("check-all")?.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      document.querySelectorAll<HTMLInputElement>(".row-check").forEach((cb) => {
        cb.checked = checked;
        const cell = cb.closest("tr")?.querySelector<HTMLElement>("[data-lxp-handler-dblclick], [ondblclick]");
        const path = (cell?.getAttribute("data-lxp-handler-dblclick") ?? cell?.getAttribute("ondblclick"))?.match(/'([^']+)'/)?.[1];
        if (path) checked ? selected.add(path) : selected.delete(path);
      });
      updateBulkBar();
    });

    // Sortable list-view column headers (Name / Type / Size / Modified).
    setupColumnSorting();

    // ── Bulk actions ───────────────────────────────────────────
    document.getElementById("bulk-clear")?.addEventListener("click", clearSelection);
    document.getElementById("bulk-attach-ai")?.addEventListener("click", stageSelectedForAi);

    document.getElementById("bulk-delete")?.addEventListener("click", async () => {
      if (!await openConfirm(fmt(t("confirm.deleteSelected", "¿Eliminar {n} elemento(s) seleccionado(s)?"), { n: selected.size }), { title: t("confirm.deleteSelectionTitle", "Eliminar selección"), variant: "danger" })) return;
      let ok = 0;
      for (const path of selected) {
        const entry = S.currentEntries.find((e) => `${S.currentPath}/${e.name}`.replace("//", "/") === path);
        const isDir = entry?.isDir ?? false;
        const res = await api.delete("/api/files", { path, recursive: isDir });
        if (res.ok) ok++;
      }
      showToast(fmt(t("toasts.deletedCount", "{n} elemento(s) eliminado(s){errors}"), { n: ok, errors: ok < selected.size ? ` (${selected.size - ok} ${t("labels.errors", "errores")})` : "" }), ok > 0);
      clearSelection();
      (window as any).navigate(S.currentPath);
    });

    document.getElementById("bulk-download")?.addEventListener("click", async () => {
      if (selected.size === 0) return;
      for (const path of selected) {
        const name = path.split("/").pop() || t("labels.fileCap", "Archivo").toLocaleLowerCase(document.documentElement.lang || undefined);
        const entry = S.currentEntries.find((e) => `${S.currentPath}/${e.name}`.replace("//", "/") === path);
        await (window as any).downloadEntry(path, name, entry?.isDir ?? false);
      }
    });

    document.getElementById("bulk-compress")?.addEventListener("click", () => {
      if (selected.size === 0) return;
      const paths = Array.from(selected);
      (window as any).openCompressDialog(paths, fmt(paths.length === 1 ? t("labels.itemCountOne", "{n} elemento") : t("labels.itemCountMany", "{n} elementos"), { n: paths.length }));
    });
}
