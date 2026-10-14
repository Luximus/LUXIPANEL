import {readTablePageSize} from "/scripts/extracted/lib/table-pages.js";
// Databases page — shared types + module-level state hub + DataTable ids/caches.
// LEAF module: imports NOTHING from the other databases submodules, so every
// submodule can import it without cycles. Cross-submodule mutable state lives on
// the exported `state` object (importers read/write `state.foo`).

// ── Types (mirror backend models) ──────────────────────────────────────────
export interface EngineInfo {
  type: "mysql" | "postgresql";
  label: string;
  installed: boolean;
  running: boolean;
  version: string | null;
  flavor?: string;
}
export interface DatabaseInfo { name: string; type: string; tables?: number | null; sizeBytes?: number | null }
export interface TableInfo { name: string; rows: number | null; sizeBytes: number | null; engine?: string | null }
export interface ColumnInfo { name: string; dataType: string; nullable: boolean; key: string | null; default: string | null; extra?: string | null; isPrimaryKey?: boolean }
export interface QueryResult {
  columns: string[];
  rows: string[][];
  rowCount: number;
  total?: number;
  kind: "read" | "write";
  affectedRows?: number | null;
  durationMs: number;
  truncated?: boolean;
}

export type Tab = "rows" | "structure" | "console";

export const state = {
  engine: null as EngineInfo["type"] | null,
  database: null as string | null,
  table: null as string | null,
  tab: "rows" as Tab,
  offset: 0,
  limit: readTablePageSize(window,"db-rows-table"),
  rowSorting: [] as Array<{ id: string; desc: boolean }>,
  // Current table metadata + last-loaded rows, used by the record editor.
  columns: [] as ColumnInfo[],
  primaryKey: [] as string[],
  rows: [] as string[][],
  rowColumns: [] as string[],
  recordMode: "insert" as "insert" | "edit",
  editWhere: null as Record<string, string | null> | null,
};

// ── Alimentación de los DataTable (rows / structure / console) ────────────────
// Las tres tablas se renderizan con el componente DataTable. La de filas usa
// columnas DINÁMICAS (las columnas de la tabla SQL) + paginación EXTERNA
// (server-side); la de estructura usa columnas fijas del prop; la de consola usa
// columnas dinámicas. El script empuja columnas y datos por eventos.
export const DB_ROWS_TABLE_ID = "db-rows-table";
export const DB_STRUCT_TABLE_ID = "db-structure-table";
export const DB_CONSOLE_TABLE_ID = "db-console-table";

export type DbExtPage = { canPrev: boolean; canNext: boolean; info: string; window?: boolean; version?: number; total?: number; hasMore?: boolean; loading?: boolean; error?: string | null };
export type DbCacheEntry = { columns?: Record<string, unknown>[]; rows: Record<string, unknown>[]; pagination?: DbExtPage };
export const dbReady: Record<string, boolean> = {};
export const dbCache: Record<string, DbCacheEntry> = {};
