// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * SQL builders — PURE construction of the row-browse and single-record CRUD
 * statements the databases service runs. Extracted from `databases.service` so
 * the actual SQL text is unit-testable in isolation (no executor) and lives in
 * one auditable place.
 *
 * SECURITY CONTRACT (why this is injection-safe even though it string-builds):
 *   - IDENTIFIERS (table/column) are ALWAYS emitted through the engine adapter's
 *     `quoteIdent` (backtick/double-quote with delimiter doubling). The caller
 *     passes a pre-resolved, already-quoted qualified table `ident` and RAW
 *     column names; columns are quoted here. Callers additionally validate
 *     column names against `identifierSchema` up-front (defence in depth).
 *   - VALUES are ALWAYS emitted through the adapter's `stringLiteral` (engine
 *     escaping) or a real `NULL`. They are never concatenated raw. Parameter
 *     placeholders are not available: the engines are driven through their CLI
 *     (`mysql -e` / `psql -c`), which has no bind-parameter channel, so an
 *     engine-escaped literal is the correct and only mechanism.
 * A hostile identifier/value therefore cannot break out of its quoting.
 */

import type { EngineAdapter } from "./engine-adapter.js";

/** SQL literal for a cell value: real NULL, or an engine-escaped string literal. */
export function sqlLiteral(adapter: EngineAdapter, value: string | null): string {
  if (value === null) return "NULL";
  return adapter.stringLiteral(value);
}

/**
 * `SELECT * FROM <ident> LIMIT <limit> OFFSET <offset>`. `ident` is the
 * adapter-quoted (and, for PostgreSQL, schema-qualified) table identifier;
 * `limit`/`offset` are integers already validated by the request schema.
 */
export function buildSelectRows(ident: string, limit: number, offset: number, orderBy?: string): string {
  return `SELECT * FROM ${ident}${orderBy ? ` ORDER BY ${orderBy}` : ""} LIMIT ${limit} OFFSET ${offset};`;
}

/** `INSERT INTO <ident> (<cols>) VALUES (<lits>)`. `cols` are validated names. */
export function buildInsert(
  adapter: EngineAdapter,
  ident: string,
  cols: string[],
  values: Record<string, string | null>,
): string {
  const colList = cols.map((c) => adapter.quoteIdent(c)).join(", ");
  const valList = cols.map((c) => sqlLiteral(adapter, values[c] ?? null)).join(", ");
  return `INSERT INTO ${ident} (${colList}) VALUES (${valList});`;
}

/** `col = lit AND col IS NULL …` for a primary-key WHERE (validated columns). */
export function buildWhereClause(
  adapter: EngineAdapter,
  cols: string[],
  where: Record<string, string | null>,
): string {
  return cols
    .map((c) => {
      const v = where[c] ?? null;
      return v === null
        ? `${adapter.quoteIdent(c)} IS NULL`
        : `${adapter.quoteIdent(c)} = ${sqlLiteral(adapter, v)}`;
    })
    .join(" AND ");
}

/** `UPDATE <ident> SET <set> WHERE <pk>`. `setCols`/`whereCols` are validated. */
export function buildUpdate(
  adapter: EngineAdapter,
  ident: string,
  setCols: string[],
  values: Record<string, string | null>,
  whereCols: string[],
  where: Record<string, string | null>,
): string {
  const setClause = setCols
    .map((c) => `${adapter.quoteIdent(c)} = ${sqlLiteral(adapter, values[c] ?? null)}`)
    .join(", ");
  return `UPDATE ${ident} SET ${setClause} WHERE ${buildWhereClause(adapter, whereCols, where)};`;
}

/** `DELETE FROM <ident> WHERE <pk>`. `whereCols` are validated. */
export function buildDelete(
  adapter: EngineAdapter,
  ident: string,
  whereCols: string[],
  where: Record<string, string | null>,
): string {
  return `DELETE FROM ${ident} WHERE ${buildWhereClause(adapter, whereCols, where)};`;
}
