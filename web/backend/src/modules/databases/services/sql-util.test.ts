// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import {
  classifyStatement,
  findCreatedDatabaseNames,
  parseMysqlTsv,
  parsePgCsv,
  quoteMysqlIdent,
  quotePgIdent,
  splitStatements,
} from "./sql-util.js";

describe("classifyStatement", () => {
  it("treats SELECT/SHOW/EXPLAIN/WITH as read", () => {
    expect(classifyStatement("SELECT 1")).toBe("read");
    expect(classifyStatement("  show tables")).toBe("read");
    expect(classifyStatement("EXPLAIN SELECT * FROM t")).toBe("read");
    expect(classifyStatement("WITH x AS (SELECT 1) SELECT * FROM x")).toBe("read");
  });

  it("treats mutating/DDL as write", () => {
    expect(classifyStatement("UPDATE t SET a=1")).toBe("write");
    expect(classifyStatement("DROP TABLE t")).toBe("write");
    expect(classifyStatement("delete from t")).toBe("write");
    expect(classifyStatement("INSERT INTO t VALUES (1)")).toBe("write");
  });

  it("ignores leading comments", () => {
    expect(classifyStatement("-- a comment\nSELECT 1")).toBe("read");
    expect(classifyStatement("/* block */ select 1")).toBe("read");
  });

  it("classifies stacked queries by ALL statements, not just the first", () => {
    // The bypass: a write hidden behind a leading read.
    expect(classifyStatement("SELECT 1; DROP TABLE t;")).toBe("write");
    expect(classifyStatement("SELECT 1; UPDATE t SET a=1")).toBe("write");
    // All-read stacks stay read.
    expect(classifyStatement("SELECT 1; SELECT 2;")).toBe("read");
    expect(classifyStatement("SELECT 1;")).toBe("read");
  });

  it("does not split on ';' inside string literals", () => {
    expect(classifyStatement("SELECT ';drop table t;'")).toBe("read");
    expect(classifyStatement("SELECT 'a'';b'")).toBe("read");
  });

  it("treats empty/comment-only input as write (conservative)", () => {
    expect(classifyStatement("")).toBe("write");
    expect(classifyStatement("-- just a comment")).toBe("write");
  });

  it("does not treat comment markers INSIDE string literals as comments", () => {
    // A naïve regex comment-strip would span the two '/*' … '*/' literals and
    // swallow the middle DROP, misclassifying the stacked write as a read.
    expect(classifyStatement("SELECT '/*'; DROP TABLE t; SELECT '*/'")).toBe("write");
    // …and the all-read shape stays read.
    expect(classifyStatement("SELECT '/*'; SELECT '*/'")).toBe("read");
  });

  it("does not classify a CREATE hidden inside a string literal as a write leak", () => {
    // The CREATE is data, not a statement — the statement is a SELECT.
    expect(classifyStatement("SELECT 'CREATE DATABASE x'")).toBe("read");
  });
});

describe("splitStatements", () => {
  it("splits on top-level ; and strips comments in one pass", () => {
    expect(splitStatements("SELECT 1; -- c\n SELECT 2;")).toEqual(["SELECT 1", "SELECT 2"]);
    expect(splitStatements("SELECT 1 /* mid */ ; SELECT 2")).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("never splits or strips inside string/backtick literals", () => {
    expect(splitStatements("SELECT ';--/*'")).toEqual(["SELECT ';--/*'"]);
    expect(splitStatements("SELECT `a;b`")).toEqual(["SELECT `a;b`"]);
    expect(splitStatements("SELECT 'a'';b'")).toEqual(["SELECT 'a'';b'"]);
  });
});

describe("findCreatedDatabaseNames", () => {
  it("finds the obvious CREATE DATABASE / SCHEMA form", () => {
    expect(findCreatedDatabaseNames("CREATE DATABASE foo")).toEqual(["foo"]);
    expect(findCreatedDatabaseNames("create schema IF NOT EXISTS bar_baz")).toEqual(["bar_baz"]);
    expect(findCreatedDatabaseNames("CREATE DATABASE `q`")).toEqual(["q"]);
    expect(findCreatedDatabaseNames('CREATE DATABASE "q2"')).toEqual(["q2"]);
  });

  it("is not fooled by comment obfuscation between/after the keywords", () => {
    // Both slipped past the old single regex (which required literal whitespace).
    expect(findCreatedDatabaseNames("CREATE/**/DATABASE evil")).toEqual(["evil"]);
    expect(findCreatedDatabaseNames("CREATE DATABASE/**/evil2")).toEqual(["evil2"]);
    expect(findCreatedDatabaseNames("CREATE  --x\n DATABASE evil3")).toEqual(["evil3"]);
  });

  it("catches EVERY create in a multi-statement submission (cap-bypass fix)", () => {
    expect(findCreatedDatabaseNames("CREATE DATABASE a; CREATE DATABASE b;")).toEqual(["a", "b"]);
    expect(findCreatedDatabaseNames("SELECT 1; CREATE DATABASE mid; SELECT 2")).toEqual(["mid"]);
  });

  it("does not match a CREATE hidden inside a string literal", () => {
    expect(findCreatedDatabaseNames("SELECT 'CREATE DATABASE evil'")).toEqual([]);
    expect(findCreatedDatabaseNames("INSERT INTO t VALUES ('CREATE DATABASE x')")).toEqual([]);
  });

  it("returns nothing for non-create statements", () => {
    expect(findCreatedDatabaseNames("SELECT 1")).toEqual([]);
    expect(findCreatedDatabaseNames("DROP DATABASE foo")).toEqual([]);
    expect(findCreatedDatabaseNames("CREATE TABLE t (id int)")).toEqual([]);
  });
});

describe("identifier quoting", () => {
  it("doubles embedded delimiters", () => {
    expect(quoteMysqlIdent("a`b")).toBe("`a``b`");
    expect(quotePgIdent('a"b')).toBe('"a""b"');
  });
});

describe("parseMysqlTsv", () => {
  it("parses header + rows and unescapes", () => {
    const out = parseMysqlTsv("id\tname\n1\tA\\tB\n2\tC");
    expect(out.columns).toEqual(["id", "name"]);
    expect(out.rows).toEqual([
      ["1", "A\tB"],
      ["2", "C"],
    ]);
  });

  it("returns empty for empty output", () => {
    expect(parseMysqlTsv("")).toEqual({ columns: [], rows: [] });
  });
});

describe("parsePgCsv", () => {
  it("parses quoted CSV with embedded commas and quotes", () => {
    const out = parsePgCsv('id,name\n1,"Doe, John"\n2,"a""b"\n');
    expect(out.columns).toEqual(["id", "name"]);
    expect(out.rows).toEqual([
      ["1", "Doe, John"],
      ["2", 'a"b'],
    ]);
  });

  it("returns empty for empty output", () => {
    expect(parsePgCsv("")).toEqual({ columns: [], rows: [] });
  });
});
