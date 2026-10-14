// Databases page — shared i18n + DOM/formatting helpers. Leaf module (no
// cross-submodule imports), so every submodule can import it freely.
//
// The i18n trio (F-03/T-08), the toast (F-04), the HTML escaper (F-02), `$`
// (E-06) and the byte formatter (T-07) now come from the shared libs; only the
// module-specific bindings stay here. `esc` keeps its name (~30 call sites) but
// is now the canonical 5-character escaper (it also escapes `'`).
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
import { escapeHtml } from "/scripts/extracted/lib/escape.js";
import { fmtBytes as fmtBytesShared } from "/scripts/extracted/lib/format.js";

// ── i18n ────────────────────────────────────────────────────────────────────
export const { loadI18n, t, fmt } = createPageI18n("databases-i18n");

// ── Helpers ─────────────────────────────────────────────────────────────────
export const esc = escapeHtml;

/**
 * `null`/`undefined` (size not reported by the engine) renders as an em dash;
 * everything else keeps the historical "whole bytes, one decimal above" shape.
 */
export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return "—";
  return fmtBytesShared(n, { decimals: 1, zero: "0 B" });
}

export { showToast } from "/scripts/extracted/lib/toast.js";
export { $ } from "/scripts/extracted/lib/dom.js";
