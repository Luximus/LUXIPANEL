// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Timestamp helpers shared by the extracted page scripts (E-05).
 *
 * `tsOf()` — "parse anything into a sortable epoch, 0 when unusable" — was
 * copied verbatim into `server-alerts/index-script1`, `module-dev/table-bridge`,
 * `expo/dom` and `users/dom` (the last two spelled the nullish guard slightly
 * differently; this version keeps the safest one: `null`/`undefined` → 0).
 *
 * NOTE: the sibling `fmtDate`/`fmtDateTime` copies are NOT consolidated here —
 * they render DIFFERENT strings per module (fixed `"es"` locale vs
 * `document.documentElement.lang` vs the runtime default, and different
 * `Intl` option sets), so a single implementation would change what users see.
 * Their canonical home is `@/lib/format.ts` (`formatDateStamp`), which owns the
 * locale policy.
 *
 * Imported by the runtime URL `/scripts/extracted/lib/time.js`.
 * Standalone (no imports).
 */

/** Epoch ms for any date-ish value; 0 when missing or unparseable (sorts last-ish). */
export function tsOf(value: unknown): number {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}
