// Databases page — DataTable feed for the three tables (rows / structure /
// console): cache por tableId + publish helpers + dynamic-column mappers. The
// READY/PAGE/ROW_ACTION handshake listeners live in bind.ts; the REQUEST_READY
// emit stays in the entry.
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { dbCache, dbReady, type DbExtPage } from "./state";

export function emitDb(tableId: string) {
  const c = dbCache[tableId];
  if (!c) return;
  if (c.columns) {
    window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_COLUMNS, { detail: { tableId, columns: c.columns } }));
  }
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_DATA, { detail: { tableId, data: c.rows } }));
  if (c.pagination) {
    window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_PAGINATION, { detail: { tableId, ...c.pagination } }));
  }
}

/** Cache + publish columns/rows for a table (publishes only once the DataTable is ready). */
export function publishDb(
  tableId: string,
  columns: Record<string, unknown>[] | null,
  rows: Record<string, unknown>[],
  pagination?: DbExtPage,
) {
  const prev = dbCache[tableId];
  dbCache[tableId] = {
    columns: columns ?? prev?.columns,
    rows,
    pagination: pagination ?? prev?.pagination,
  };
  if (dbReady[tableId]) emitDb(tableId);
}

export function setDbLoading(tableId: string, loading: boolean) {
  window.dispatchEvent(new CustomEvent(DATATABLE_EVENTS.SET_LOADING, { detail: { tableId, loading } }));
}

/** Build DataTable column configs for arbitrary SQL columns (keyed c0..cN). */
export function dynColumns(cols: string[]): Record<string, unknown>[] {
  return cols.map((name, i) => ({ id: `c${i}`, header: name, accessorKey: `c${i}`, sortable: true, hideable: true }));
}

/** Map SQL row arrays to DataTable row objects keyed c0..cN (+ `_idx`). */
export function dynRows(cols: string[], rows: string[][]): Record<string, unknown>[] {
  return rows.map((r, idx) => {
    const obj: Record<string, unknown> = { id: idx, _idx: idx };
    cols.forEach((_c, i) => {
      const cell = r[i];
      obj[`c${i}`] = cell === undefined ? "NULL" : cell;
    });
    return obj;
  });
}
