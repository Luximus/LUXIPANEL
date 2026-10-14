// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * datatable-events.ts — single source of truth for the `lxp:data-table:*`
 * CustomEvent vocabulary that the `<DataTable>` React island and the extracted
 * page scripts use to talk to each other (the `request-ready` handshake, data
 * pushes, pagination, row/quick actions, etc.).
 *
 * These names used to be re-typed as raw string literals across DataTable.tsx
 * and ~16 page scripts; a single typo silently broke a table with no compile
 * error. Defining them once here removes that risk.
 *
 * IMPORTANT — dual consumption (mirrors api-client.ts / job-poll.ts):
 *  • The React/Astro side imports this module normally: `@/lib/datatable-events`.
 *  • The extracted page scripts (built with esbuild `bundle:false`, imports left
 *    intact) import it via the RUNTIME URL `/scripts/extracted/lib/datatable-events.js`
 *    — which is emitted by `scripts/build-extracted.mjs` (entry must stay listed
 *    there, or pages serve a stale/missing module). This module is standalone
 *    (no imports) so it bundles cleanly as its own entry.
 *
 * The values are byte-identical to the former literals — do not change them
 * without updating every emitter/listener in lockstep.
 */
export const DATATABLE_EVENTS = {
  /** Host → table: replace the row data. */
  SET_DATA: "lxp:data-table:set-data",
  /** Host → table: replace the column set at runtime (SQL viewer). */
  SET_COLUMNS: "lxp:data-table:set-columns",
  /** Host → table: push external (server-side) pagination state. */
  SET_PAGINATION: "lxp:data-table:set-pagination",
  /** Host → table: toggle the loading overlay. */
  SET_LOADING: "lxp:data-table:set-loading",
  /** Host → table: replace the per-column filter option lists. */
  SET_FILTER_OPTIONS: "lxp:data-table:set-filter-options",
  /** Table → host: the island hydrated and is ready to receive data. */
  READY: "lxp:data-table:ready",
  /** Host → table: re-emit READY (handshake for scripts that loaded late). */
  REQUEST_READY: "lxp:data-table:request-ready",
  /** Table → host: a header quick-action button was clicked. */
  QUICK_ACTION: "lxp:data-table:quick-action",
  /** Table → host: external pagination prev/next was clicked. */
  PAGE: "lxp:data-table:page",
  QUERY: "lxp:data-table:query",
  /** Table → host: fetch the next two pages without changing the visible page. */
  LOAD_MORE: "lxp:data-table:load-more",
  /** Table → host: a per-row action was clicked. */
  ROW_ACTION: "lxp:data-table:row-action",
} as const;

export type DataTableEventName = (typeof DATATABLE_EVENTS)[keyof typeof DATATABLE_EVENTS];

export type TableRow = Record<string, unknown>;

export interface TableFeed {
  /** Cache the rows and push them if the table already announced READY. */
  publish(tableId: string, rows: TableRow[]): void;
  /** Toggle the table's loading overlay. */
  setLoading(tableId: string, loading: boolean): void;
  /**
   * Listen for READY on the owned table ids and flush whatever is cached.
   * Idempotent — a second call is a no-op, so it is safe to run from `init()`.
   */
  bindReady(): void;
  /** Ask the (possibly already-hydrated) tables to re-announce READY. */
  requestReady(): void;
  /** Last rows published per table id (read-only use). */
  readonly cache: Record<string, TableRow[]>;
}

/**
 * DataTable feed bridge (F-09).
 *
 * Nine page scripts reimplemented the same `ready[tableId]` / `cache[tableId]`
 * pair with a `publishRows()` that caches and only dispatches `SET_DATA` when
 * the island is ready, plus the `READY` listener that flushes the cache. The
 * race it solves: the DataTable hydrates (`client:load`) in parallel with the
 * page script, so a `SET_DATA` sent before READY is dropped and the table
 * renders empty even though the fetch returned 200.
 *
 *   const feed = createTableFeed([CF_DNS_TABLE_ID, CF_ACCESS_TABLE_ID]);
 *   feed.bindReady();
 *   feed.publish(CF_DNS_TABLE_ID, rows);
 */
export function createTableFeed(tableIds: readonly string[]): TableFeed {
  const owned = new Set(tableIds);
  const ready: Record<string, boolean> = {};
  const cache: Record<string, TableRow[]> = {};
  let bound = false;

  function dispatch(tableId: string, rows: TableRow[]): void {
    window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_DATA, { detail: { tableId, data: rows } }));
  }

  return {
    cache,
    publish(tableId: string, rows: TableRow[]): void {
      cache[tableId] = Array.isArray(rows) ? rows : [];
      if (ready[tableId]) dispatch(tableId, cache[tableId]);
    },
    setLoading(tableId: string, loading: boolean): void {
      window.dispatchEvent(
        new CustomEvent(DATATABLE_EVENTS.SET_LOADING, { detail: { tableId, loading } }),
      );
    },
    bindReady(): void {
      if (bound) return;
      bound = true;
      window.addEventListener(DATATABLE_EVENTS.READY, (event: Event) => {
        const id = (event as CustomEvent<{ tableId?: string }>).detail?.tableId;
        if (!id || !owned.has(id)) return;
        ready[id] = true;
        if (cache[id]) dispatch(id, cache[id]);
      });
    },
    requestReady(): void {
      for (const tableId of owned) {
        window.dispatchEvent(
          new CustomEvent(DATATABLE_EVENTS.REQUEST_READY, { detail: { tableId } }),
        );
      }
    },
  };
}
