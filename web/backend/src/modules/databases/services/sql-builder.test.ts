// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization + injection tests for the pure SQL builders. These pin the
 * EXACT SQL text produced for every single-record CRUD / browse operation
 * (byte-for-byte identical to the previous inline construction) and assert that
 * hostile identifiers and values are neutralized by engine quoting/escaping.
 */
import { describe, it, expect } from "vitest";
import { adapterFor } from "./engine-adapter.js";
import {
  buildDelete,
  buildInsert,
  buildSelectRows,
  buildUpdate,
  buildWhereClause,
  sqlLiteral,
} from "./sql-builder.js";

const mysql = adapterFor("mysql");
const pg = adapterFor("postgresql");

describe("buildSelectRows", () => {
  it("emits SELECT * with the pre-quoted ident and integer bounds", () => {
    expect(buildSelectRows("`t`", 100, 0)).toBe("SELECT * FROM `t` LIMIT 100 OFFSET 0;");
    expect(buildSelectRows('"s"."t"', 50, 25)).toBe('SELECT * FROM "s"."t" LIMIT 50 OFFSET 25;');
  });
});

describe("sqlLiteral", () => {
  it("maps null → NULL and escapes strings per engine", () => {
    expect(sqlLiteral(mysql, null)).toBe("NULL");
    expect(sqlLiteral(mysql, "x")).toBe("'x'");
    expect(sqlLiteral(pg, "x")).toBe("'x'");
  });
});

describe("buildInsert (mysql)", () => {
  it("quotes columns and escapes values", () => {
    const sql = buildInsert(mysql, "`t`", ["a", "b"], { a: "x", b: null });
    expect(sql).toBe("INSERT INTO `t` (`a`, `b`) VALUES ('x', NULL);");
  });

  it("neutralizes a hostile value (quote-injection)", () => {
    const sql = buildInsert(mysql, "`t`", ["a"], { a: "x'); DROP TABLE t;--" });
    // The apostrophe is doubled and the whole thing stays one string literal.
    expect(sql).toBe("INSERT INTO `t` (`a`) VALUES ('x''); DROP TABLE t;--');");
  });

  it("neutralizes a hostile column name (backtick-injection)", () => {
    const sql = buildInsert(mysql, "`t`", ["a`) VALUES(1);--"], { "a`) VALUES(1);--": "1" });
    expect(sql).toBe("INSERT INTO `t` (`a``) VALUES(1);--`) VALUES ('1');");
  });

  it("escapes backslashes for mysql values", () => {
    expect(buildInsert(mysql, "`t`", ["a"], { a: "a\\b" })).toBe(
      "INSERT INTO `t` (`a`) VALUES ('a\\\\b');",
    );
  });
});

describe("buildInsert (postgres)", () => {
  it("quotes columns and escapes values with double-quote doubling", () => {
    const sql = buildInsert(pg, '"t"', ["a", "b"], { a: "o'brien", b: null });
    expect(sql).toBe(`INSERT INTO "t" ("a", "b") VALUES ('o''brien', NULL);`);
  });
});

describe("buildWhereClause", () => {
  it("uses = for values and IS NULL for null (mysql)", () => {
    expect(buildWhereClause(mysql, ["id", "k"], { id: "5", k: null })).toBe(
      "`id` = '5' AND `k` IS NULL",
    );
  });
});

describe("buildUpdate", () => {
  it("builds SET + primary-key WHERE (mysql)", () => {
    const sql = buildUpdate(mysql, "`t`", ["name"], { name: "Ann" }, ["id"], { id: "7" });
    expect(sql).toBe("UPDATE `t` SET `name` = 'Ann' WHERE `id` = '7';");
  });

  it("builds SET + WHERE (postgres, schema-qualified ident)", () => {
    const sql = buildUpdate(pg, '"s"."t"', ["v"], { v: null }, ["id"], { id: "1" });
    expect(sql).toBe(`UPDATE "s"."t" SET "v" = NULL WHERE "id" = '1';`);
  });
});

describe("buildDelete", () => {
  it("builds DELETE with a primary-key WHERE (mysql)", () => {
    expect(buildDelete(mysql, "`t`", ["id"], { id: "3" })).toBe(
      "DELETE FROM `t` WHERE `id` = '3';",
    );
  });
});
