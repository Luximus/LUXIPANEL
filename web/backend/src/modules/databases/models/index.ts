// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Databases module — domain types and request schemas.
 *
 * The module has NO persisted per-server state: it auto-detects the database
 * engines installed/running on the connected server and talks to them through
 * the `mysql` / `psql` CLI over the Executor (socket + sudo auth). There is no
 * credential storage on the panel host — every operation lands on the target
 * via SSH, honouring the managed-mode isolation invariant.
 */

import { z } from "zod";

/** Supported engine families. `mysql` covers MariaDB (same client/protocol). */
export type EngineType = "mysql" | "postgresql";

export const engineTypeSchema = z.enum(["mysql", "postgresql"]);

/**
 * A SQL identifier (database / table / column name). Deliberately strict: we
 * still quote it for the engine, but rejecting exotic characters up-front is a
 * cheap second line of defence against breaking out of the quoting. Backticks,
 * double-quotes and NUL can never appear.
 */
export const identifierSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_$][A-Za-z0-9_$. -]*$/, "Invalid SQL identifier");

export interface EngineInfo {
  type: EngineType;
  /** Human label for the UI ("MySQL / MariaDB", "PostgreSQL"). */
  label: string;
  /** Client binary present on the target. */
  installed: boolean;
  /** Server reachable through the local socket (a successful version query). */
  running: boolean;
  /** Server version string, or null when not reachable. */
  version: string | null;
  /** "MariaDB" | "MySQL" for the mysql family; undefined otherwise. */
  flavor?: string;
}

export interface DatabaseInfo {
  name: string;
  type: EngineType;
  /** Number of tables, when cheaply available. */
  tables?: number | null;
  /** Approximate on-disk size in bytes, when cheaply available. */
  sizeBytes?: number | null;
}

export interface TableInfo {
  name: string;
  rows: number | null;
  sizeBytes: number | null;
  engine?: string | null;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  key: string | null;
  default: string | null;
  extra?: string | null;
  /** True when the column participates in the table's primary key. */
  isPrimaryKey?: boolean;
}

/** Read = inspect-only (SELECT/SHOW/…); write = mutating/DDL. */
export type StatementKind = "read" | "write";

export interface QueryResult {
  columns: string[];
  rows: string[][];
  rowCount: number;
  total?: number;
  kind: StatementKind;
  /** Rows affected for write statements (best-effort, may be null). */
  affectedRows?: number | null;
  durationMs: number;
  /** True when the result set was capped by the row limit. */
  truncated?: boolean;
}

// ── Request schemas ────────────────────────────────────────────────────────

export const listDatabasesQuerySchema = z.object({
  engine: engineTypeSchema,
});

export const createDatabaseSchema = z.object({
  engine: engineTypeSchema,
  name: identifierSchema,
});

export const listTablesQuerySchema = z.object({
  engine: engineTypeSchema,
  database: identifierSchema,
});

export const tableParamsSchema = z.object({
  engine: engineTypeSchema,
  database: identifierSchema,
  table: identifierSchema,
});

export const rowsQuerySchema = z.object({
  engine: engineTypeSchema,
  database: identifierSchema,
  table: identifierSchema,
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: identifierSchema.optional(),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export const runQuerySchema = z.object({
  engine: engineTypeSchema,
  /** Optional default database the statement runs against. */
  database: identifierSchema.optional(),
  sql: z.string().min(1).max(100_000),
  /** Cap applied to result rows we ship back to the browser. */
  limit: z.coerce.number().int().min(1).max(2000).default(500),
  /**
   * Allow mutating statements. The UI sends this only from the explicit
   * "run write" affordance so a stray UPDATE/DROP can't slip through the
   * read-only browse paths.
   */
  allowWrite: z.boolean().default(false),
});

// ── Record CRUD ──────────────────────────────────────────────────────────────

/**
 * A single cell value as it travels over the wire. `null` is a real SQL NULL;
 * everything else is sent as a string and bound as a string literal (the
 * engine casts it to the column type — adequate for a phpMyAdmin-style editor).
 */
export const cellValueSchema = z.union([z.string().max(1_000_000), z.null()]);

/** Map of column name → value. Keys are validated as identifiers in the service. */
export const recordValuesSchema = z.record(z.string().min(1).max(128), cellValueSchema);

export const insertRecordSchema = z.object({
  engine: engineTypeSchema,
  database: identifierSchema,
  table: identifierSchema,
  values: recordValuesSchema,
});

export const updateRecordSchema = z.object({
  engine: engineTypeSchema,
  database: identifierSchema,
  table: identifierSchema,
  /** New values to write (column → value). */
  values: recordValuesSchema,
  /** Primary-key columns → their ORIGINAL values, identifying the row. */
  where: recordValuesSchema,
});

export const deleteRecordSchema = z.object({
  engine: engineTypeSchema,
  database: identifierSchema,
  table: identifierSchema,
  /** Primary-key columns → their values, identifying the row. */
  where: recordValuesSchema,
});

export interface MutationResult {
  affectedRows: number | null;
}

// ── Export ───────────────────────────────────────────────────────────────────

export const exportDatabaseSchema = z.object({
  engine: engineTypeSchema,
  database: identifierSchema,
  /** Tables to include. Empty/omitted = the whole database. */
  tables: z.array(identifierSchema).max(2000).optional(),
  /** false = structure only (`--no-data`). */
  includeData: z.boolean().default(true),
});

// ── Engine installation ──────────────────────────────────────────────────────

/** Engines the panel can install on the target via the system package manager. */
export const installableEngineSchema = z.enum(["mariadb", "postgresql"]);
export type InstallableEngine = z.infer<typeof installableEngineSchema>;

export const installEngineSchema = z.object({
  engine: installableEngineSchema,
  /** Optional explicit sudo password (the shared install flow prompts for it). */
  sudoPassword: z.string().max(1024).optional(),
});
