// Obsidian page — shared i18n + DOM/formatting helpers. Leaf module (no
// cross-submodule imports), so every submodule can import it freely.
//
// The i18n trio (F-03/T-08), the toast (F-04), the HTML escaper (F-02) and `$`
// (E-06) now come from the shared libs; only the `obsidian-i18n` payload id
// stays here. `esc` keeps its name but is now the canonical 5-character escaper
// (it also escapes `'`).
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
import { escapeHtml } from "/scripts/extracted/lib/escape.js";

export const { loadI18n, t, fmt } = createPageI18n("obsidian-i18n");

// ── Helpers ──────────────────────────────────────────────────────────────────
export const esc = escapeHtml;

export { showToast } from "/scripts/extracted/lib/toast.js";
export { $ } from "/scripts/extracted/lib/dom.js";
