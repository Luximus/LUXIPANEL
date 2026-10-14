// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Pure SQL helpers — identifier quoting, output parsing and statement
 * classification. No executor / express imports: trivially unit-testable.
 */

import type { StatementKind } from "../models/index.js";

/** Quote a MySQL identifier (backtick, doubling embedded backticks). */
export function quoteMysqlIdent(name: string): string {
  return "`" + name.replace(/`/g, "``") + "`";
}

/** Quote a PostgreSQL identifier (double-quote, doubling embedded quotes). */
export function quotePgIdent(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"';
}

const READ_KEYWORDS = new Set([
  "select",
  "show",
  "describe",
  "desc",
  "explain",
  "with",
  "values",
  "table",
  "pragma",
  "analyze",
]);

/**
 * Split a SQL string into individual statements on top-level `;` **while
 * stripping line (`--`) and block (`/* *\/`) comments in the same pass**. The
 * scan is string-aware: it never splits, nor treats comment markers as
 * comments, inside single-quoted, double-quoted or backtick-quoted literals
 * (doubled-quote and backslash escaping honoured). A single, string-aware pass
 * is what makes the read/write guard AND the tenant create-database gate robust
 * against the two classic evasions:
 *   - separators/keywords hidden inside string literals
 *     (`SELECT ';DROP TABLE t;'`), and
 *   - comment markers hidden inside string literals
 *     (`SELECT '/*'; CREATE DATABASE evil; SELECT '*\/'`) — a naïve
 *     regex comment-strip would span the two literals and swallow the middle
 *     statement, letting a stacked write/DDL slip past.
 *
 * Comments are replaced by a single space (so tokens on either side stay
 * separated) and each returned statement is trimmed; empty statements dropped.
 */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let current = "";
  let quote: string | null = null; // active quote char: ' " or `
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    if (quote) {
      current += ch;
      if (ch === "\\" && quote === "'") {
        // backslash escape inside single-quoted strings (MySQL)
        if (i + 1 < n) current += sql[++i];
      } else if (ch === quote) {
        if (sql[i + 1] === quote) {
          current += sql[++i]; // doubled quote → escaped, stay in string
        } else {
          quote = null;
        }
      }
      i++;
      continue;
    }
    // Outside any string literal: comments first, so a comment can never carry
    // a `;` or a hidden keyword into the statement stream.
    if (ch === "-" && sql[i + 1] === "-") {
      i += 2;
      while (i < n && sql[i] !== "\n") i++; // to end of line (newline kept)
      current += " ";
      continue;
    }
    if (ch === "/" && sql[i + 1] === "*") {
      i += 2;
      while (i < n && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i += 2; // consume the closing `*/` (past-EOF is harmless)
      current += " ";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      current += ch;
      i++;
      continue;
    }
    if (ch === ";") {
      out.push(current);
      current = "";
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  out.push(current);
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Classify a SQL string as read-only or mutating. Strips comments + splits into
 * statements (string-aware, see `splitStatements`) and inspects EACH
 * statement's first keyword. The whole input is `read` only if every statement
 * is clearly read-only; if any statement is (or might be) a write — or if no
 * statement is found — the result is `write`. Conservative by design: a stacked
 * write can never be classified as a read.
 */
export function classifyStatement(sql: string): StatementKind {
  const statements = splitStatements(sql);
  if (statements.length === 0) return "write";
  for (const stmt of statements) {
    const first = (stmt.match(/^[a-zA-Z]+/)?.[0] ?? "").toLowerCase();
    if (!READ_KEYWORDS.has(first)) return "write";
  }
  return "read";
}

/**
 * Extract the names of every database/schema a statement string CREATEs.
 *
 * The connected-server database console has no CRUD endpoint — tenants create
 * databases by running `CREATE DATABASE`/`CREATE SCHEMA` here. The hosting
 * tenant gate uses this to enforce the `<owner>_` naming convention and the
 * `maxDatabases` cap on EVERY created name, not just the first.
 *
 * Robustness: reuses the string-aware `splitStatements` (comments stripped,
 * literals respected), then anchors the CREATE match to each statement's start.
 * This closes the previous single-regex evasions:
 *   - comment obfuscation (`CREATE/x/DATABASE foo`, `CREATE DATABASE/x/foo`)
 *     — comments are gone before matching;
 *   - CREATE hidden inside a string literal — the enclosing statement does not
 *     start with CREATE, so it is not matched;
 *   - cap bypass via several CREATEs in one submission — every name is returned.
 * Handles back-tick / double-quote / single-quote quoted names and bare
 * identifiers.
 *
 * LIMITATION (documented, not closable by regex): dynamic SQL a determined
 * tenant could still use to create a database without a literal `CREATE
 * DATABASE` token — `PREPARE … FROM '…'; EXECUTE …`, a stored routine that
 * issues the DDL, etc. The real ownership boundary for those is engine-level
 * privileges (per-tenant GRANTs), NOT console SQL parsing. See README.
 */
export function findCreatedDatabaseNames(sql: string): string[] {
  const names: string[] = [];
  for (const stmt of splitStatements(sql)) {
    const m = stmt.match(
      /^CREATE\s+(?:DATABASE|SCHEMA)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`([^`]+)`|"([^"]+)"|'([^']+)'|([A-Za-z0-9_$]+))/i,
    );
    if (m) {
      const name = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
      if (name) names.push(name);
    }
  }
  return names;
}

/**
 * Unescape a single field from `mysql --batch` output. In batch mode mysql
 * escapes TAB, NEWLINE, CR, NUL and backslash with a leading backslash.
 */
function unescapeMysqlField(field: string): string {
  return field.replace(/\\(.)/g, (_m, c: string) => {
    switch (c) {
      case "t":
        return "\t";
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "0":
        return "\0";
      case "\\":
        return "\\";
      default:
        return c;
    }
  });
}

/**
 * Parse `mysql --batch` output: tab-separated, first line is the header row.
 * Returns empty columns/rows for empty output (e.g. a statement with no
 * result set).
 */
export function parseMysqlTsv(stdout: string): { columns: string[]; rows: string[][] } {
  const text = stdout.replace(/\n$/, "");
  if (text.length === 0) return { columns: [], rows: [] };
  const lines = text.split("\n");
  const columns = (lines[0] ?? "").split("\t").map(unescapeMysqlField);
  const rows = lines.slice(1).map((line) => line.split("\t").map(unescapeMysqlField));
  return { columns, rows };
}

/**
 * Parse `psql --csv` output (RFC-4180-ish): comma-separated, double-quote
 * quoting with `""` escaping, first record is the header.
 */
export function parsePgCsv(stdout: string): { columns: string[]; rows: string[][] } {
  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const s = stdout;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    records.push(row);
    row = [];
  };

  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      pushField();
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Trailing field/row (no terminating newline).
  if (field.length > 0 || row.length > 0) pushRow();

  const columns = records[0] ?? [];
  if (columns.length === 0) return { columns: [], rows: [] };
  const rows = records.slice(1);
  return { columns, rows };
}
