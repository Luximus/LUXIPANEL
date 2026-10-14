/**
 * server-table-logic — lógica PURA de `ServerDataTable` (filtrado, orden,
 * paginación). Sin React ni React Native: se testea en node con vitest.
 *
 * Se extrae del componente para (a) poder testearla y (b) poder memoizarla con
 * dependencias estables: antes el `useMemo` de filtrado recibía `filters` como
 * array literal por defecto (identidad nueva en cada render), así que
 * refiltraba y reordenaba TODAS las filas en cada render aunque no cambiara
 * nada. Con directorios/procesos/correos de miles de filas eso era el coste
 * dominante de cada pulsación de tecla.
 *
 * Los tipos viven aquí y `ServerDataTable` los re-exporta, de modo que las
 * pantallas siguen importándolos desde `./ServerDataTable` como hasta ahora.
 */
import type { ReactNode } from "react";

export type ServerColumn<Row> = {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: Row) => string | number;
  width?: number;
  hideable?: boolean;
  defaultHidden?: boolean;
};

export type ServerFilter<Row> =
  | { id: string; kind: "search"; placeholder: string; match: (row: Row, query: string) => boolean }
  | {
      id: string;
      kind: "select";
      placeholder: string;
      options: { value: string; label: string }[];
      match: (row: Row, value: string) => boolean;
    };

export type ServerRowAction = { id: string; label: string; icon?: ReactNode; danger?: boolean };
export type ServerQuickAction = { id: string; label: string; icon?: ReactNode; danger?: boolean };

export type ServerSort = { id: string; dir: "asc" | "desc" } | null;

/**
 * Aplica los filtros activos. Mantiene la semántica original:
 * - `search`: se normaliza con `trim().toLowerCase()`; vacío = filtro inactivo.
 * - `select`: cadena vacía = filtro inactivo ("todos").
 * Si ningún filtro está activo devuelve el MISMO array (identidad estable), lo
 * que permite que los consumidores memoicen sin copias innecesarias.
 */
export function filterRows<Row>(
  rows: Row[],
  filters: readonly ServerFilter<Row>[],
  searchValues: Record<string, string>,
  selectValues: Record<string, string>,
): Row[] {
  let out: Row[] = rows;
  for (const f of filters) {
    if (f.kind === "search") {
      const q = (searchValues[f.id] ?? "").trim().toLowerCase();
      if (q) out = out.filter((r) => f.match(r, q));
    } else {
      const v = selectValues[f.id] ?? "";
      if (v) out = out.filter((r) => f.match(r, v));
    }
  }
  return out;
}

/** Comparador de celdas: numérico si ambos son números, si no `localeCompare`. */
export function compareSortValues(a: string | number, b: string | number): number {
  return typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
}

/**
 * Ordena por la columna activa. Sin `sort` o sin `sortValue` en la columna
 * devuelve el mismo array (no copia). `Array#sort` es estable, así que el orden
 * de origen se respeta entre elementos equivalentes.
 */
export function sortRows<Row>(rows: Row[], columns: readonly ServerColumn<Row>[], sort: ServerSort): Row[] {
  if (!sort) return rows;
  const sv = columns.find((c) => c.id === sort.id)?.sortValue;
  if (!sv) return rows;
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => compareSortValues(sv(a), sv(b)) * dir);
}

/** Filtrado + orden en un paso (lo que el componente memoiza). */
export function filterAndSortRows<Row>(
  rows: Row[],
  columns: readonly ServerColumn<Row>[],
  filters: readonly ServerFilter<Row>[],
  searchValues: Record<string, string>,
  selectValues: Record<string, string>,
  sort: ServerSort,
): Row[] {
  return sortRows(filterRows(rows, filters, searchValues, selectValues), columns, sort);
}

/** Nº total de páginas (mínimo 1, incluso sin filas). */
export function totalPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

/**
 * Acota la página a un rango válido. Necesario porque al filtrar/borrar filas
 * la página guardada puede quedar fuera de rango (antes se quedaba en blanco).
 */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(0, page), totalPageCount(total, pageSize) - 1);
}

/** Filas de la página (con la página ya acotada). */
export function pageSlice<Row>(rows: Row[], page: number, pageSize: number): Row[] {
  const p = clampPage(page, rows.length, pageSize);
  return rows.slice(p * pageSize, p * pageSize + pageSize);
}

/** Rango "mostrando X-Y de N" del footer (1-indexado; 0-0 si no hay filas). */
export function pageRange(total: number, page: number, pageSize: number): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 };
  const p = clampPage(page, total, pageSize);
  return { from: p * pageSize + 1, to: Math.min(total, (p + 1) * pageSize) };
}

/** Columnas visibles (las ocultas se configuran en el engranaje de la tabla). */
export function visibleColumnsOf<Row>(
  columns: readonly ServerColumn<Row>[],
  hidden: ReadonlySet<string>,
): ServerColumn<Row>[] {
  return columns.filter((c) => !hidden.has(c.id));
}

/** Ids de las columnas ocultas por defecto (estado inicial del engranaje). */
export function defaultHiddenIds<Row>(columns: readonly ServerColumn<Row>[]): Set<string> {
  return new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id));
}

/** Keep explicit choices, but apply updated defaults to untouched columns. */
export function hiddenColumnIds<Row>(columns: readonly ServerColumn<Row>[], overrides: Readonly<Record<string, boolean>>): Set<string> {
  return new Set(columns.filter(col => overrides[col.id] ?? col.defaultHidden ?? false).map(col => col.id));
}

/** Siguiente estado de orden al pulsar una cabecera (asc → desc → asc…). */
export function nextSort(prev: ServerSort, columnId: string): ServerSort {
  if (prev?.id === columnId) return { id: columnId, dir: prev.dir === "asc" ? "desc" : "asc" };
  return { id: columnId, dir: "asc" };
}
