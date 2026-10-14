// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Databases service — all operations run on the CONNECTED server through the
 * Executor, never on the panel host. Engines are reached via their local CLI
 * (`mysql`, `psql`) with socket + sudo auth, mirroring the nginx/system
 * services' `sh -lc` + `injectSudoIntoShellScript` pattern:
 *
 *   - `sudo -n mysql --batch …`            (root via unix_socket)
 *   - `sudo -n -u postgres psql --csv …`   (peer auth as the postgres role)
 *
 * No passwords are stored anywhere; the sudo credential is the operator's
 * own SSH passphrase, injected into the script body before wrapping.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { execShell, quoteArg } from "../../../shared/executor/index.js";
import { ValidationError, AppError, ErrorCodes } from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { injectSudoIntoShellScript } from "../../../shared/system/sudo-runtime.js";
import { packageInstaller, type InstallResult } from "../../../shared/system/installer.js";
import type {
  ColumnInfo,
  DatabaseInfo,
  EngineInfo,
  EngineType,
  InstallableEngine,
  MutationResult,
  QueryResult,
  TableInfo,
} from "../models/index.js";
import { identifierSchema } from "../models/index.js";
import { classifyStatement } from "./sql-util.js";
import {
  buildDelete,
  buildInsert,
  buildSelectRows,
  buildUpdate,
} from "./sql-builder.js";
import {
  adapterFor,
  engineLabel,
  type RawRunner,
} from "./engine-adapter.js";

const log = createModuleLogger("databases-service");

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Hard cap on a single-shot `exportDatabase` dump. The dump tool's whole stdout
 * is buffered in the panel's heap (as a JS string) and then `res.send()`, so a
 * multi-GB database would OOM `luxipanel-backend` (3.8 GB box). We bound the
 * transferred bytes at the source with `| head -c CAP+1`; if the dump would
 * exceed the cap we reject with 413 and tell the operator to dump over SSH.
 * 256 MiB covers virtually every panel-managed database.
 */
const DUMP_MAX_BYTES = 256 * 1024 * 1024;

/**
 * Run a shell command on the target with `sudo` credentials injected. `sudo`
 * lives inside `sh -lc '<body>'`, hidden from the executor-boundary
 * interceptor, so we inject the password into the body up-front.
 */
async function sh(executor: Executor, command: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const body = await injectSudoIntoShellScript(executor, command);
  return execShell(executor, body, { timeoutMs });
}

/** Bind `runRaw` to one (executor, engine) so adapters can re-query the target. */
function rawRunner(executor: Executor, engine: EngineType): RawRunner {
  return (sql, database) => databasesService.runRaw(executor, engine, sql, database);
}

/**
 * Probe one engine on the target: `command -v <bin>` then a version query when
 * the client exists. Cheap (two `sh` calls at most). `deriveFlavor`, when
 * given, maps the version string to the `flavor` field (mysql family only).
 */
async function probeEngine(
  executor: Executor,
  type: EngineType,
  bin: string,
  versionCmd: string,
  deriveFlavor?: (version: string) => string,
): Promise<EngineInfo> {
  const probe = await sh(executor, `command -v ${bin} >/dev/null 2>&1 && echo yes || echo no`, 8_000);
  const installed = probe.stdout.trim() === "yes";
  let running = false;
  let version: string | null = null;
  let flavor: string | undefined;
  if (installed) {
    const v = await sh(executor, versionCmd, 12_000);
    const out = v.stdout.trim().split("\n")[0]?.trim();
    if (v.exitCode === 0 && out) {
      running = true;
      version = out;
      if (deriveFlavor) flavor = deriveFlavor(out);
    }
  }
  const info: EngineInfo = { type, label: engineLabel(type), installed, running, version };
  if (deriveFlavor) info.flavor = flavor;
  return info;
}

export const databasesService = {
  async createDatabase(executor: Executor, engine: EngineType, name: string): Promise<void> {
    const safeName = identifierSchema.parse(name);
    await this.runRaw(executor, engine, `CREATE DATABASE ${adapterFor(engine).quoteIdent(safeName)};`, null);
  },
  /**
   * Detect which engines are installed and reachable on the target. Cheap:
   * one `command -v` per engine plus one version query when the client exists.
   */
  async detectEngines(executor: Executor): Promise<EngineInfo[]> {
    const mysql = await probeEngine(
      executor,
      "mysql",
      "mysql",
      `sudo -n mysql --batch --skip-column-names -e ${quoteArg("SELECT VERSION();")} 2>/dev/null`,
      (out) => (/mariadb/i.test(out) ? "MariaDB" : "MySQL"),
    );
    const postgres = await probeEngine(
      executor,
      "postgresql",
      "psql",
      `sudo -n -u postgres psql -X -q -At -c ${quoteArg("SHOW server_version;")} 2>/dev/null`,
    );
    return [mysql, postgres];
  },

  /** List user databases for an engine. */
  async listDatabases(executor: Executor, engine: EngineType): Promise<DatabaseInfo[]> {
    const adapter = adapterFor(engine);
    const { rows } = await this.runRaw(executor, engine, adapter.listDatabasesSql(), null);
    return rows
      .filter((r) => !adapter.systemDbs.has(r[0] ?? ""))
      .map((r) => {
        const meta = adapter.databaseMeta(r);
        return {
          name: r[0] ?? "",
          type: engine,
          tables: meta.tables,
          sizeBytes: meta.sizeBytes,
        };
      });
  },

  /** List tables (with row estimate + size) in a database. */
  async listTables(executor: Executor, engine: EngineType, database: string): Promise<TableInfo[]> {
    const adapter = adapterFor(engine);
    const { rows } = await this.runRaw(
      executor,
      engine,
      adapter.listTablesSql(database),
      adapter.catalogDbArg(database),
    );
    return rows.map((r) => {
      const meta = adapter.tableMeta(r);
      const info: TableInfo = {
        name: r[0] ?? "",
        rows: meta.rows,
        sizeBytes: meta.sizeBytes,
      };
      if (meta.engine !== undefined) info.engine = meta.engine;
      return info;
    });
  },

  /** Describe a table's columns. */
  async listColumns(
    executor: Executor,
    engine: EngineType,
    database: string,
    table: string,
  ): Promise<ColumnInfo[]> {
    return adapterFor(engine).listColumns(rawRunner(executor, engine), database, table);
  },

  /**
   * Return the column names that make up a table's PRIMARY KEY (in key order).
   * Empty when the table has none — the UI uses this to gate row edit/delete,
   * and the mutation paths refuse a WHERE that isn't the full primary key.
   */
  async getPrimaryKey(
    executor: Executor,
    engine: EngineType,
    database: string,
    table: string,
  ): Promise<string[]> {
    return adapterFor(engine).primaryKey(rawRunner(executor, engine), database, table);
  },

  /** Browse table rows (paginated). */
  async listRows(
    executor: Executor,
    engine: EngineType,
    database: string,
    table: string,
    limit: number,
    offset: number,
    sortBy?: string,
    sortDir: "asc" | "desc" = "asc",
  ): Promise<QueryResult> {
    // Schema-qualify so non-`public` PostgreSQL tables (custom schemas,
    // drizzle, …) are reachable instead of erroring as "relation does not
    // exist"; for MySQL this is just the quoted identifier.
    const ident = await this.qualifiedIdent(executor, engine, database, table);
    const primary = (await this.listColumns(executor, engine, database, table)).filter(column => column.isPrimaryKey || column.key === "PRI").map(column => column.name);
    const quote = adapterFor(engine).quoteIdent;
    const order = [...(sortBy ? [`${quote(sortBy)} ${sortDir === "desc" ? "DESC" : "ASC"}`] : []), ...primary.filter(name=>name!==sortBy).map(name=>`${quote(name)} ASC`)];
    const sql = buildSelectRows(ident, limit, offset, order.length ? order.join(", ") : undefined);
    const started = Date.now();
    const [{ columns, rows }, count] = await Promise.all([
      this.runRaw(executor, engine, sql, database),
      this.runRaw(executor, engine, `SELECT COUNT(*) AS total FROM ${ident};`, database),
    ]);
    return {
      columns,
      rows,
      total: Number(count.rows[0]?.[0] ?? rows.length),
      rowCount: rows.length,
      kind: "read",
      durationMs: Date.now() - started,
      truncated: rows.length >= limit,
    };
  },

  /**
   * Execute an arbitrary statement from the SQL console. Read statements are
   * always allowed; mutating statements require `allowWrite` (set by the UI's
   * explicit write affordance) — otherwise we refuse before touching the box.
   */
  async runQuery(
    executor: Executor,
    engine: EngineType,
    sql: string,
    database: string | null,
    options: { limit: number; allowWrite: boolean },
  ): Promise<QueryResult> {
    const kind = classifyStatement(sql);
    if (kind === "write" && !options.allowWrite) {
      throw new ValidationError(
        "This looks like a write/DDL statement. Enable “Allow write” to run it.",
      );
    }
    const started = Date.now();
    const { columns, rows } = await this.runRaw(executor, engine, sql, database);
    const truncated = rows.length > options.limit;
    return {
      columns,
      rows: truncated ? rows.slice(0, options.limit) : rows,
      rowCount: truncated ? options.limit : rows.length,
      kind,
      affectedRows: kind === "write" ? null : undefined,
      durationMs: Date.now() - started,
      truncated,
    };
  },

  /**
   * Build the engine-quoted, (for PostgreSQL) schema-qualified identifier for
   * a table, so mutations reach tables outside the default search_path.
   */
  async qualifiedIdent(
    executor: Executor,
    engine: EngineType,
    database: string,
    table: string,
  ): Promise<string> {
    return adapterFor(engine).qualifiedIdent(rawRunner(executor, engine), database, table);
  },

  /** Insert one record. `values` maps column → value (null = SQL NULL). */
  async insertRecord(
    executor: Executor,
    engine: EngineType,
    database: string,
    table: string,
    values: Record<string, string | null>,
  ): Promise<MutationResult> {
    const cols = assertColumns(Object.keys(values));
    if (cols.length === 0) throw new ValidationError("No hay valores para insertar.");
    const adapter = adapterFor(engine);
    const ident = await this.qualifiedIdent(executor, engine, database, table);
    const sql = buildInsert(adapter, ident, cols, values);
    await this.runRaw(executor, engine, sql, database);
    return { affectedRows: 1 };
  },

  /**
   * Update one record. `where` must be the table's FULL primary key (column →
   * original value); we refuse anything else so a single edit can't fan out
   * across rows.
   */
  async updateRecord(
    executor: Executor,
    engine: EngineType,
    database: string,
    table: string,
    values: Record<string, string | null>,
    where: Record<string, string | null>,
  ): Promise<MutationResult> {
    const setCols = assertColumns(Object.keys(values));
    if (setCols.length === 0) throw new ValidationError("No hay cambios para guardar.");
    await this.assertWhereIsPrimaryKey(executor, engine, database, table, where);
    const adapter = adapterFor(engine);
    const ident = await this.qualifiedIdent(executor, engine, database, table);
    const whereCols = assertColumns(Object.keys(where));
    const sql = buildUpdate(adapter, ident, setCols, values, whereCols, where);
    await this.runRaw(executor, engine, sql, database);
    return { affectedRows: null };
  },

  /** Delete one record, identified by its full primary key. */
  async deleteRecord(
    executor: Executor,
    engine: EngineType,
    database: string,
    table: string,
    where: Record<string, string | null>,
  ): Promise<MutationResult> {
    await this.assertWhereIsPrimaryKey(executor, engine, database, table, where);
    const adapter = adapterFor(engine);
    const ident = await this.qualifiedIdent(executor, engine, database, table);
    const whereCols = assertColumns(Object.keys(where));
    const sql = buildDelete(adapter, ident, whereCols, where);
    await this.runRaw(executor, engine, sql, database);
    return { affectedRows: null };
  },

  /**
   * Refuse a row mutation whose WHERE isn't exactly the table's primary key:
   * a non-PK / partial WHERE could match many rows. Tables without a primary
   * key can't be edited/deleted row-by-row (the UI hides those actions too).
   */
  async assertWhereIsPrimaryKey(
    executor: Executor,
    engine: EngineType,
    database: string,
    table: string,
    where: Record<string, string | null>,
  ): Promise<void> {
    const pk = await this.getPrimaryKey(executor, engine, database, table);
    if (pk.length === 0) {
      throw new ValidationError(
        "Esta tabla no tiene clave primaria; no se puede editar/eliminar fila por fila.",
      );
    }
    const keys = assertColumns(Object.keys(where));
    const pkSet = new Set(pk);
    if (keys.length !== pk.length || !keys.every((k) => pkSet.has(k))) {
      throw new ValidationError("La condición de la fila debe ser exactamente la clave primaria.");
    }
  },

  /**
   * Dump a database (optionally a subset of tables, optionally schema-only) to
   * a SQL script using the engine's native dump tool over the Executor. The
   * dump text is returned so the controller can stream it as a download.
   */
  async exportDatabase(
    executor: Executor,
    engine: EngineType,
    database: string,
    tables: string[],
    includeData: boolean,
  ): Promise<string> {
    const tbls = assertColumns(tables); // identifier validation (reused)
    const cmd = adapterFor(engine).dumpCmd(database, tbls, includeData);
    // Bound the transferred bytes so a huge database can't OOM the panel: pipe
    // the dump through `head -c CAP+1`. `head` closing the pipe early sends the
    // dump tool a SIGPIPE (harmless; default sh has no pipefail so the pipeline
    // exit stays head's 0). We read one byte past the cap so we can DETECT (not
    // silently truncate) an over-cap dump and reject it. No subshell wrapper:
    // the leading `sudo` must stay at a command position for the sudo injector.
    const bounded = `${cmd} | head -c ${DUMP_MAX_BYTES + 1}`;
    const res = await sh(executor, bounded, 180_000);
    if (res.exitCode !== 0) {
      const msg = (res.stderr || res.stdout || `dump exited with ${res.exitCode}`).trim();
      log.warn({ engine, exitCode: res.exitCode }, "Database export failed");
      throw new ValidationError(cleanEngineError(msg));
    }
    if (Buffer.byteLength(res.stdout, "utf-8") > DUMP_MAX_BYTES) {
      throw new AppError(
        `El volcado supera el límite de descarga directa (${Math.floor(DUMP_MAX_BYTES / (1024 * 1024))} MB). ` +
          `Genera el dump por SSH (mysqldump/pg_dump) en el servidor.`,
        413,
        ErrorCodes.PAYLOAD_TOO_LARGE,
      );
    }
    return res.stdout;
  },

  /**
   * Install a database engine on the target via the shared package installer.
   * `mariadb` → mariadb-server, `postgresql` → postgresql. The installer tries
   * the live session passphrase for sudo and surfaces SUDO_PASSWORD_REQUIRED
   * so the UI can prompt when needed.
   */
  async installEngine(
    executor: Executor,
    engine: InstallableEngine,
    sudoPassword?: string,
  ): Promise<InstallResult> {
    const spec =
      engine === "mariadb"
        ? { apt: ["mariadb-server"], dnf: ["mariadb-server"], yum: ["mariadb-server"], apk: ["mariadb", "mariadb-client"], pacman: ["mariadb"] }
        : { apt: ["postgresql"], dnf: ["postgresql-server"], yum: ["postgresql-server"], apk: ["postgresql"], pacman: ["postgresql"] };
    const result = await packageInstaller.install(executor, spec, { sudoPassword });
    if (result.ok) log.info({ engine, target: executor.target.id }, "Database engine installed");
    return result;
  },

  /**
   * Low-level runner: build the CLI invocation, execute on the target, parse
   * the result. Throws a ValidationError carrying the engine's own error text
   * on a non-zero exit so the UI surfaces a useful message.
   */
  async runRaw(
    executor: Executor,
    engine: EngineType,
    sql: string,
    database: string | null,
  ): Promise<{ columns: string[]; rows: string[][] }> {
    const adapter = adapterFor(engine);
    const res = await sh(executor, adapter.cliCmd(sql, database));
    if (res.exitCode !== 0) {
      const msg = (res.stderr || res.stdout || `${engine} exited with ${res.exitCode}`).trim();
      log.warn({ engine, exitCode: res.exitCode }, "Database query failed");
      throw new ValidationError(cleanEngineError(msg));
    }
    return adapter.parse(res.stdout);
  },
};

// ── helpers ──────────────────────────────────────────────────────────────

/**
 * Validate a set of column names with the shared identifier schema. The values
 * are still engine-quoted before use; this is the cheap up-front line of
 * defence (rejects backticks/quotes/NUL) shared by every mutation path.
 */
function assertColumns(names: string[]): string[] {
  return names.map((n) => identifierSchema.parse(n));
}

/** Trim the verbose framing engines wrap around error messages. */
function cleanEngineError(msg: string): string {
  return msg
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
}
