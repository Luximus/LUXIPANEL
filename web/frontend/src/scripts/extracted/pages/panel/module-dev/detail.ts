// Module-dev page — module detail dialog (review event/version timeline).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { moduleForCode } from "./state";
import type { DevModuleReviews } from "./state";
import { t, esc, fmtDate, statusBadge, $ } from "./dom";

// ── Detalle del módulo (timeline de eventos de revisión) ─────────────────────
export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value) return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

export function renderEvent(eventRaw: unknown): string {
  const event = asRecord(eventRaw);
  const kind = pickString(event, ["kind", "type"]) || t("events.kind", "Evento");
  const result = pickString(event, ["result", "status"]);
  const reviewer = pickString(event, ["reviewer", "reviewerName", "reviewerId", "actor"]);
  const createdAt = pickString(event, ["createdAt", "created_at", "at"]);
  const detailValue = event.detail ?? event.notes ?? event.message ?? null;
  const detailText =
    typeof detailValue === "string"
      ? detailValue
      : detailValue != null
        ? JSON.stringify(detailValue, null, 2)
        : "";
  const resultBadge = result
    ? `<span class="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">${esc(t("events.result", "Resultado"))}: ${esc(result)}</span>`
    : "";
  const reviewerHtml = reviewer
    ? ` · ${esc(t("events.reviewer", "Revisor"))}: <span class="font-medium">${esc(reviewer)}</span>`
    : "";
  const detailHtml = detailText
    ? `<details class="mt-1.5">
        <summary class="cursor-pointer text-xs text-primary hover:underline">${esc(t("events.detail", "Detalle"))}</summary>
        <pre class="mt-1 max-h-40 overflow-auto rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">${esc(detailText)}</pre>
      </details>`
    : "";
  return `<li class="relative pb-4 pl-5 last:pb-0">
    <span class="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-primary/70"></span>
    <span class="absolute bottom-0 left-[3px] top-4 w-px bg-border"></span>
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-sm font-medium">${esc(kind)}</span>
      ${resultBadge}
    </div>
    <p class="mt-0.5 text-xs text-muted-foreground">${esc(fmtDate(createdAt))}${reviewerHtml}</p>
    ${detailHtml}
  </li>`;
}

export function renderVersion(versionRaw: unknown): string {
  const version = asRecord(versionRaw);
  const ver = pickString(version, ["version", "semver"]) || "—";
  const versionStatus = pickString(version, ["reviewStatus", "status"]);
  const createdAt = pickString(version, ["createdAt", "created_at", "submittedAt"]);
  const prUrl = pickString(version, ["prUrl", "pr_url"]);
  return `<li class="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
    <span class="font-mono font-medium">${esc(ver)}</span>
    ${versionStatus ? statusBadge(versionStatus) : ""}
    <span class="text-muted-foreground">${esc(fmtDate(createdAt))}</span>
    ${prUrl ? `<a href="${esc(prUrl)}" target="_blank" rel="noopener noreferrer" class="ml-auto inline-flex items-center gap-1 text-primary hover:underline"><i class="ti ti-git-pull-request text-sm"></i> PR</a>` : ""}
  </li>`;
}

export async function openDetail(code: string) {
  const dlg = $("dlg-md-detail") as HTMLDialogElement | null;
  if (!dlg) return;
  const title = $("md-detail-title");
  if (title) title.textContent = code;
  const statusEl = $("md-detail-status");
  const mod = moduleForCode(code);
  if (statusEl) statusEl.innerHTML = mod ? statusBadge(mod.reviewStatus) : "";
  const body = $("md-detail-body");
  if (body) body.innerHTML = `<p class="text-sm text-muted-foreground">${esc(t("events.loading", "Cargando eventos…"))}</p>`;
  if (!dlg.open) dlg.showModal();

  const res = await api.get<DevModuleReviews>(`/api/module-dev/modules/${encodeURIComponent(code)}/reviews`);
  if (!body) return;
  if (!res.ok || !res.data) {
    body.innerHTML = `<p class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">${esc(res.error ?? t("toasts.actionFailed", "La operación falló"))}</p>`;
    return;
  }
  const reviews = res.data;
  if (statusEl && reviews.module?.reviewStatus) statusEl.innerHTML = statusBadge(reviews.module.reviewStatus);
  const staleNote = reviews.stale
    ? `<p class="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">${esc(t("common.staleBanner", "Datos en caché — el servidor de licencias no responde."))}</p>`
    : "";
  const versions = (reviews.versions ?? []).length
    ? `<div class="mb-4">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">${esc(t("events.versions", "Versiones"))}</p>
        <ul class="flex flex-col gap-1.5">${reviews.versions.map(renderVersion).join("")}</ul>
      </div>`
    : "";
  const events = (reviews.events ?? []).length
    ? `<div>
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">${esc(t("events.title", "Eventos de revisión"))}</p>
        <ul class="flex flex-col">${reviews.events.map(renderEvent).join("")}</ul>
      </div>`
    : `<p class="text-sm text-muted-foreground">${esc(t("events.empty", "Sin eventos de revisión todavía."))}</p>`;
  body.innerHTML = `${staleNote}${versions}${events}`;
}
