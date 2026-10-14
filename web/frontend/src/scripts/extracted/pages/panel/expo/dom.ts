// Expo page — shared DOM / i18n / formatting helpers. Imports only PAGE_SIZE from
// the state hub; no cross-submodule imports, so every submodule imports it freely.
// The i18n trio (F-03/T-08), the toast (F-04), the HTML escaper (F-02), `$`/`dlg`
// (E-06) and `tsOf` (E-05) come from the shared extracted libs; only the
// module-specific bindings stay here. `esc` keeps its name but is now the
// canonical 5-character escaper (it also escapes `'`).
import { PAGE_SIZE } from "./state";
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
import { escapeHtml } from "/scripts/extracted/lib/escape.js";
import { $ } from "/scripts/extracted/lib/dom.js";

export const { loadI18n, t, fmt } = createPageI18n("expo-i18n");
/**
 * Shared pagination footer. Buttons get ids `${idPrefix}-prev` / `${idPrefix}-next`
 * which the delegated click handler turns into page changes. Returns "" when a
 * single page (no footer needed).
 */
export function paginationFooter(idPrefix: string, page: number, total: number): string {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (totalPages <= 1) return "";
  const from = page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const cls =
    "inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 font-medium hover:bg-accent disabled:opacity-40 disabled:pointer-events-none";
  return `<div class="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground">
    <span>${esc(fmt(t("common.paginationRange", "{from}–{to} de {total}"), { from, to, total }))}</span>
    <div class="flex items-center gap-2">
      <button id="${idPrefix}-prev" class="${cls}"${page === 0 ? " disabled" : ""}><i class="ti ti-chevron-left text-sm"></i> ${esc(t("common.prev", "Anterior"))}</button>
      <span class="tabular-nums">${esc(fmt(t("common.paginationPage", "Página {page} de {total}"), { page: page + 1, total: totalPages }))}</span>
      <button id="${idPrefix}-next" class="${cls}"${page >= totalPages - 1 ? " disabled" : ""}>${esc(t("common.next", "Siguiente"))} <i class="ti ti-chevron-right text-sm"></i></button>
    </div>
  </div>`;
}

/** Clamp a page index to a valid range for a list of `total` items. */
export function clampPage(page: number, total: number): number {
  return Math.min(Math.max(0, page), Math.max(0, Math.ceil(total / PAGE_SIZE) - 1));
}
export { tsOf } from "/scripts/extracted/lib/time.js";
// ── Helpers ─────────────────────────────────────────────────────────────────
export const esc = escapeHtml;

/** Format an ISO timestamp as a clear, locale-aware "19 jun 2026, 22:10".
 *  Uses the active panel locale (`<html lang>`, set by the layout) so build
 *  dates follow the user's language — same idiom as the cron module. */
export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(document.documentElement.lang || "es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export { showToast } from "/scripts/extracted/lib/toast.js";
export { $, dlg, openDialog, closeDialog } from "/scripts/extracted/lib/dom.js";

// ── Loading skeletons ─────────────────────────────────────────────────────────
/** A single shimmering placeholder bar (Tailwind `animate-pulse`). */
export function skelBar(cls: string): string {
  return `<div class="animate-pulse rounded bg-muted ${cls}"></div>`;
}

/** Skeleton rows that mimic a table/list while a query runs. */
export function tableSkeleton(rows = 6, cols = 5): string {
  const row = `<div class="flex items-center gap-3 border-t border-border px-3 py-2.5">${Array.from(
    { length: cols },
    (_, i) => skelBar(`h-3.5 ${i === 0 ? "w-28" : i === cols - 1 ? "ml-auto w-14" : "w-20"}`),
  ).join("")}</div>`;
  return `<div>${Array.from({ length: rows }, () => row).join("")}</div>`;
}

/** Skeleton cards that mimic the projects list while it loads. */
export function projectsSkeleton(rows = 3): string {
  const row = `<div class="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
    <div class="min-w-0 space-y-2">${skelBar("h-4 w-40")}${skelBar("h-3 w-56")}${skelBar("h-3 w-20")}</div>
    <div class="flex gap-1.5">${skelBar("h-6 w-16")}${skelBar("h-6 w-16")}${skelBar("h-6 w-12")}</div>
  </div>`;
  return Array.from({ length: rows }, () => row).join("");
}

/** Toggle the spinning state + disabled on a refresh button (and its ti-refresh icon). */
export function setRefreshing(btnId: string, on: boolean): void {
  const btn = $(btnId) as HTMLButtonElement | null;
  if (!btn) return;
  btn.disabled = on;
  btn.classList.toggle("opacity-60", on);
  btn.querySelector("i.ti-refresh")?.classList.toggle("animate-spin", on);
}

/** Run a refresh load with the button spinning until it settles. */
export async function refreshWith(btnId: string, fn: () => Promise<void>): Promise<void> {
  setRefreshing(btnId, true);
  try {
    await fn();
  } finally {
    setRefreshing(btnId, false);
  }
}

export function readFileText(input: HTMLInputElement | null): Promise<string | null> {
  return new Promise((resolve) => {
    const file = input?.files?.[0];
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}
/** Fill a <select> with distinct option values, preserving the current choice. */
export function syncFilterOptions(id: string, values: string[], allLabel: string, labelFor: (value: string) => string = (value) => value) {
  const sel = $(id) as HTMLSelectElement | null;
  if (!sel) return;
  const current = sel.value;
  const opts = Array.from(new Set(values.filter(Boolean))).sort();
  sel.innerHTML =
    `<option value="">${esc(allLabel)}</option>` +
    opts.map((v) => `<option value="${esc(v)}">${esc(labelFor(v))}</option>`).join("");
  sel.value = opts.includes(current) ? current : "";
}

export function expoProfileLabel(value: string): string {
  return value === "development" ? t("build.profileDev", "Development")
    : value === "production" ? t("build.profileProd", "Production") : value;
}

export function expoBuildStatusLabel(value: string): string {
  const key: Record<string, string> = {
    new: "new", "in-queue": "inQueue", "in-progress": "inProgress",
    finished: "finished", errored: "errored", canceled: "canceled", cancelled: "canceled",
  };
  const name = key[value];
  return name ? t(`history.statusLabels.${name}`, value) : value;
}

export function expoEnvScopeLabel(value: string): string {
  return value === "project" ? t("env.scopeProject", "Project")
    : value === "account" ? t("env.scopeAccount", "Account") : value;
}

export function expoEnvVisibilityLabel(value: string): string {
  const key: Record<string, string> = { plaintext: "visPlaintext", sensitive: "visSensitive", secret: "visSecret" };
  return key[value] ? t(`env.${key[value]}`, value) : value;
}

export function expoEnvEnvironmentLabel(value: string): string {
  const key: Record<string, string> = { production: "envProduction", preview: "envPreview", development: "envDevelopment" };
  return key[value] ? t(`env.${key[value]}`, value) : value;
}
