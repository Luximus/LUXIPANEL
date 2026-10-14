// Module-dev page — result dialog: checks (manifest validation) / tests / preview
// install + uninstall.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm as openConfirmDialog } from "/scripts/extracted/lib/confirm.js";
import { linkForModule } from "./state";
import type {
  ChecksRunResult, TestRunResult, PreviewInstallResult,
  ManifestValidationResult, ManifestValidationIssue,
} from "./state";
import { t, fmt, esc, showToast, fmtBytes, fmtDuration, $ } from "./dom";
import { loadPreviews } from "./data";

// ── Diálogo de resultado (tests / validación / preview) ──────────────────────
export function openResultDialog(title: string) {
  const dlg = $("dlg-md-result") as HTMLDialogElement | null;
  if (!dlg) return;
  const titleEl = $("md-result-title");
  if (titleEl) titleEl.textContent = title;
  const body = $("md-result-body");
  if (body) {
    body.innerHTML = `<p class="flex items-center gap-2 text-sm text-muted-foreground">
      <i class="ti ti-loader animate-spin text-base"></i> ${esc(t("modals.working", "Ejecutando…"))}
    </p>`;
  }
  if (!dlg.open) dlg.showModal();
}

export function setResultBody(html: string) {
  const body = $("md-result-body");
  if (body) body.innerHTML = html;
}

export function resultError(message: string) {
  setResultBody(`<p class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">${esc(message)}</p>`);
}

export function issueList(title: string, issues: ManifestValidationIssue[], cls: string): string {
  if (!issues.length) return "";
  const items = issues
    .map(
      (issue) => `<li class="flex items-start gap-2">
        <code class="shrink-0 rounded bg-muted/60 px-1.5 py-0.5 text-[11px]">${esc(issue.path || "—")}</code>
        <span>${esc(issue.message)}</span>
      </li>`,
    )
    .join("");
  return `<div class="mb-3">
    <p class="mb-1.5 text-xs font-semibold uppercase tracking-wide ${cls}">${esc(title)}</p>
    <ul class="flex flex-col gap-1.5 text-xs">${items}</ul>
  </div>`;
}

export function validationHtml(validation: ManifestValidationResult): string {
  const badge = validation.valid
    ? `<span class="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500"><i class="ti ti-check text-sm"></i> ${esc(t("modals.validationValid", "Manifest válido"))}</span>`
    : `<span class="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"><i class="ti ti-x text-sm"></i> ${esc(t("modals.validationInvalid", "Manifest inválido"))}</span>`;
  return `<div class="mb-3">${badge}</div>
    ${issueList(t("modals.errors", "Errores"), validation.errors ?? [], "text-destructive")}
    ${issueList(t("modals.warnings", "Avisos"), validation.warnings ?? [], "text-amber-600 dark:text-amber-400")}`;
}

/** Resuelve el projectId del link de un módulo, con aviso si no existe. */
export function requireProjectId(code: string): string | null {
  const link = linkForModule(code);
  if (!link) {
    showToast(t("common.requiresLink", "Requiere un proyecto del asistente vinculado a este módulo."), false);
    return null;
  }
  return link.projectId;
}

export async function runChecks(code: string) {
  const projectId = requireProjectId(code);
  if (!projectId) return;
  openResultDialog(`${t("modals.checksTitle", "Validación del módulo")} — ${code}`);
  const res = await api.post<ChecksRunResult>("/api/module-dev/checks/run", { projectId });
  if (!res.ok || !res.data) {
    resultError(res.error ?? t("toasts.actionFailed", "La operación falló"));
    return;
  }
  const checks = res.data;
  const notes = (checks.notes ?? []).length
    ? `<div class="mt-3">
        <p class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">${esc(t("modals.notes", "Notas"))}</p>
        <ul class="flex flex-col gap-1 text-xs text-muted-foreground">${checks.notes.map((note: string) => `<li>• ${esc(note)}</li>`).join("")}</ul>
      </div>`
    : "";
  setResultBody(`${validationHtml(checks.validation ?? { valid: false, errors: [], warnings: [] })}${notes}`);
}

export async function runTests(code: string) {
  const projectId = requireProjectId(code);
  if (!projectId) return;
  openResultDialog(`${t("modals.testTitle", "Resultado de los tests")} — ${code}`);
  const res = await api.post<TestRunResult>("/api/module-dev/tests/run", { projectId });
  if (!res.ok || !res.data) {
    resultError(res.error ?? t("toasts.actionFailed", "La operación falló"));
    return;
  }
  const result = res.data;
  const badge = result.passed
    ? `<span class="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500"><i class="ti ti-check text-sm"></i> ${esc(t("modals.passed", "Tests OK"))}</span>`
    : result.timedOut
      ? `<span class="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"><i class="ti ti-clock-pause text-sm"></i> ${esc(t("modals.timedOut", "Tiempo agotado"))}</span>`
      : `<span class="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"><i class="ti ti-x text-sm"></i> ${esc(t("modals.failed", "Tests fallidos"))}</span>`;
  const pre = (label: string, content: string) =>
    content
      ? `<div class="mt-3">
          <p class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">${esc(label)}</p>
          <pre class="max-h-56 overflow-auto rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap">${esc(content)}</pre>
        </div>`
      : "";
  setResultBody(`<div class="mb-3 flex flex-wrap items-center gap-2">${badge}</div>
    <div class="grid gap-2 text-xs sm:grid-cols-3">
      <div class="rounded-lg border border-border px-3 py-2">
        <p class="text-muted-foreground">${esc(t("modals.command", "Comando"))}</p>
        <p class="truncate font-mono" title="${esc(result.command)}">${esc(result.command || "—")}</p>
      </div>
      <div class="rounded-lg border border-border px-3 py-2">
        <p class="text-muted-foreground">${esc(t("modals.exitCode", "Código de salida"))}</p>
        <p class="font-mono">${result.exitCode === null ? "—" : esc(result.exitCode)}</p>
      </div>
      <div class="rounded-lg border border-border px-3 py-2">
        <p class="text-muted-foreground">${esc(t("modals.duration", "Duración"))}</p>
        <p class="font-mono">${esc(fmtDuration(result.durationMs))}</p>
      </div>
    </div>
    ${pre("stdout", result.stdout)}
    ${pre("stderr", result.stderr)}`);
}

export async function installPreview(code: string) {
  const projectId = requireProjectId(code);
  if (!projectId) return;
  openResultDialog(`${t("modals.previewTitle", "Instalación preview")} — ${code}`);
  const res = await api.post<PreviewInstallResult>("/api/module-dev/preview/install", { projectId });
  if (!res.ok || !res.data) {
    resultError(res.error ?? t("toasts.actionFailed", "La operación falló"));
    return;
  }
  const data = res.data;
  const warnings = (data.warnings ?? []).length
    ? issueList(
        t("modals.warnings", "Avisos"),
        data.warnings.map((message: string) => ({ path: "", message })),
        "text-amber-600 dark:text-amber-400",
      )
    : "";
  setResultBody(`<p class="mb-3 text-sm">${esc(
    fmt(t("modals.previewInstalledBody", "Módulo {code} instalado en preview ({files} archivos). Solo tú puedes verlo e invocarlo."), {
      code: data.moduleId || code,
      files: data.files ?? 0,
    }),
  )} <span class="text-xs text-muted-foreground">(${esc(fmtBytes(data.bytes ?? 0))})</span></p>
  ${warnings}`);
  showToast(t("toasts.previewInstalled", "Preview instalada"));
  await loadPreviews();
}

export async function uninstallPreview(moduleId: string) {
  const message = fmt(t("common.confirmUninstallPreview", "¿Desinstalar la preview del módulo {code}?"), { code: moduleId });
  if (!(await openConfirmDialog(message, { title: t("common.uninstallPreview", "Desinstalar preview"), confirmText: t("common.uninstall", "Desinstalar"), variant: "danger" }))) return;
  const res = await api.post("/api/module-dev/preview/uninstall", { moduleId });
  if (!res.ok) {
    showToast(res.error ?? t("toasts.actionFailed", "La operación falló"), false);
    return;
  }
  showToast(t("toasts.previewUninstalled", "Preview desinstalada"));
  await loadPreviews();
}
