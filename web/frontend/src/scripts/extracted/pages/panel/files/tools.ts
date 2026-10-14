// Files page — tools submodule (code-move from index-script1.ts; no behavior change).
import { getEditorApi } from "./editor";
import { formatBytes } from "./history-file-versions";
import { fmt, t } from "./i18n";
import { escapeHtml } from "./paths";
import { refreshCurrentView } from "./projects";
import { CLIENT_HIDDEN_BTNS, S } from "./state";
import { showToast } from "./toast";
import { api, resolvePanelApiPath } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { PROJECT_MAP_OPEN_EVENT } from "/scripts/extracted/lib/panel-events.js";


  // ── AI project map ("Mapa del proyecto", #4) ───────────────
  // The map UI is the full-screen React drawer <ProjectMapDrawer> (mounted in
  // index.astro). Here we just hand it the target path via a window event; the
  // drawer loads the cached map and offers provider-picking + (re)generation.
  export function openProjectMap(forPath?: string) {
    const targetPath = forPath || S.currentPath;
    if (!targetPath) {
      showToast(t("toasts.openFolderFirst", "Abre una carpeta primero"), false);
      return;
    }
    window.dispatchEvent(new CustomEvent(PROJECT_MAP_OPEN_EVENT, { detail: { path: targetPath } }));
  }

  // ── Web exposure scanner ("Exposición web", #3/#16) ────────
  export type ExposureData = {
    findings: Array<{ path: string; name: string; root: string; domain: string; url: string; risk: "high" | "medium"; reason: string }>;
    rootsScanned: Array<{ root: string; domain: string; ssl: boolean }>;
    truncated: boolean;
  };

  export function openExposureDialog() {
    const dlg = document.getElementById("dialog-exposure") as HTMLDialogElement | null;
    const body = document.getElementById("exposure-body");
    if (body) body.innerHTML = `<div class="px-4 py-8 text-center text-sm text-muted-foreground">${t("status.scanningRoots", "Escaneando raíces públicas…")}</div>`;
    if (dlg && !dlg.open) dlg.showModal();
    void loadExposure();
  }

  export async function loadExposure() {
    const body = document.getElementById("exposure-body");
    if (!body) return;
    body.innerHTML = `<div class="px-4 py-8 text-center text-sm text-muted-foreground">${escapeHtml(t("status.scanningRoots", "Escaneando raíces públicas…"))}</div>`;
    const res: any = await api.get("/api/files/exposure/scan");
    if (!res.ok) {
      body.innerHTML = `<div class="px-4 py-8 text-center text-sm text-destructive">${escapeHtml(res.error || t("toasts.scanError", "Error al escanear"))}</div>`;
      return;
    }
    renderExposure(res.data as ExposureData);
  }

  export function renderExposure(data: ExposureData) {
    const body = document.getElementById("exposure-body");
    if (!body) return;
    const roots = Array.isArray(data?.rootsScanned) ? data.rootsScanned : [];
    if (roots.length === 0) {
      body.innerHTML = `<div class="px-4 py-8 text-center text-sm text-muted-foreground">${t("empty.noPublicRoots", "No se detectaron raíces públicas de NGINX que sirvan archivos.")}</div>`;
      return;
    }
    const findings = Array.isArray(data?.findings) ? data.findings : [];
    const head = `<div class="px-2 pb-2 pt-1 text-xs text-muted-foreground">${fmt(t("exposure.headSummary", "{roots} raíz(es) pública(s) · {findings} archivo(s) sensible(s)"), { roots: roots.length, findings: findings.length })}${data.truncated ? ` · ${t("labels.listTruncated", "lista recortada")}` : ""}</div>`;
    if (findings.length === 0) {
      body.innerHTML = head + `<div class="px-4 py-6 text-center text-sm text-emerald-600 dark:text-emerald-400">${t("empty.noExposures", "✓ No se encontraron archivos sensibles expuestos.")}</div>`;
      return;
    }
    const blocks = findings
      .map((f) => {
        const badge = f.risk === "high"
          ? `<span class="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive">${t("labels.riskHigh", "alto")}</span>`
          : `<span class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">${t("labels.riskMedium", "medio")}</span>`;
        const da = `data-exp-path="${escapeHtml(f.path)}" data-exp-name="${escapeHtml(f.name)}" data-exp-url="${escapeHtml(f.url)}"`;
        const btn = (action: string, icon: string, label: string, cls = "") =>
          `<button type="button" data-exp-action="${action}" ${da} class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-accent ${cls}"><i class="ti ti-${icon} text-sm"></i>${label}</button>`;
        return `
          <div class="border-b border-border px-2 py-3 last:border-0">
            <div class="flex items-center gap-2">
              <i class="ti ti-alert-triangle text-sm ${f.risk === "high" ? "text-destructive" : "text-amber-500"}"></i>
              <span class="truncate text-sm font-medium" title="${escapeHtml(f.path)}">${escapeHtml(f.name)}</span>
              ${badge}
            </div>
            <div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(f.reason)}</div>
            <div class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title="${escapeHtml(f.url)}">${escapeHtml(f.url)}</div>
            <div class="mt-1 text-[11px] text-muted-foreground" data-exp-probe="${escapeHtml(f.path)}"></div>
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              ${btn("probe", "world-search", t("actions.probeAccess", "Probar acceso"))}
              ${btn("block", "lock", t("actions.block", "Bloquear (.htaccess)"))}
              ${btn("download", "download", t("actions.download", "Descargar"))}
              ${btn("delete", "trash", t("actions.delete", "Eliminar"), "text-destructive")}
            </div>
          </div>`;
      })
      .join("");
    body.innerHTML = head + blocks;
  }

  export async function onExposureClick(ev: Event) {
    const target = (ev.target as HTMLElement | null)?.closest("[data-exp-action]") as HTMLElement | null;
    if (!target) return;
    const action = target.getAttribute("data-exp-action") || "";
    const path = target.getAttribute("data-exp-path") || "";
    const name = target.getAttribute("data-exp-name") || "";
    if (!path) return;

    if (action === "download") {
      // Route through the blob-download helper so the request carries the
      // per-tab isolation headers (X-Bridge-Session-Id). A raw `window.open`
      // can't set headers → the backend resolves it against the panel host /
      // stale cookie instead of the connected server.
      const dl = (window as any).downloadEntry as ((p: string, n: string, isDir: boolean) => Promise<void>) | undefined;
      if (dl) await dl(path, name || path.split("/").pop() || t("labels.fileCap", "Archivo").toLocaleLowerCase(document.documentElement.lang || undefined), false);
      else window.open(resolvePanelApiPath(`/api/files/download?path=${encodeURIComponent(path)}`), "_blank");
      return;
    }

    if (action === "probe") {
      const slot = target.closest(".border-b")?.querySelector("[data-exp-probe]") as HTMLElement | null;
      if (slot) slot.textContent = t("status.probing", "Probando…");
      const res: any = await api.get("/api/files/exposure/probe", { params: { path } });
      if (!res.ok) { if (slot) slot.textContent = res.error || t("toasts.probeError", "Error al probar"); return; }
      const d = res.data || {};
      if (slot) {
        slot.innerHTML = d.accessible
          ? `<span class="font-medium text-destructive">${escapeHtml(fmt(t("exposure.probeAccessible", "⚠ ACCESIBLE públicamente (HTTP {status})"), { status: d.status }))}</span>`
          : `<span class="text-emerald-600 dark:text-emerald-400">${escapeHtml(fmt(t("exposure.probeNotAccessible", "No accesible ({detail})"), { detail: d.error ? d.error : "HTTP " + d.status }))}</span>`;
      }
      return;
    }

    if (action === "block") {
      const res: any = await api.post("/api/files/exposure/block", { path });
      if (res.ok) showToast(t("toasts.htaccessAdded", "Regla .htaccess añadida (Apache)"));
      else showToast(res.error || t("toasts.blockError", "No se pudo bloquear"), false);
      return;
    }

    if (action === "delete") {
      const ok = await openConfirm(fmt(t("confirm.deleteExposed", "¿Eliminar \"{name}\"? Se respaldará antes de borrar (recuperable desde Historial)."), { name }), {
        title: t("confirm.deleteExposedTitle", "Eliminar archivo expuesto"),
        variant: "danger",
      });
      if (!ok) return;
      const res: any = await api.delete("/api/files", { path, recursive: name === ".git" });
      if (res.ok) {
        showToast(t("toasts.fileDeleted", "Archivo eliminado"));
        refreshCurrentView();
        void loadExposure();
      } else {
        showToast(res.error || t("toasts.deleteError", "No se pudo eliminar"), false);
      }
    }
  }

  // ── Malware detector + quarantine (#12/#13) ────────────────
  export type MalwareScanData = { findings: Array<{ path: string; name: string; line?: number; risk: "high" | "medium"; reason: string; snippet?: string }>; truncated: boolean };
  export let malwareScanPath = "";

  export async function openMalwareDialog(forPath?: string) {
    malwareScanPath = forPath || S.currentPath || "";
    const dlg = document.getElementById("dialog-malware") as HTMLDialogElement | null;
    const scope = document.getElementById("malware-scope");
    if (scope) scope.textContent = malwareScanPath || "—";
    if (dlg && !dlg.open) dlg.showModal();
    await Promise.all([loadMalwareScan(), loadQuarantine()]);
  }

  export async function loadMalwareScan() {
    const el = document.getElementById("malware-results");
    if (!el) return;
    if (!malwareScanPath) { el.innerHTML = `<div class="py-3 text-center text-sm text-muted-foreground">${t("toasts.openFolderFirst", "Abre una carpeta primero")}</div>`; return; }
    el.innerHTML = `<div class="py-3 text-center text-sm text-muted-foreground">${fmt(t("status.analyzingPath", "Analizando {path}…"), { path: escapeHtml(malwareScanPath) })}</div>`;
    const res: any = await api.get("/api/files/malware/scan", { params: { path: malwareScanPath } });
    if (!res.ok) { el.innerHTML = `<div class="py-3 text-center text-sm text-destructive">${escapeHtml(res.error || t("status.error", "Error"))}</div>`; return; }
    renderMalware(res.data as MalwareScanData);
  }

  export function renderMalware(data: MalwareScanData) {
    const el = document.getElementById("malware-results");
    if (!el) return;
    const f = Array.isArray(data?.findings) ? data.findings : [];
    if (f.length === 0) { el.innerHTML = `<div class="py-3 text-center text-sm text-emerald-600 dark:text-emerald-400">${t("empty.noMalware", "✓ Sin patrones sospechosos.")}</div>`; return; }
    el.innerHTML = (data.truncated ? `<div class="pb-1 text-[11px] text-muted-foreground">${fmt(t("labels.listTruncatedN", "Lista recortada ({n}+)."), { n: f.length })}</div>` : "") + f.map((x) => {
      const badge = x.risk === "high"
        ? `<span class="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive">${t("labels.riskHigh", "alto")}</span>`
        : `<span class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">${t("labels.riskMedium", "medio")}</span>`;
      const da = `data-mw-path="${escapeHtml(x.path)}" data-mw-line="${x.line || ""}" data-mw-name="${escapeHtml(x.name)}" data-mw-reason="${escapeHtml(x.reason)}"`;
      const btn = (action: string, label: string, cls = "") => `<button type="button" data-mw-action="${action}" ${da} class="rounded-md border border-border px-2 py-0.5 text-xs font-medium hover:bg-accent ${cls}">${label}</button>`;
      return `
        <div class="border-b border-border py-2 last:border-0">
          <div class="flex items-center gap-2"><i class="ti ti-bug text-sm ${x.risk === "high" ? "text-destructive" : "text-amber-500"}"></i><span class="truncate text-sm font-medium" title="${escapeHtml(x.path)}">${escapeHtml(x.name)}</span>${badge}${x.line ? `<span class="text-[11px] text-muted-foreground">L${x.line}</span>` : ""}</div>
          <div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(x.reason)}</div>
          ${x.snippet ? `<div class="mt-0.5 truncate rounded bg-muted/40 px-2 py-1 font-mono text-[11px]">${escapeHtml(x.snippet)}</div>` : ""}
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            ${btn("view", t("actions.viewCode", "Ver código"))}
            ${btn("ai", t("actions.analyzeAI", "Analizar con IA"))}
            ${btn("quarantine", t("actions.quarantine", "Cuarentena"))}
            ${btn("delete", t("actions.delete", "Eliminar"), "text-destructive")}
          </div>
        </div>`;
    }).join("");
  }

  export async function loadQuarantine() {
    const el = document.getElementById("malware-quarantine");
    if (!el) return;
    const res: any = await api.get("/api/files/malware/quarantine");
    if (!res.ok) { el.innerHTML = `<div class="py-2 text-center text-xs text-destructive">${escapeHtml(res.error || t("status.error", "Error"))}</div>`; return; }
    const items: Array<{ id: string; name: string; originalPath: string; quarantinedAt: string }> = res.data || [];
    if (items.length === 0) { el.innerHTML = `<div class="py-2 text-center text-xs text-muted-foreground">${t("empty.quarantineEmpty", "Cuarentena vacía.")}</div>`; return; }
    el.innerHTML = items.map((q) => {
      const when = (() => { try { return new Date(q.quarantinedAt).toLocaleString(document.documentElement.lang || undefined); } catch { return q.quarantinedAt; } })();
      return `
        <div class="flex items-center justify-between gap-2 border-b border-border py-1.5 last:border-0">
          <span class="min-w-0 truncate text-xs"><i class="ti ti-lock"></i> <span class="font-mono">${escapeHtml(q.originalPath)}</span> <span class="text-muted-foreground">· ${escapeHtml(when)}</span></span>
          <span class="flex shrink-0 gap-1">
            <button type="button" data-q-action="restore" data-q-id="${escapeHtml(q.id)}" class="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-accent">${t("actions.restore", "Restaurar")}</button>
            <button type="button" data-q-action="delete" data-q-id="${escapeHtml(q.id)}" class="rounded-md border border-border px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10">${t("actions.delete", "Eliminar")}</button>
          </span>
        </div>`;
    }).join("");
  }

  export async function onMalwareResultClick(ev: Event) {
    const target = (ev.target as HTMLElement | null)?.closest("[data-mw-action]") as HTMLElement | null;
    if (!target) return;
    const action = target.getAttribute("data-mw-action") || "";
    const p = target.getAttribute("data-mw-path") || "";
    const line = Number(target.getAttribute("data-mw-line") || "0");
    const name = target.getAttribute("data-mw-name") || "";
    const reason = target.getAttribute("data-mw-reason") || "";
    if (!p) return;

    if (action === "view") {
      (document.getElementById("dialog-malware") as HTMLDialogElement | null)?.close();
      await (window as any).handleEdit(p, name);
      if (line) setTimeout(() => getEditorApi()?.gotoLine(line), 220);
      return;
    }
    if (action === "ai") {
      const prompt = fmt(t("seeds.analyzeMalwarePrompt", "Analiza si este archivo es malicioso y explica por qué. Motivo detectado: \"{reason}\". Archivo: \"{path}\"{lineSuffix}. Revisa su contenido y dime si es un webshell/backdoor y qué hacer."), { reason, path: p, lineSuffix: line ? fmt(t("seeds.lineSuffix", " (línea {line})"), { line }) : "" });
      requestAssistant({
        kind: "prompt",
        prompt,
        submit: "auto",
        conversation: "new",
        origin: { module: "files", action: "malwareAnalyze" },
      });
      return;
    }
    if (action === "quarantine") {
      const ok = await openConfirm(fmt(t("confirm.quarantine", "¿Mover \"{name}\" a cuarentena? Se respalda antes (recuperable) y se bloquea su ejecución."), { name }), { title: t("confirm.quarantineTitle", "Poner en cuarentena"), variant: "danger" });
      if (!ok) return;
      const res: any = await api.post("/api/files/malware/quarantine", { path: p, reason });
      if (res.ok) { showToast(t("toasts.quarantined", "Archivo en cuarentena")); refreshCurrentView(); await loadMalwareScan(); await loadQuarantine(); }
      else showToast(res.error || t("toasts.quarantineError", "No se pudo poner en cuarentena"), false);
      return;
    }
    if (action === "delete") {
      const ok = await openConfirm(fmt(t("confirm.deleteWithBackup", "¿Eliminar \"{name}\"? Se respalda antes (recuperable desde Historial)."), { name }), { title: t("confirm.deleteFileTitle", "Eliminar archivo"), variant: "danger" });
      if (!ok) return;
      const res: any = await api.delete("/api/files", { path: p });
      if (res.ok) { showToast(t("toasts.fileDeleted", "Archivo eliminado")); refreshCurrentView(); await loadMalwareScan(); }
      else showToast(res.error || t("toasts.deleteError", "No se pudo eliminar"), false);
    }
  }

  export async function onQuarantineClick(ev: Event) {
    const target = (ev.target as HTMLElement | null)?.closest("[data-q-action]") as HTMLElement | null;
    if (!target) return;
    const action = target.getAttribute("data-q-action") || "";
    const id = target.getAttribute("data-q-id") || "";
    if (!id) return;
    if (action === "restore") {
      const res: any = await api.post(`/api/files/malware/quarantine/${encodeURIComponent(id)}/restore`);
      if (res.ok) { showToast(t("toasts.restoredToOriginal", "Restaurado a su ubicación original")); refreshCurrentView(); await loadQuarantine(); }
      else showToast(res.error || t("toasts.restoreError", "No se pudo restaurar"), false);
      return;
    }
    if (action === "delete") {
      const ok = await openConfirm(t("confirm.deleteFromQuarantine", "¿Eliminar definitivamente el archivo en cuarentena?"), { title: t("confirm.deleteFromQuarantineTitle", "Eliminar de cuarentena"), variant: "danger" });
      if (!ok) return;
      const res: any = await api.delete(`/api/files/malware/quarantine/${encodeURIComponent(id)}`);
      if (res.ok) { showToast(t("toasts.deleted", "Eliminado")); await loadQuarantine(); }
      else showToast(res.error || t("toasts.deleteError", "No se pudo eliminar"), false);
    }
  }

  // ── Smart cleanup ("Limpieza inteligente", #11) ────────────
  export type CleanupData = {
    items: Array<{ path: string; name: string; kind: "dir" | "file"; sizeBytes: number; classification: "safe" | "review" | "keep"; reason: string; category: string }>;
    reclaimableBytes: number;
    truncated: boolean;
  };
  export let cleanupScanPath = "";

  export async function openCleanupDialog(forPath?: string) {
    cleanupScanPath = forPath || S.currentPath || "";
    const dlg = document.getElementById("dialog-cleanup") as HTMLDialogElement | null;
    const scope = document.getElementById("cleanup-scope");
    if (scope) scope.textContent = cleanupScanPath || "—";
    document.getElementById("cleanup-footer")?.classList.add("hidden");
    if (dlg && !dlg.open) dlg.showModal();
    await loadCleanup();
  }

  export async function loadCleanup() {
    const body = document.getElementById("cleanup-body");
    if (!body) return;
    if (!cleanupScanPath) { body.innerHTML = `<div class="py-6 text-center text-sm text-muted-foreground">${t("toasts.openFolderFirst", "Abre una carpeta primero")}</div>`; return; }
    body.innerHTML = `<div class="py-6 text-center text-sm text-muted-foreground">${fmt(t("status.analyzingPath", "Analizando {path}…"), { path: escapeHtml(cleanupScanPath) })}</div>`;
    document.getElementById("cleanup-footer")?.classList.add("hidden");
    const res: any = await api.get("/api/files/cleanup/scan", { params: { path: cleanupScanPath } });
    if (!res.ok) { body.innerHTML = `<div class="py-6 text-center text-sm text-destructive">${escapeHtml(res.error || t("status.error", "Error"))}</div>`; return; }
    renderCleanup(res.data as CleanupData);
  }

  export function renderCleanup(data: CleanupData) {
    const body = document.getElementById("cleanup-body");
    if (!body) return;
    const items = Array.isArray(data?.items) ? data.items : [];
    if (items.length === 0) { body.innerHTML = `<div class="py-6 text-center text-sm text-emerald-600 dark:text-emerald-400">${t("empty.nothingToClean", "✓ Nada que limpiar.")}</div>`; return; }
    const badge = (c: string) => c === "safe"
      ? `<span class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">${t("labels.cleanupSafe", "seguro")}</span>`
      : c === "review"
        ? `<span class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">${t("labels.cleanupReview", "revisar")}</span>`
        : `<span class="rounded bg-zinc-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-500">${t("labels.cleanupKeep", "conservar")}</span>`;
    body.innerHTML = items.map((i) => {
      const checkable = i.classification !== "keep";
      const cb = checkable
        ? `<input type="checkbox" class="cleanup-cb mt-0.5 h-4 w-4 accent-primary" data-cleanup-path="${escapeHtml(i.path)}" data-cleanup-dir="${i.kind === "dir" ? "1" : "0"}" ${i.classification === "safe" ? "checked" : ""} />`
        : `<span class="inline-block w-4"></span>`;
      return `
        <label class="flex items-start gap-2 border-b border-border px-2 py-2 last:border-0 ${checkable ? "cursor-pointer" : ""}">
          ${cb}
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2"><i class="ti ${i.kind === "dir" ? "ti-folder" : "ti-file"} text-sm text-muted-foreground"></i><span class="truncate text-sm font-medium" title="${escapeHtml(i.path)}">${escapeHtml(i.name)}</span>${badge(i.classification)}<span class="ml-auto shrink-0 text-xs text-muted-foreground">${formatBytes(i.sizeBytes)}</span></span>
            <span class="block truncate text-[11px] text-muted-foreground" title="${escapeHtml(i.path)}">${escapeHtml(i.path)}</span>
            <span class="block text-[11px] text-muted-foreground">${escapeHtml(i.reason)}</span>
          </span>
        </label>`;
    }).join("");
    const summary = document.getElementById("cleanup-summary");
    if (summary) summary.textContent = fmt(t("labels.cleanupReclaimable", "Hasta {size} recuperables"), { size: formatBytes(data.reclaimableBytes) }) + (data.truncated ? " · " + t("labels.listTruncated", "lista recortada") : "");
    document.getElementById("cleanup-footer")?.classList.remove("hidden");
  }

  export async function deleteCleanupSelected() {
    const checks = Array.from(document.querySelectorAll<HTMLInputElement>(".cleanup-cb:checked"));
    if (checks.length === 0) { showToast(t("toasts.selectItemsToDelete", "Selecciona elementos a eliminar"), false); return; }
    const ok = await openConfirm(fmt(t("confirm.cleanupDelete", "¿Eliminar {n} elemento(s)? Se respalda cada uno antes (recuperable desde Historial)."), { n: checks.length }), { title: t("confirm.cleanupDeleteTitle", "Eliminar para liberar espacio"), variant: "danger" });
    if (!ok) return;
    let done = 0;
    for (const cb of checks) {
      const p = cb.getAttribute("data-cleanup-path") || "";
      const isDir = cb.getAttribute("data-cleanup-dir") === "1";
      const res: any = await api.delete("/api/files", { path: p, recursive: isDir });
      if (res.ok) done++;
    }
    showToast(fmt(t("toasts.cleanupDeleted", "{done}/{total} eliminados"), { done, total: checks.length }));
    refreshCurrentView();
    await loadCleanup();
  }

  // ── Image optimization ("Optimizar imágenes", #22) ─────────
  export let imageTargetPath = "";
  export let imageCapsLoaded = false;

  export async function ensureImageCaps() {
    const el = document.getElementById("image-caps");
    if (!el || imageCapsLoaded) return;
    const res: any = await api.get("/api/files/images/capabilities");
    if (res.ok) {
      const c = res.data || {};
      const tools = [c.magick ? "ImageMagick" : null, c.cwebp ? "cwebp" : null, c.jpegoptim ? "jpegoptim" : null, c.optipng ? "optipng" : null].filter(Boolean);
      el.textContent = tools.length ? fmt(t("image.toolsAvailable", "Herramientas disponibles: {tools}."), { tools: tools.join(", ") }) : t("image.noToolsInstalled", "⚠ No hay herramientas de imagen instaladas (ImageMagick/cwebp). Las acciones fallarán.");
      imageCapsLoaded = true;
    }
  }

  export async function openImageDialog(filePath: string) {
    imageTargetPath = filePath;
    const dlg = document.getElementById("dialog-image") as HTMLDialogElement | null;
    const scope = document.getElementById("image-scope");
    if (scope) scope.textContent = filePath;
    document.getElementById("image-single")?.classList.remove("hidden");
    document.getElementById("image-single")?.classList.add("flex");
    document.getElementById("image-large")?.classList.add("hidden");
    const result = document.getElementById("image-result");
    if (result) result.textContent = "";
    if (dlg && !dlg.open) dlg.showModal();
    await ensureImageCaps();
  }

  export async function openImageScanDialog(dir: string) {
    const dlg = document.getElementById("dialog-image") as HTMLDialogElement | null;
    const scope = document.getElementById("image-scope");
    if (scope) scope.textContent = dir;
    document.getElementById("image-single")?.classList.add("hidden");
    document.getElementById("image-single")?.classList.remove("flex");
    const large = document.getElementById("image-large");
    if (large) { large.classList.remove("hidden"); large.innerHTML = `<div class="py-4 text-center text-sm text-muted-foreground">${t("status.scanningImages", "Buscando imágenes pesadas…")}</div>`; }
    if (dlg && !dlg.open) dlg.showModal();
    await ensureImageCaps();
    const res: any = await api.get("/api/files/images/scan", { params: { path: dir } });
    if (!large) return;
    if (!res.ok) { large.innerHTML = `<div class="py-4 text-center text-sm text-destructive">${escapeHtml(res.error || t("status.error", "Error"))}</div>`; return; }
    const imgs: Array<{ path: string; name: string; sizeBytes: number }> = res.data || [];
    if (imgs.length === 0) { large.innerHTML = `<div class="py-4 text-center text-sm text-emerald-600 dark:text-emerald-400">${t("empty.noHeavyImages", "✓ Sin imágenes pesadas.")}</div>`; return; }
    large.innerHTML = imgs.map((im) => `
      <div class="flex items-center justify-between gap-2 border-b border-border py-1.5 last:border-0">
        <span class="min-w-0 truncate text-sm"><i class="ti ti-photo"></i> ${escapeHtml(im.name)} <span class="text-xs text-muted-foreground">${formatBytes(im.sizeBytes)}</span></span>
        <button type="button" data-img-large="${escapeHtml(im.path)}" class="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs hover:bg-accent">${t("actions.optimize", "Optimizar")}</button>
      </div>`).join("");
  }

  export function onImageLargeClick(ev: Event) {
    const target = (ev.target as HTMLElement | null)?.closest("[data-img-large]") as HTMLElement | null;
    if (!target) return;
    const p = target.getAttribute("data-img-large") || "";
    if (p) void openImageDialog(p);
  }

  export async function onImageOpClick(ev: Event) {
    const target = (ev.target as HTMLElement | null)?.closest("[data-img-op]") as HTMLElement | null;
    if (!target || !imageTargetPath) return;
    const op = target.getAttribute("data-img-op") || "";
    const result = document.getElementById("image-result");
    const quality = Number((document.getElementById("image-quality") as HTMLInputElement | null)?.value || "80");
    const width = Number((document.getElementById("image-width") as HTMLInputElement | null)?.value || "1280");
    const body: any = { path: imageTargetPath, op };
    if (op === "webp" || op === "compress") body.quality = quality;
    if (op === "resize") body.width = width;
    if (op === "responsive") body.widths = [480, 768, 1280];
    if (result) result.textContent = t("status.processing", "Procesando…");
    const res: any = await api.post("/api/files/images/process", body);
    if (!res.ok) { if (result) result.textContent = res.error || t("status.error", "Error"); return; }
    const d = res.data || {};
    let msg = t("status.done", "Hecho.");
    if (d.beforeBytes && d.afterBytes) {
      const saved = d.beforeBytes - d.afterBytes;
      const pct = d.beforeBytes ? Math.round((saved / d.beforeBytes) * 100) : 0;
      msg = `${formatBytes(d.beforeBytes)} → ${formatBytes(d.afterBytes)} (${pct >= 0 ? "-" : "+"}${Math.abs(pct)}%)`;
    } else if (d.dest) {
      msg = fmt(t("labels.createdFile", "Creado: {name}"), { name: d.dest.split("/").pop() });
    } else if (Array.isArray(d.outputs)) {
      msg = fmt(t("labels.variantsGenerated", "{n} variante(s) generada(s)"), { n: d.outputs.length });
    }
    if (result) result.textContent = msg;
    showToast(t("toasts.imageProcessed", "Imagen procesada"));
    refreshCurrentView();
  }

  // ── Tags + comments ("Etiquetas y nota", #23/#24) ──────────
  export let metaPath = "";
  export let metaTags: string[] = [];

  export function renderMetaTags() {
    const el = document.getElementById("meta-tags");
    if (!el) return;
    el.innerHTML = metaTags.length === 0
      ? `<span class="text-xs text-muted-foreground">${t("empty.noTags", "Sin etiquetas")}</span>`
      : metaTags.map((t) => `<span class="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">${escapeHtml(t)}<button type="button" data-rm-tag="${escapeHtml(t)}" class="hover:text-destructive">×</button></span>`).join("");
  }
  export function addMetaTag(t: string) {
    const tag = t.trim().slice(0, 40);
    if (tag && !metaTags.includes(tag)) { metaTags.push(tag); renderMetaTags(); }
  }
  export function removeMetaTag(t: string) {
    metaTags = metaTags.filter((x) => x !== t);
    renderMetaTags();
  }

  export async function openMetaDialog(path: string) {
    metaPath = path;
    metaTags = [];
    const dlg = document.getElementById("dialog-meta") as HTMLDialogElement | null;
    const scope = document.getElementById("meta-scope");
    const comment = document.getElementById("meta-comment") as HTMLTextAreaElement | null;
    if (scope) scope.textContent = path;
    if (comment) comment.value = "";
    renderMetaTags();
    if (dlg && !dlg.open) dlg.showModal();
    const res: any = await api.get("/api/files/meta", { params: { path } });
    if (res.ok && res.data) {
      metaTags = Array.isArray(res.data.tags) ? res.data.tags : [];
      if (comment) comment.value = res.data.comment || "";
      renderMetaTags();
    }
  }

  export async function saveMeta() {
    if (!metaPath) return;
    const comment = (document.getElementById("meta-comment") as HTMLTextAreaElement | null)?.value || "";
    const res: any = await api.put("/api/files/meta", { path: metaPath, tags: metaTags, comment });
    if (res.ok) { showToast(t("toasts.tagsSaved", "Etiquetas guardadas")); (document.getElementById("dialog-meta") as HTMLDialogElement | null)?.close(); }
    else showToast(res.error || t("toasts.saveError2", "No se pudo guardar"), false);
  }

  // ── Client/dev UI mode ("Modo del navegador", #25) ─────────
  export function applyFilesMode() {
    for (const id of CLIENT_HIDDEN_BTNS) {
      const el = document.getElementById(id) as HTMLElement | null;
      if (el) el.style.display = S.filesClientMode ? "none" : "";
    }
    const sel = document.getElementById("files-mode-select") as HTMLSelectElement | null;
    if (sel) sel.value = S.filesClientMode ? "client" : "developer";
  }

  // ── Share links ("Compartir con enlace temporal", #17) ─────
  export let shareTargetPath = "";

  export async function openShareDialog(filePath: string) {
    const policy = await api.get<{ sharingEnabled: boolean; shareMaxExpiryMin: number; sharePasswordRequired: boolean }>("/api/files/config/effective");
    if (policy.ok && policy.data?.sharingEnabled === false) {
      showToast(t("settings.operation.sharingDisabled", "Los enlaces compartidos están desactivados en este servidor"), false);
      return;
    }
    const expiry = document.getElementById("share-expiry") as HTMLSelectElement | null;
    if (expiry && policy.ok && policy.data) {
      for (const option of Array.from(expiry.options)) option.disabled = Number(option.value) > policy.data.shareMaxExpiryMin;
      if (expiry.selectedOptions[0]?.disabled) expiry.value = Array.from(expiry.options).find((option) => !option.disabled)?.value || "60";
    }
    const password = document.getElementById("share-password") as HTMLInputElement | null;
    if (password) password.required = policy.ok && policy.data?.sharePasswordRequired === true;
    shareTargetPath = filePath;
    const dlg = document.getElementById("dialog-share") as HTMLDialogElement | null;
    const scope = document.getElementById("share-scope");
    const result = document.getElementById("share-result");
    if (scope) scope.textContent = filePath;
    result?.classList.add("hidden");
    if (dlg && !dlg.open) dlg.showModal();
    // Populate the public-root selector.
    const sel = document.getElementById("share-root") as HTMLSelectElement | null;
    if (sel) {
      sel.innerHTML = `<option value="">${t("status.loading", "Cargando…")}</option>`;
      const res: any = await api.get("/api/files/share/roots");
      const roots: Array<{ root: string; domain: string; ssl: boolean }> = res.ok ? res.data : [];
      sel.innerHTML = roots.length
        ? roots.map((r) => `<option value="${escapeHtml(r.root)}">${escapeHtml(r.domain)} — ${escapeHtml(r.root)}</option>`).join("")
        : `<option value="">${t("empty.noNginxRoots", "(sin raíces públicas NGINX)")}</option>`;
      // Prefer the root that contains the file.
      const containing = roots.find((r) => filePath.startsWith(r.root.replace(/\/+$/, "") + "/"));
      if (containing) sel.value = containing.root;
    }
    await loadShares();
  }

  export async function createShare() {
    const root = (document.getElementById("share-root") as HTMLSelectElement | null)?.value || "";
    if (!root) { showToast(t("toasts.selectPublicRoot", "Selecciona una raíz pública"), false); return; }
    const expiresInMin = Number((document.getElementById("share-expiry") as HTMLSelectElement | null)?.value || "60");
    const maxDownloads = Number((document.getElementById("share-max") as HTMLInputElement | null)?.value || "0");
    const password = (document.getElementById("share-password") as HTMLInputElement | null)?.value || "";
    const body: any = { path: shareTargetPath, root, expiresInMin, maxDownloads };
    if (password) body.password = password;
    const res: any = await api.post("/api/files/share", body);
    if (!res.ok) { showToast(res.error || t("toasts.shareLinkError", "No se pudo crear el enlace"), false); return; }
    const url = res.data?.url || "";
    const result = document.getElementById("share-result");
    const urlEl = document.getElementById("share-url") as HTMLInputElement | null;
    if (urlEl) urlEl.value = url;
    result?.classList.remove("hidden");
    result?.classList.add("flex");
    showToast(t("toasts.shareLinkCreated", "Enlace creado"));
    await loadShares();
  }

  export async function loadShares() {
    const el = document.getElementById("share-list");
    if (!el) return;
    const res: any = await api.get("/api/files/share");
    if (!res.ok) { el.innerHTML = `<div class="py-2 text-center text-xs text-destructive">${escapeHtml(res.error || t("status.error", "Error"))}</div>`; return; }
    const items: Array<{ id: string; filename: string; url: string; domain: string; expiresAt: string; maxDownloads: number; downloadCount?: number; revoked?: boolean }> = res.data || [];
    if (items.length === 0) { el.innerHTML = `<div class="py-2 text-center text-xs text-muted-foreground">${t("empty.noShareLinks", "Sin enlaces.")}</div>`; return; }
    const now = Date.now();
    el.innerHTML = items.map((s) => {
      const exp = new Date(s.expiresAt).getTime();
      const status = s.revoked ? `<span class="text-destructive">${t("labels.shareRevoked", "revocado")}</span>` : exp < now ? `<span class="text-amber-600 dark:text-amber-400">${t("labels.shareExpired", "expirado")}</span>` : `<span class="text-emerald-600 dark:text-emerald-400">${t("labels.shareActive", "activo")}</span>`;
      const dl = `${s.downloadCount ?? 0}${s.maxDownloads ? "/" + s.maxDownloads : ""}`;
      return `
        <div class="flex items-center justify-between gap-2 border-b border-border py-1.5 last:border-0">
          <span class="min-w-0 truncate text-xs"><i class="ti ti-link"></i> ${escapeHtml(s.filename)} <span class="text-muted-foreground">· ${status} · ${dl} ${escapeHtml(t("share.downloadsAbbrev", "desc."))}</span></span>
          <span class="flex shrink-0 gap-1">
            <button type="button" data-share-copy="${escapeHtml(s.url)}" class="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-accent">${t("actions.copyLink", "Copiar")}</button>
            ${s.revoked ? "" : `<button type="button" data-share-revoke="${escapeHtml(s.id)}" class="rounded-md border border-border px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10">${t("actions.revoke", "Revocar")}</button>`}
          </span>
        </div>`;
    }).join("");
  }

  export async function onShareListClick(ev: Event) {
    const copyBtn = (ev.target as HTMLElement | null)?.closest("[data-share-copy]") as HTMLElement | null;
    if (copyBtn) {
      const u = copyBtn.getAttribute("data-share-copy") || "";
      try { await navigator.clipboard.writeText(u); showToast(t("toasts.urlCopied", "URL copiada")); } catch { showToast(t("toasts.copyFailed", "No se pudo copiar"), false); }
      return;
    }
    const revBtn = (ev.target as HTMLElement | null)?.closest("[data-share-revoke]") as HTMLElement | null;
    if (revBtn) {
      const id = revBtn.getAttribute("data-share-revoke") || "";
      const ok = await openConfirm(t("confirm.revokeLink", "¿Revocar este enlace? Dejará de funcionar de inmediato."), { title: t("confirm.revokeLinkTitle", "Revocar enlace"), variant: "danger" });
      if (!ok) return;
      const res: any = await api.post(`/api/files/share/${encodeURIComponent(id)}/revoke`);
      if (res.ok) { showToast(t("toasts.linkRevoked", "Enlace revocado")); await loadShares(); }
      else showToast(res.error || t("toasts.revokeError", "No se pudo revocar"), false);
    }
  }
