// Users page — file-path chips + filesystem browser (group "Servidor" tab).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { t, escapeHtml } from "./dom";
import { openDialog } from "/scripts/extracted/lib/dom.js";

export const PATH_TEXTAREA_IDS = ["perm-file-allow-paths", "perm-file-readonly-paths", "perm-file-deny-paths"];
export let pathBrowserTarget = "";
export let pathBrowserCurrent = "/";

// ── File-path chips + filesystem browser (group "Servidor" tab) ──────────
function pathLines(textareaId: string): string[] {
  const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
  if (!ta) return [];
  return [...new Set(ta.value.split("\n").map((s) => s.trim()).filter(Boolean))];
}

export function renderPathChips(textareaId: string) {
  const chips = document.getElementById(`chips-${textareaId}`);
  if (!chips) return;
  const lines = pathLines(textareaId);
  chips.innerHTML = lines.length
    ? lines
        .map((p) => `
          <span class="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs">
            <code>${escapeHtml(p)}</code>
            <button type="button" data-path-remove="${textareaId}" data-path="${escapeHtml(p)}" class="text-muted-foreground hover:text-destructive" aria-label="${t("labels.removeChip", "Quitar")}">&times;</button>
          </span>`)
        .join("")
    : `<span class="text-xs text-muted-foreground">${t("empty.noPaths", "(ninguna)")}</span>`;
}

export function addPath(textareaId: string, p: string) {
  const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
  if (!ta) return;
  const set = new Set(pathLines(textareaId));
  set.add(p);
  ta.value = [...set].join("\n");
  renderPathChips(textareaId);
}

export function removePath(textareaId: string, p: string) {
  const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
  if (!ta) return;
  ta.value = pathLines(textareaId).filter((x) => x !== p).join("\n");
  renderPathChips(textareaId);
}

export function parentPath(p: string): string {
  if (!p || p === "/") return "/";
  const trimmed = p.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx <= 0 ? "/" : trimmed.slice(0, idx);
}

export async function loadPathBrowser(path: string) {
  pathBrowserCurrent = path || "/";
  const current = document.getElementById("path-browser-current");
  const list = document.getElementById("path-browser-list");
  const errEl = document.getElementById("path-browser-error");
  if (current) current.textContent = pathBrowserCurrent;
  if (errEl) errEl.classList.add("hidden");
  if (list) list.innerHTML = `<li class="px-3 py-2 text-xs text-muted-foreground">${t("labels.loading", "Cargando…")}</li>`;
  try {
    const res = await api.get<any>(`/api/files/list?path=${encodeURIComponent(pathBrowserCurrent)}`);
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
  } catch {
    if (errEl) { errEl.textContent = t("errors.pathListFailed", "No se pudo listar esta ruta (¿permisos?)."); errEl.classList.remove("hidden"); }
    if (list) list.innerHTML = "";
  }
}

export function openPathBrowser(textareaId: string) {
  pathBrowserTarget = textareaId;
  openDialog("dialog-path-browser");
  void loadPathBrowser("/");
}
