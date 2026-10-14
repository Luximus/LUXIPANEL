// Module-dev page — render: assistant links list + installed previews list.
import { state, moduleForCode } from "./state";
import { t, esc, fmtDate, statusBadge, $ } from "./dom";

// ── Render: tabla "Mis módulos" ──────────────────────────────────────────────
export function actionBtn(action: string, code: string, icon: string, label: string, extra = ""): string {
  return `<button data-md-action="${esc(action)}" data-code="${esc(code)}" title="${esc(label)}"
    class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-accent ${extra}">
    <i class="ti ${esc(icon)} text-sm"></i><span class="hidden xl:inline">${esc(label)}</span>
  </button>`;
}

// ── Render: vínculos del asistente ───────────────────────────────────────────
export function renderLinks() {
  const box = $("md-links");
  if (!box) return;
  if (state.links.length === 0) {
    box.innerHTML = `<p class="px-4 py-8 text-center text-sm text-muted-foreground">${esc(t("common.linksEmpty", "Ningún proyecto vinculado todavía. Usa /mod vincular <slug> en el asistente."))}</p>`;
    return;
  }
  box.innerHTML = state.links
    .map((link) => {
      const inLp = moduleForCode(link.moduleId);
      const extras: string[] = [];
      if (!inLp && state.marketplaceAvailable) {
        extras.push(actionBtn("submit", link.moduleId, "ti-send", t("actions.submit", "Enviar"), "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"));
      }
      extras.push(actionBtn("checks", link.moduleId, "ti-checklist", t("actions.checks", "Validar")));
      extras.push(actionBtn("test", link.moduleId, "ti-flask", t("actions.test", "Probar tests")));
      extras.push(actionBtn("preview", link.moduleId, "ti-package-import", t("actions.preview", "Instalar preview")));
      extras.push(actionBtn("chat", link.moduleId, "ti-robot", t("actions.openChat", "Abrir en el asistente")));
      const lpState = inLp
        ? statusBadge(inLp.reviewStatus)
        : `<span class="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">${esc(t("common.notSubmitted", "Sin enviar"))}</span>`;
      const previewReady = state.previews.some((preview) => preview.moduleId === link.moduleId);
      const releaseSteps = [
        [t("release.linkedProject", "Proyecto vinculado"), true],
        [t("release.validateManifest", "Validar manifest"), false],
        [t("release.runTests", "Ejecutar tests"), false],
        [t("release.preview", "Preview"), previewReady],
        [t("release.submitted", "Enviado"), !!inLp],
      ] as const;
      return `<div class="flex flex-col gap-2 rounded-lg px-3 py-2.5 hover:bg-accent/40">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-sm font-medium">${esc(link.moduleId)}</span>
          ${lpState}
          <span class="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">${esc(link.provider)}</span>
        </div>
        <p class="truncate text-xs text-muted-foreground" title="${esc(link.projectPath)}">
          ${esc(t("common.project", "Proyecto"))}: <span class="font-mono">${esc(link.projectId)}</span> · ${esc(t("common.path", "Ruta"))}: <span class="font-mono">${esc(link.projectPath)}</span>
        </p>
        <div class="flex flex-wrap gap-1.5" aria-label="${esc(t("release.ariaLabel", "Preparación del módulo"))}">${releaseSteps.map(([label, done], index) => `<span class="rounded-full border px-2 py-0.5 text-[11px] ${done ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-border text-muted-foreground"}">${index + 1}. ${esc(label)}${done ? " ✓" : ""}</span>`).join("")}</div>
        <div class="flex flex-wrap items-center gap-1.5">${extras.join(" ")}</div>
      </div>`;
    })
    .join("");
}

// ── Render: previews instaladas ──────────────────────────────────────────────
export function renderPreviews() {
  const box = $("md-previews");
  if (!box) return;
  if (state.previews.length === 0) {
    box.innerHTML = `<p class="px-4 py-8 text-center text-sm text-muted-foreground">${esc(t("common.previewsEmpty", "No hay previews instaladas."))}</p>`;
    return;
  }
  box.innerHTML = state.previews
    .map(
      (preview) => `<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5 hover:bg-accent/40">
        <div class="min-w-0">
          <span class="block truncate font-mono text-sm font-medium">${esc(preview.moduleId)}</span>
          <span class="block truncate text-xs text-muted-foreground">
            ${preview.projectId ? `${esc(t("common.project", "Proyecto"))}: <span class="font-mono">${esc(preview.projectId)}</span> · ` : ""}${esc(t("common.installedAt", "Instalada"))}: ${esc(fmtDate(preview.installedAt))}
          </span>
        </div>
        <button data-md-action="preview-uninstall" data-code="${esc(preview.moduleId)}" title="${esc(t("actions.uninstallPreview", "Desinstalar preview"))}"
          class="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10">
          <i class="ti ti-trash text-sm"></i><span class="hidden sm:inline">${esc(t("actions.uninstallPreview", "Desinstalar preview"))}</span>
        </button>
      </div>`,
    )
    .join("");
}
