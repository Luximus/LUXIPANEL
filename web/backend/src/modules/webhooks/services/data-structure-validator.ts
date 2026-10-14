// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Data-structure validation for inbound gateway payloads.
 *
 * Mirrors the Make.com "Data structure" feature: validate the incoming object
 * against a list of typed fields, applying defaults, coercing primitives and
 * (in `strict` mode) rejecting unspecified keys. Empty/absent structure means
 * "pass the received data through without validation".
 */

import type { DataStructure, DataStructureField } from "../models/gateway-webhook.model.js";

export interface ValidationResult {
  ok: boolean;
  /** The coerced/defaulted object when ok; the original input otherwise. */
  value: Record<string, unknown>;
  errors: string[];
}

/**
 * A single per-type coercion rule. Returns the coerced value plus an optional
 * human-readable error message; the caller folds errors into `ValidationResult`.
 * A `FieldCoercer` MUST be total — it must produce `{ value }` for any input,
 * leaving validation feedback to the `error` field rather than throwing.
 */
export type FieldCoercer = (
  field: DataStructureField,
  raw: unknown,
) => { value: unknown; error?: string };

/**
 * Registry of coercers keyed by `DataStructureField.type`. Adding a new type
 * is a one-line entry in this table; the dispatch loop in `coerce()` stays
 * untouched. The default branch (unknown type) preserves the legacy behaviour
 * of returning the raw value through, so future field types added to the
 * model without a coercer won't reject payloads.
 */
export const FIELD_COERCERS: Record<string, FieldCoercer> = {
  text: (_field, raw) => ({
    value: raw === undefined || raw === null ? raw : String(raw),
  }),
  number: (_field, raw) => {
    if (typeof raw === "number") return { value: raw };
    const n = Number(raw);
    if (Number.isNaN(n)) return { value: raw, error: `"${_field.name}" must be a number` };
    return { value: n };
  },
  boolean: (field, raw) => {
    if (typeof raw === "boolean") return { value: raw };
    const s = String(raw).toLowerCase().trim();
    if (s === "true" || s === "1" || s === "yes") return { value: true };
    if (s === "false" || s === "0" || s === "no") return { value: false };
    return { value: raw, error: `"${field.name}" must be a boolean` };
  },
  date: (field, raw) => {
    const d = new Date(String(raw));
    if (Number.isNaN(d.getTime())) return { value: raw, error: `"${field.name}" must be a date` };
    return { value: d.toISOString() };
  },
  array: (field, raw) =>
    Array.isArray(raw)
      ? { value: raw }
      : { value: raw, error: `"${field.name}" must be an array` },
  collection: (field, raw) =>
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { value: raw }
      : { value: raw, error: `"${field.name}" must be an object` },
};

function coerce(field: DataStructureField, raw: unknown): { value: unknown; error?: string } {
  const coercer = FIELD_COERCERS[field.type];
  if (!coercer) return { value: raw };
  return coercer(field, raw);
}

/**
 * Validate `input` against `structure`. When `structure` is null/empty, the
 * input is returned unchanged with ok=true.
 */
export function validateDataStructure(
  structure: DataStructure | null | undefined,
  input: Record<string, unknown>,
): ValidationResult {
  if (!structure || !structure.fields || structure.fields.length === 0) {
    return { ok: true, value: input, errors: [] };
  }

  const errors: string[] = [];
  const out: Record<string, unknown> = {};
  const specified = new Set(structure.fields.map((f) => f.name));

  for (const field of structure.fields) {
    const present = Object.prototype.hasOwnProperty.call(input, field.name);
    let raw = present ? input[field.name] : undefined;

    if ((raw === undefined || raw === null || raw === "") && field.defaultValue !== undefined && field.defaultValue !== "") {
      raw = field.defaultValue;
    }

    const missing = raw === undefined || raw === null || raw === "";
    if (missing) {
      if (field.required) errors.push(`"${field.name}" is required`);
      continue;
    }

    const { value, error } = coerce(field, raw);
    if (error) errors.push(error);
    out[field.name] = value;
  }

  if (structure.strict) {
    for (const key of Object.keys(input)) {
      if (!specified.has(key)) errors.push(`Unexpected field "${key}" (strict mode)`);
    }
  } else {
    // Non-strict: keep unspecified keys as-is.
    for (const key of Object.keys(input)) {
      if (!specified.has(key)) out[key] = input[key];
    }
  }

  return { ok: errors.length === 0, value: out, errors };
}
