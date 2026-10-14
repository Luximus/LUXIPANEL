// Users page — shared DOM / i18n / formatting helpers.
// Leaf module: imports nothing from the other users submodules.
//
// The i18n trio (F-03/T-08), the toast (F-04), `tsOf` (E-05) and `escapeHtml`
// (F-02) come from the shared extracted libs; only the module-specific bindings
// stay here.
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
import { showToast as showSharedToast } from "/scripts/extracted/lib/toast.js";
import { tsOf } from "/scripts/extracted/lib/time.js";

export const { loadI18n, t, fmt } = createPageI18n("users-i18n");

/** F-04: shared toast, kept at the users page's historical 3000 ms auto-hide. */
export function showToast(msg: string, ok = true) {
  showSharedToast(msg, ok, { durationMs: 3000 });
}

export function linesFromTextarea(id: string): string[] {
  const value = (document.getElementById(id) as HTMLTextAreaElement).value;
  return [...new Set(value.split("\n").map((line) => line.trim()).filter((line) => line.length > 0))];
}

export function setTextareaLines(id: string, values: string[]) {
  (document.getElementById(id) as HTMLTextAreaElement).value = values.join("\n");
}

/** ISO → epoch ms for sorting (0 when missing/invalid). */
export { tsOf } from "/scripts/extracted/lib/time.js";

/** ISO → localized "DD/MM/YYYY HH:MM" (or just date), "—" when missing. */
export function formatDateTime(iso: unknown, withTime = true): string {
  const ms = tsOf(iso);
  if (!ms) return "—";
  const d = new Date(ms);
  return withTime
    ? d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
    : d.toLocaleDateString(undefined, { dateStyle: "short" } as Intl.DateTimeFormatOptions);
}

/** HTML-escape a value for safe interpolation into innerHTML strings (F-02). */
export { escapeHtml } from "/scripts/extracted/lib/escape.js";
