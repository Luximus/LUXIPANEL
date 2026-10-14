// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * script-init.ts — shared timing constants for the extracted page-script
 * lifecycle (see CLAUDE.md §"Scripts extraídos por módulo").
 *
 * Astro's ClientRouter does NOT re-evaluate `<script type="module">` on SPA
 * navigation and the DataTables (`client:load`) hydrate in parallel, so every
 * module script guards its `init()` with a cooldown to coalesce the duplicate
 * `astro:page-load` / hydration triggers into a single data fetch. That 4-second
 * cooldown was a magic `4000` re-declared (under three different names) in ~23
 * scripts; it now lives here once.
 *
 * Dual consumption (mirrors api-client.ts / datatable-events.ts):
 *  • React/Astro side: `import { SCRIPT_INIT_COOLDOWN_MS } from "@/lib/script-init"`.
 *  • Extracted page scripts (esbuild `bundle:false`): import via the runtime URL
 *    `/scripts/extracted/lib/script-init.js` (entry listed in build-extracted.mjs).
 * Standalone (no imports).
 */

/** Min interval between two `init()` runs of an extracted page script (ms). */
export const SCRIPT_INIT_COOLDOWN_MS = 4000;

export interface ModuleInitOptions {
  /**
   * Id of a DOM node that only exists on this module's page. `init()` bails out
   * when it is missing, so the script stays inert on every other route.
   * Omit to always run (the handful of scripts with no anchor).
   */
  anchorId?: string;
  /**
   * DataTable ids this page owns. Before each fetch, `init()` emits
   * `REQUEST_READY` for every one of them so a table that hydrated BEFORE the
   * script loaded re-announces itself (otherwise the first `SET_DATA` is lost
   * and the table renders empty despite a 200).
   */
  tableIds?: readonly string[];
  /** Ran on EVERY init (bind-once listeners, widget wiring, i18n load). */
  onMount?: () => void;
  /** The actual data load. Rate-limited by `cooldownMs`. */
  onFetch?: () => void | Promise<void>;
  /** Override the 4s coalescing window (0 disables it). */
  cooldownMs?: number;
}

/**
 * Canonical lifecycle of an extracted page script (F-01).
 *
 * ~26 modules copied the same body: a module-level `initLastAt`, the anchor
 * check, `loadI18n()` + bind-once, the `REQUEST_READY` handshake, the 4s
 * cooldown guard and the `astro:page-load` / `astro:after-swap` listener pair.
 *
 * Usage in a page script:
 *
 *   import { createModuleInit } from "/scripts/extracted/lib/script-init.js";
 *   createModuleInit({
 *     anchorId: "cf-root",
 *     tableIds: [CF_DNS_TABLE_ID, CF_ACCESS_TABLE_ID],
 *     onMount: () => { loadI18n(); bindOnce(); },
 *     onFetch: () => { void loadZones(); },
 *   });
 *
 * Returns the `init` function so a script that needs to force a refresh (or
 * that keeps extra listeners) can call it directly.
 */
export function createModuleInit(options: ModuleInitOptions): () => void {
  const { anchorId, tableIds, onMount, onFetch, cooldownMs = SCRIPT_INIT_COOLDOWN_MS } = options;
  let lastAt = 0;

  function init(): void {
    if (anchorId && !document.getElementById(anchorId)) return;
    onMount?.();
    if (tableIds) {
      // MUST match lib/datatable-events.ts DATATABLE_EVENTS.REQUEST_READY.
      // Kept as a literal (not the imported symbol) because this module is a
      // standalone esbuild entry ALSO consumed as `@/lib/script-init`; adding an
      // import here would either emit an unresolved specifier into the browser
      // bundle or pull a second module into the dual-consumption graph. Keep it
      // in lockstep with `@/lib/datatable-events`.
      for (const tableId of tableIds) {
        window.dispatchEvent(
          new CustomEvent("lxp:data-table:request-ready", { detail: { tableId } }),
        );
      }
    }
    const now = Date.now();
    if (cooldownMs > 0 && now - lastAt < cooldownMs) return;
    lastAt = now;
    void onFetch?.();
  }

  document.addEventListener("astro:page-load", init);
  document.addEventListener("astro:after-swap", init);
  init();
  return init;
}
