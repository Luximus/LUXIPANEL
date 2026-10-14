// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization tests — webhooks/services/data-structure-validator.ts
 *
 * Locks the observable contract of `validateDataStructure` and the
 * `FIELD_COERCERS` registry as used by the gateway ingest pipeline: empty
 * structure = pass-through, required-field enforcement, per-type coercion,
 * default application, and strict vs non-strict handling of unspecified keys.
 */

import { describe, it, expect } from "vitest";
import {
  validateDataStructure,
  FIELD_COERCERS,
} from "./data-structure-validator.js";
import type { DataStructure, DataStructureField } from "../models/gateway-webhook.model.js";

function field(partial: Partial<DataStructureField> & { name: string }): DataStructureField {
  return {
    description: "",
    type: "text",
    required: false,
    multiline: false,
    ...partial,
  };
}

function structure(fields: DataStructureField[], strict = false): DataStructure {
  return { name: "", strict, fields };
}

describe("validateDataStructure — pass-through", () => {
  it("null structure returns input unchanged with ok=true", () => {
    const input = { a: 1, b: "x" };
    const r = validateDataStructure(null, input);
    expect(r.ok).toBe(true);
    expect(r.value).toBe(input);
    expect(r.errors).toEqual([]);
  });

  it("structure with no fields returns input unchanged", () => {
    const input = { a: 1 };
    const r = validateDataStructure(structure([]), input);
    expect(r.ok).toBe(true);
    expect(r.value).toBe(input);
  });
});

describe("validateDataStructure — required fields", () => {
  it("reports a missing required field", () => {
    const r = validateDataStructure(structure([field({ name: "email", required: true })]), {});
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('"email" is required');
  });

  it("passes when a required field is present", () => {
    const r = validateDataStructure(
      structure([field({ name: "email", required: true })]),
      { email: "a@b.com" },
    );
    expect(r.ok).toBe(true);
    expect(r.value.email).toBe("a@b.com");
  });

  it("an optional missing field is simply absent (no error)", () => {
    const r = validateDataStructure(structure([field({ name: "nick" })]), {});
    expect(r.ok).toBe(true);
    expect(r.value).not.toHaveProperty("nick");
  });
});

describe("validateDataStructure — defaults", () => {
  it("applies defaultValue when the field is absent/empty", () => {
    const r = validateDataStructure(
      structure([field({ name: "role", defaultValue: "user" })]),
      {},
    );
    expect(r.ok).toBe(true);
    expect(r.value.role).toBe("user");
  });

  it("a default satisfies a required field", () => {
    const r = validateDataStructure(
      structure([field({ name: "role", required: true, defaultValue: "user" })]),
      {},
    );
    expect(r.ok).toBe(true);
    expect(r.value.role).toBe("user");
  });
});

describe("validateDataStructure — coercion by type", () => {
  it("number: coerces numeric strings, rejects non-numbers", () => {
    const ok = validateDataStructure(structure([field({ name: "n", type: "number" })]), { n: "42" });
    expect(ok.ok).toBe(true);
    expect(ok.value.n).toBe(42);

    const bad = validateDataStructure(structure([field({ name: "n", type: "number" })]), { n: "abc" });
    expect(bad.ok).toBe(false);
    expect(bad.errors[0]).toContain("must be a number");
  });

  it("boolean: accepts true/1/yes and false/0/no", () => {
    const s = structure([field({ name: "b", type: "boolean" })]);
    expect(validateDataStructure(s, { b: "yes" }).value.b).toBe(true);
    expect(validateDataStructure(s, { b: "0" }).value.b).toBe(false);
    const bad = validateDataStructure(s, { b: "maybe" });
    expect(bad.ok).toBe(false);
  });

  it("date: coerces to ISO, rejects garbage", () => {
    const s = structure([field({ name: "d", type: "date" })]);
    const ok = validateDataStructure(s, { d: "2026-01-02" });
    expect(ok.ok).toBe(true);
    expect(String(ok.value.d)).toContain("2026-01-02");
    expect(validateDataStructure(s, { d: "not-a-date" }).ok).toBe(false);
  });

  it("array and collection enforce their JS shape", () => {
    const arr = structure([field({ name: "a", type: "array" })]);
    expect(validateDataStructure(arr, { a: [1, 2] }).ok).toBe(true);
    expect(validateDataStructure(arr, { a: "no" }).ok).toBe(false);

    const col = structure([field({ name: "c", type: "collection" })]);
    expect(validateDataStructure(col, { c: { k: 1 } }).ok).toBe(true);
    expect(validateDataStructure(col, { c: [1] }).ok).toBe(false);
  });

  it("FIELD_COERCERS registry has the six documented types", () => {
    expect(Object.keys(FIELD_COERCERS).sort()).toEqual(
      ["array", "boolean", "collection", "date", "number", "text"],
    );
  });

  it("an unknown field type passes the raw value through (default branch)", () => {
    const r = validateDataStructure(
      structure([field({ name: "x", type: "exotic" as unknown as DataStructureField["type"] })]),
      { x: { any: "thing" } },
    );
    expect(r.ok).toBe(true);
    expect(r.value.x).toEqual({ any: "thing" });
  });
});

describe("validateDataStructure — strict vs non-strict unknown keys", () => {
  it("non-strict keeps unspecified keys as-is", () => {
    const r = validateDataStructure(
      structure([field({ name: "known" })], false),
      { known: "a", extra: "b" },
    );
    expect(r.ok).toBe(true);
    expect(r.value.extra).toBe("b");
  });

  it("strict rejects unspecified keys", () => {
    const r = validateDataStructure(
      structure([field({ name: "known" })], true),
      { known: "a", extra: "b" },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("Unexpected field") && e.includes("extra"))).toBe(true);
  });
});
