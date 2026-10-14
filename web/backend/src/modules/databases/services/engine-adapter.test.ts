// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Engine-adapter characterization tests: pin the catalogue SQL, CLI command
 * lines and identifier quoting per engine, plus a PERF regression test proving
 * `listColumns` resolves the PostgreSQL schema exactly once (not twice).
 */
import { describe, it, expect } from "vitest";
import { adapterFor, engineLabel, type RawRunner } from "./engine-adapter.js";

const mysql = adapterFor("mysql");
const pg = adapterFor("postgresql");

describe("adapter identifier quoting", () => {
  it("quotes and doubles delimiters", () => {
    expect(mysql.quoteIdent("a`b")).toBe("`a``b`");
    expect(pg.quoteIdent('a"b')).toBe('"a""b"');
  });
});

describe("adapter labels + registry", () => {
  it("maps engines to labels", () => {
    expect(engineLabel("mysql")).toBe("MySQL / MariaDB");
    expect(engineLabel("postgresql")).toBe("PostgreSQL");
  });
});

describe("mysql catalogue SQL + CLI", () => {
  it("lists databases via information_schema.SCHEMATA", () => {
    expect(mysql.listDatabasesSql()).toContain("FROM information_schema.SCHEMATA");
  });
  it("filters listTables by an escaped TABLE_SCHEMA literal", () => {
    expect(mysql.listTablesSql("d'b")).toContain("WHERE TABLE_SCHEMA = 'd''b'");
  });
  it("builds a batch CLI with -D and -e", () => {
    expect(mysql.cliCmd("SELECT 1", "db")).toBe(
      "sudo -n mysql --batch --default-character-set=utf8mb4 -D 'db' -e 'SELECT 1'",
    );
    expect(mysql.cliCmd("SELECT 1", null)).toBe(
      "sudo -n mysql --batch --default-character-set=utf8mb4 -e 'SELECT 1'",
    );
  });
  it("catalog queries take a null db arg; qualifiedIdent is just the quoted name", async () => {
    expect(mysql.catalogDbArg("db")).toBeNull();
    const noop: RawRunner = async () => ({ columns: [], rows: [] });
    expect(await mysql.qualifiedIdent(noop, "db", "tbl")).toBe("`tbl`");
  });
});

describe("postgres catalogue SQL + CLI", () => {
  it("lists databases via pg_database", () => {
    expect(pg.listDatabasesSql()).toContain("FROM pg_database");
  });
  it("passes the database through as the catalog arg", () => {
    expect(pg.catalogDbArg("mydb")).toBe("mydb");
  });
  it("builds a --csv CLI with -d and -c", () => {
    expect(pg.cliCmd("SELECT 1", "mydb")).toBe(
      "sudo -n -u postgres psql --csv -X -q -d 'mydb' -c 'SELECT 1'",
    );
    expect(pg.cliCmd("SELECT 1", null)).toBe(
      "sudo -n -u postgres psql --csv -X -q -d 'postgres' -c 'SELECT 1'",
    );
  });
});

// ── PERF: schema resolution should happen ONCE per listColumns ──────────────

/** A RawRunner that records every SQL it is asked to run and answers the three
 *  query shapes listColumns/primaryKey need with canned rows. */
function recordingRunner(): { run: RawRunner; sqls: string[] } {
  const sqls: string[] = [];
  const run: RawRunner = async (sql) => {
    sqls.push(sql);
    if (sql.includes("n.nspname FROM pg_class")) return { columns: ["nspname"], rows: [["public"]] };
    if (sql.includes("FROM pg_index")) return { columns: ["attname"], rows: [["id"]] };
    if (sql.includes("information_schema.columns")) {
      return { columns: ["c"], rows: [["id", "integer", "NO", null]] };
    }
    return { columns: [], rows: [] };
  };
  return { run, sqls };
}

const isSchemaResolve = (s: string): boolean => s.includes("n.nspname FROM pg_class");

describe("postgres listColumns perf", () => {
  it("resolves the schema exactly once (was twice: listColumns + primaryKey)", async () => {
    const { run, sqls } = recordingRunner();
    const cols = await pg.listColumns(run, "mydb", "widgets");
    expect(sqls.filter(isSchemaResolve).length).toBe(1);
    // one schema-resolve + one information_schema.columns + one pg_index PK query
    expect(sqls.length).toBe(3);
    expect(cols[0]).toMatchObject({ name: "id", isPrimaryKey: true, key: "PRI" });
  });

  it("primaryKey() alone resolves once then queries pg_index (two round-trips)", async () => {
    const { run, sqls } = recordingRunner();
    const pk = await pg.primaryKey(run, "mydb", "widgets");
    expect(pk).toEqual(["id"]);
    expect(sqls.filter(isSchemaResolve).length).toBe(1);
    expect(sqls.length).toBe(2);
  });

  it("qualifiedIdent resolves the schema and quotes both parts", async () => {
    const { run, sqls } = recordingRunner();
    expect(await pg.qualifiedIdent(run, "mydb", "widgets")).toBe('"public"."widgets"');
    expect(sqls.filter(isSchemaResolve).length).toBe(1);
  });
});
