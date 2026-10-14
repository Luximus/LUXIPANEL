// Cron page — file browser dialog (picks a command path from the Files module).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { t, $, dlg, esc } from "./dom";
import { openDialog } from "/scripts/extracted/lib/dom.js";

  // ---------------------------------------------------------------------------
  // File browser
  // ---------------------------------------------------------------------------
  let browsePath = "/";
  async function browse(path: string) {
    browsePath = path || "/";
    $("files-path")!.textContent = browsePath;
    const res = await api.get<any>(`/api/files/list?path=${encodeURIComponent(browsePath)}`);
    const el = $("files-list")!;
    if (!res.ok) { el.innerHTML = `<div class="px-5 py-6 text-center text-xs text-destructive">${t("fileBrowser.openError", "No se pudo abrir (¿módulo Files habilitado?)")}</div>`; return; }
    const entries = ((res.data as any[]) ?? []).slice().sort((a, b) => (b.isDir ? 1 : 0) - (a.isDir ? 1 : 0) || a.name.localeCompare(b.name));
    el.innerHTML = entries.map((en) => {
      const icon = en.isDir ? "ti-folder text-amber-500" : "ti-file text-muted-foreground";
      const action = en.isDir ? `browseInto('${esc(en.path)}')` : `pickFile('${esc(en.path)}')`;
      return `<button onclick="${action}" class="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-muted/40">
        <i class="ti ${icon} text-base"></i><span class="text-sm truncate">${esc(en.name)}</span>${en.isDir ? '<i class="ti ti-chevron-right text-xs ml-auto text-muted-foreground"></i>' : ""}</button>`;
    }).join("") || `<div class="px-5 py-6 text-center text-xs text-muted-foreground">${t("fileBrowser.emptyFolder", "Carpeta vacía")}</div>`;
  }
  (window as any).browseInto = (p: string) => browse(p);
  (window as any).pickFile = (p: string) => { ($("job-command") as HTMLInputElement).value = p; dlg("dialog-files")!.close(); };

  function onBrowseClick() {
    const cur = ($("job-command") as HTMLInputElement).value.trim();
    const start = cur && cur.startsWith("/") ? cur.replace(/\/[^/]*$/, "") || "/" : "/";
    openDialog("dialog-files");
    browse(start);
  }

  export function wireFiles() {
    $("btn-browse")?.addEventListener("click", onBrowseClick);
    $("files-up")?.addEventListener("click", () => browse(browsePath.replace(/\/[^/]+\/?$/, "") || "/"));
    $("files-use-folder")?.addEventListener("click", () => { ($("job-command") as HTMLInputElement).value = browsePath.replace(/\/$/, "") + "/"; dlg("dialog-files")!.close(); });
    $("files-close")?.addEventListener("click", () => dlg("dialog-files")!.close());
  }
