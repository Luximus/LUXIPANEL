// Module-dev page — shared i18n + DOM/formatting helpers + review-status badge.
// The i18n trio (F-03/T-08), the toast (F-04), the HTML escaper (F-02) and `$`
// (E-06) come from the shared extracted libs; only the module-specific bindings
// (the `md-i18n` payload id, the review-status badge) stay here. `esc` keeps its
// name but is now the canonical 5-character escaper (it also escapes `'`).
import type { ReviewStatus } from "./state";
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
import { escapeHtml } from "/scripts/extracted/lib/escape.js";

// ── i18n (payload embebido por la página; fallback ES si falta) ─────────────
export const { loadI18n, t, fmt } = createPageI18n("md-i18n");

// ── Helpers ──────────────────────────────────────────────────────────────────
export const esc = escapeHtml;

export { $ } from "/scripts/extracted/lib/dom.js";
export { showToast } from "/scripts/extracted/lib/toast.js";

export function fmtDate(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(document.documentElement.lang || undefined);
}

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

// Badge por reviewStatus (enviado/revision=azul, correccion=ámbar,
// publico=verde, inactivo=gris, suspendido=rojo).
export const STATUS_BADGE: Record<ReviewStatus, string> = {
  enviado: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  revision: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  correccion: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  publico: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  inactivo: "border-border bg-muted/40 text-muted-foreground",
  suspendido: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function statusBadge(status: ReviewStatus | string): string {
  const cls = STATUS_BADGE[status as ReviewStatus] ?? STATUS_BADGE.inactivo;
  const label = t(`states.${status}`, String(status));
  return `<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}">${esc(label)}</span>`;
}
