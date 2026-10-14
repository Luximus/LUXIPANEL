// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Engine adapters — the per-engine differences the databases service relies on,
 * captured behind one interface so a new engine family is a new adapter + one
 * registry entry instead of edits scattered across every service method.
 *
 * An adapter is PURE with respect to the executor: it builds SQL strings, CLI
 * command lines, and parses stdout; it never runs anything itself. Operations
 * that need to query the target first (PostgreSQL schema resolution, primary-key
 * lookup) are expressed as adapter methods that take a `RawRunner` callback so
 * the service stays the single place that actually talks to the box. This keeps
 * the postgres-only schema/PK behavior inside the postgres adapter while both
 * engines satisfy the same contract from the caller's view.
 *
 * Behavior is byte-identical to the previous inline `if (engine === "mysql")`
 * branching: SQL text, CLI flags/args, env, password handling, stdout parsing
 * and returned shapes are preserved verbatim per engine.
 */

import { quoteArg } from "../../../shared/executor/index.js";
import type { EngineType } from "../models/index.js";
import {
  parseMysqlTsv,
  parsePgCsv,
  quoteMysqlIdent,
  quotePgIdent,
} from "./sql-util.js";

/**
 * Run a low-level statement on the target and hand back the parsed grid. This is
 * the service's `runRaw`, passed into the adapter so engine-specific lookups
 * (schema resolution, PK) can reuse the same execution path without the adapter
 * owning the executor.
 */
export type RawRunner = (
  sql: string,
  database: string | null,
) => Promise<{ columns: string[]; rows: string[][] }>;

export interface EngineAdapter {
  /** The engine family this adapter serves. */
  readonly type: EngineType;
  /** Human label for the UI. */
  readonly label: string;
  /** Schemas/databases hidden from the browse list. */
  readonly systemDbs: ReadonlySet<string>;

  /** Quote an identifier (database / table / column). */
  quoteIdent(name: string): string;
  /** SQL string literal for a value (engine-escaped); callers handle NULL. */
  stringLiteral(value: string): string;

  /** Build the CLI invocation for an arbitrary statement. */
  cliCmd(sql: string, database: string | null): string;
  /** Parse the engine CLI's stdout into a column/row grid. */
  parse(stdout: string): { columns: string[]; rows: string[][] };
  /** The `database` argument to pass to `runRaw` for catalogue-level queries. */
  catalogDbArg(database: string): string | null;

  /** SQL listing user databases (rows: name, …engine-specific metadata). */
  listDatabasesSql(): string;
  /** Map a database row to its metadata fields. */
  databaseMeta(row: string[]): { tables: number | null; sizeBytes: number };

  /** SQL listing tables in `database`. */
  listTablesSql(database: string): string;
  /** Map a table row to its metadata fields. */
  tableMeta(row: string[]): {
    rows: number;
    sizeBytes: number;
    engine?: string | null;
  };

  /** Build the native dump command for an export. */
  dumpCmd(database: string, tables: string[], includeData: boolean): string;

  /** Describe a table's columns (resolves schema/PK where applicable). */
  listColumns(
    run: RawRunner,
    database: string,
    table: string,
  ): Promise<ColumnRow[]>;

  /** Primary-key column names in key order (resolves schema where applicable). */
  primaryKey(run: RawRunner, database: string, table: string): Promise<string[]>;

  /** Engine-quoted, (for PostgreSQL) schema-qualified identifier for a table. */
  qualifiedIdent(run: RawRunner, database: string, table: string): Promise<string>;
}

/** Column shape returned by `listColumns` (mirrors the service's prior output). */
interface ColumnRow {
  name: string;
  dataType: string;
  nullable: boolean;
  key: string | null;
  default: string | null;
  extra?: string | null;
  isPrimaryKey: boolean;
}

// ── string-literal helpers (unchanged escaping) ─────────────────────────────

/** Single-quote a MySQL string literal (for information_schema lookups). */
function mysqlStr(value: string): string {
  return "'" + value.replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
}

/** Single-quote a PostgreSQL string literal. */
function pgStr(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

// ── MySQL / MariaDB ─────────────────────────────────────────────────────────

const mysqlAdapter: EngineAdapter = {
  type: "mysql",
  label: "MySQL / MariaDB",
  systemDbs: new Set(["information_schema", "performance_schema", "mysql", "sys"]),

  quoteIdent: quoteMysqlIdent,
  stringLiteral: mysqlStr,

  cliCmd(sql, database) {
    // `sudo -n mysql --batch [-D db] -e <sql>` — TSV output with a header row.
    const dbArg = database ? ` -D ${quoteArg(database)}` : "";
    return `sudo -n mysql --batch --default-character-set=utf8mb4${dbArg} -e ${quoteArg(sql)}`;
  },
  parse: parseMysqlTsv,
  catalogDbArg() {
    return null;
  },

  listDatabasesSql() {
    return (
      "SELECT s.SCHEMA_NAME AS name, " +
      "COUNT(t.TABLE_NAME) AS tables, " +
      "COALESCE(SUM(t.DATA_LENGTH + t.INDEX_LENGTH), 0) AS size_bytes " +
      "FROM information_schema.SCHEMATA s " +
      "LEFT JOIN information_schema.TABLES t ON t.TABLE_SCHEMA = s.SCHEMA_NAME " +
      "GROUP BY s.SCHEMA_NAME ORDER BY s.SCHEMA_NAME;"
    );
  },
  databaseMeta(row) {
    return { tables: Number(row[1] ?? 0), sizeBytes: Number(row[2] ?? 0) };
  },

  listTablesSql(database) {
    return (
      "SELECT TABLE_NAME, COALESCE(TABLE_ROWS,0), " +
      "COALESCE(DATA_LENGTH + INDEX_LENGTH,0), ENGINE " +
      `FROM information_schema.TABLES WHERE TABLE_SCHEMA = ${mysqlStr(database)} ` +
      "ORDER BY TABLE_NAME;"
    );
  },
  tableMeta(row) {
    return {
      rows: Number(row[1] ?? 0),
      sizeBytes: Number(row[2] ?? 0),
      engine: row[3] || null,
    };
  },

  dumpCmd(database, tables, includeData) {
    const noData = includeData ? "" : " --no-data";
    const tableArgs = tables.map((t) => ` ${quoteArg(t)}`).join("");
    return (
      `sudo -n mysqldump --default-character-set=utf8mb4 --single-transaction ` +
      `--routines --triggers${noData} ${quoteArg(database)}${tableArgs}`
    );
  },

  async listColumns(run, database, table) {
    const sql =
      "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA " +
      `FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ${mysqlStr(database)} ` +
      `AND TABLE_NAME = ${mysqlStr(table)} ORDER BY ORDINAL_POSITION;`;
    const { rows } = await run(sql, null);
    return rows.map((r) => ({
      name: r[0] ?? "",
      dataType: r[1] ?? "",
      nullable: r[2] === "YES",
      key: r[3] || null,
      default: r[4] === "NULL" ? null : r[4] ?? null,
      extra: r[5] || null,
      isPrimaryKey: r[3] === "PRI",
    }));
  },

  async primaryKey(run, database, table) {
    const sql =
      "SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE " +
      `WHERE TABLE_SCHEMA = ${mysqlStr(database)} AND TABLE_NAME = ${mysqlStr(table)} ` +
      "AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY ORDINAL_POSITION;";
    const { rows } = await run(sql, null);
    return rows.map((r) => r[0] ?? "").filter(Boolean);
  },

  async qualifiedIdent(_run, _database, table) {
    return quoteMysqlIdent(table);
  },
};

// ── PostgreSQL ──────────────────────────────────────────────────────────────

/**
 * Resolve which schema a PostgreSQL relation lives in. `listTables` surfaces
 * tables from every non-system schema, but the browse/describe queries only
 * receive the bare relname — without the schema, an unqualified
 * `SELECT * FROM "t"` fails for anything outside the search_path (e.g.
 * `drizzle.__drizzle_migrations`). Prefer `public` when a name is ambiguous.
 */
async function resolvePgSchema(
  run: RawRunner,
  database: string,
  table: string,
): Promise<string | null> {
  const sql =
    "SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace " +
    `WHERE c.relname = ${pgStr(table)} AND c.relkind IN ('r','p','v','m','f') ` +
    "AND n.nspname NOT IN ('pg_catalog','information_schema') " +
    "ORDER BY (n.nspname = 'public') DESC, n.nspname LIMIT 1;";
  const { rows } = await run(sql, database);
  return rows[0]?.[0] || null;
}

/**
 * Primary-key columns for an ALREADY-resolved relation (`schema.table` or a
 * bare `table`). Split out from `primaryKey` so `listColumns` can resolve the
 * schema ONCE and reuse it here instead of paying a second `resolvePgSchema`
 * round-trip to the box.
 */
async function pgPrimaryKeyForRel(
  run: RawRunner,
  database: string,
  rel: string,
): Promise<string[]> {
  const sql =
    "SELECT a.attname FROM pg_index i " +
    "JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) " +
    `WHERE i.indrelid = ${pgStr(rel)}::regclass AND i.indisprimary ` +
    "ORDER BY array_position(i.indkey, a.attnum);";
  const { rows } = await run(sql, database);
  return rows.map((r) => r[0] ?? "").filter(Boolean);
}

const postgresAdapter: EngineAdapter = {
  type: "postgresql",
  label: "PostgreSQL",
  systemDbs: new Set(["template0", "template1"]),

  quoteIdent: quotePgIdent,
  stringLiteral: pgStr,

  cliCmd(sql, database) {
    // `sudo -n -u postgres psql --csv -d <db> -c <sql>` — CSV output with header.
    const db = database ?? "postgres";
    return `sudo -n -u postgres psql --csv -X -q -d ${quoteArg(db)} -c ${quoteArg(sql)}`;
  },
  parse: parsePgCsv,
  catalogDbArg(database) {
    return database;
  },

  listDatabasesSql() {
    // size via pg_database_size; table count needs a per-db query, so it's left
    // null here (filled when the db is opened) to keep this cheap.
    return (
      "SELECT datname, pg_database_size(datname) AS size_bytes " +
      "FROM pg_database WHERE datistemplate = false ORDER BY datname;"
    );
  },
  databaseMeta(row) {
    return { tables: null, sizeBytes: Number(row[1] ?? 0) };
  },

  listTablesSql(_database) {
    return (
      "SELECT c.relname AS name, " +
      "COALESCE(c.reltuples,0)::bigint AS rows, " +
      "pg_total_relation_size(c.oid) AS size_bytes " +
      "FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace " +
      "WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema') " +
      "ORDER BY c.relname;"
    );
  },
  tableMeta(row) {
    return { rows: Number(row[1] ?? 0), sizeBytes: Number(row[2] ?? 0) };
  },

  dumpCmd(database, tables, includeData) {
    const schemaOnly = includeData ? "" : " --schema-only";
    const tableArgs = tables.map((t) => ` -t ${quoteArg(t)}`).join("");
    return `sudo -n -u postgres pg_dump${schemaOnly} -d ${quoteArg(database)}${tableArgs}`;
  },

  async listColumns(run, database, table) {
    // Resolve the table's real schema so we describe the right relation: a
    // relname can exist in several schemas (e.g. `public` + `drizzle`), and
    // matching on `table_name` alone mixes their columns together. Resolve it
    // ONCE and reuse for the PK lookup (perf: one round-trip, not two).
    const schema = await resolvePgSchema(run, database, table);
    const sql =
      "SELECT column_name, data_type, is_nullable, column_default " +
      `FROM information_schema.columns WHERE table_name = ${pgStr(table)} ` +
      (schema
        ? `AND table_schema = ${pgStr(schema)} `
        : "AND table_schema NOT IN ('pg_catalog','information_schema') ") +
      "ORDER BY ordinal_position;";
    const { rows } = await run(sql, database);
    const rel = schema ? `${schema}.${table}` : table;
    const pkCols = new Set(await pgPrimaryKeyForRel(run, database, rel));
    return rows.map((r) => ({
      name: r[0] ?? "",
      dataType: r[1] ?? "",
      nullable: r[2] === "YES",
      key: pkCols.has(r[0] ?? "") ? "PRI" : null,
      default: r[3] || null,
      isPrimaryKey: pkCols.has(r[0] ?? ""),
    }));
  },

  async primaryKey(run, database, table) {
    const schema = await resolvePgSchema(run, database, table);
    const rel = schema ? `${schema}.${table}` : table;
    return pgPrimaryKeyForRel(run, database, rel);
  },

  async qualifiedIdent(run, database, table) {
    const schema = await resolvePgSchema(run, database, table);
    return schema
      ? `${quotePgIdent(schema)}.${quotePgIdent(table)}`
      : quotePgIdent(table);
  },
};

// ── registry ────────────────────────────────────────────────────────────────

const ADAPTERS: Record<EngineType, EngineAdapter> = {
  mysql: mysqlAdapter,
  postgresql: postgresAdapter,
};

/** Select the adapter for an engine family (once per service call). */
export function adapterFor(engine: EngineType): EngineAdapter {
  return ADAPTERS[engine];
}

/** Human label for an engine family (used by the cheap engine probe). */
export function engineLabel(engine: EngineType): string {
  return ADAPTERS[engine].label;
}
