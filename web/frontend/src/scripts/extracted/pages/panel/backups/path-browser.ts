// Backups page — folder browser dialog (shared by the local destination setter
// and the per-dialog source folder selectors).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260927b";
import { escapeHtml } from "/scripts/extracted/lib/escape.js";
import { t } from "./dom";
import { selectBackupDir } from "./settings";
import type { SourcesController } from "./types";

let pathBrowserCurrent = "/";
let pathBrowserMode: "dest" | "source" = "dest";
let pathBrowserSourceTarget: SourcesController | null = null;

function parentPath(p: string): string {
  if (!p || p === "/") return "/";
  const trimmed = p.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx <= 0 ? "/" : trimmed.slice(0, idx);
}

async function loadPathBrowser(path: string) {
  pathBrowserCurrent = path || "/";
  const current = document.getElementById("path-browser-current");
  const list = document.getElementById("path-browser-list");
  const errEl = document.getElementById("path-browser-error");
  if (current) current.textContent = pathBrowserCurrent;
  if (errEl) errEl.classList.add("hidden");
  if (list) list.innerHTML = `<li class="px-3 py-2 text-xs text-muted-foreground">${t("labels.loading", "Cargando…")}</li>`;
  try {
    const res = await api.get<any>(`/api/files/list?path=${encodeURIComponent(pathBrowserCurrent)}`);
    if (!res.ok) throw new Error(res.error ?? t("errors.listPathFailed", "No se pudo listar esta ruta."));
    const data = (res.data as any)?.data ?? res.data ?? [];
    const dirs = (Array.isArray(data) ? data : []).filter((e: any) => e.isDir || e.type === "dir");
    if (!list) return;
    list.innerHTML = dirs.length
      ? dirs
          .map((d: any) => `
              <li><button type="button" data-path-nav="${escapeHtml(d.path)}" class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent">
                <i class="ti ti-folder text-amber-500"></i><span class="truncate">${escapeHtml(d.name)}</span>
              </button></li>`)
          .join("")
      : `<li class="px-3 py-2 text-xs text-muted-foreground">${t("empty.noSubfolders", "(sin subcarpetas)")}</li>`;
  } catch (err) {
    if (errEl) { errEl.textContent = (err as Error).message; errEl.classList.remove("hidden"); }
    if (list) list.innerHTML = "";
  }
}

/** Open the folder browser. mode "dest" sets the local backup dir; mode
 *  "source" appends to a source selector's folder list. */
export function openPathBrowser(mode: "dest" | "source", target?: SourcesController, seedFrom?: string) {
  const dlg = document.getElementById("dialog-path-browser") as HTMLDialogElement | null;
  if (!dlg) return;
  pathBrowserMode = mode;
  pathBrowserSourceTarget = target ?? null;
  dlg.showModal();
  const seed = (seedFrom ?? "").trim();
  void loadPathBrowser(seed && seed.startsWith("/") ? seed : "/");
}

export function bindPathBrowserControls() {
  // Folder browser — local destination (dest) opener
  const openDestBrowser = () =>
    openPathBrowser("dest", undefined, (document.getElementById("s-backup-dir") as HTMLInputElement | null)?.value);
  document.getElementById("s-backup-dir-browse")?.addEventListener("click", openDestBrowser);
  document.getElementById("s-backup-dir")?.addEventListener("click", openDestBrowser);
  const closeBrowser = () => (document.getElementById("dialog-path-browser") as HTMLDialogElement | null)?.close();
  document.getElementById("path-browser-close")?.addEventListener("click", closeBrowser);
  document.getElementById("path-browser-cancel")?.addEventListener("click", closeBrowser);
  document.getElementById("path-browser-up")?.addEventListener("click", () => void loadPathBrowser(parentPath(pathBrowserCurrent)));
  document.getElementById("path-browser-select")?.addEventListener("click", () => {
    if (pathBrowserMode === "source" && pathBrowserSourceTarget) pathBrowserSourceTarget.addFolder(pathBrowserCurrent);
    else selectBackupDir(pathBrowserCurrent);
    closeBrowser();
  });
  document.getElementById("path-browser-list")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-path-nav]");
    if (btn?.dataset.pathNav) void loadPathBrowser(btn.dataset.pathNav);
  });
}
