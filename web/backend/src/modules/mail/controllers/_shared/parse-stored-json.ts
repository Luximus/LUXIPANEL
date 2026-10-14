// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Parse a stored JSON string against a Zod schema, returning `fallback` when the
 * value is absent (null/undefined/"") OR fails to `JSON.parse`/validate.
 *
 * Consolidates the identical `if (!raw) return fallback; try {
 * schema.parse(JSON.parse(raw)) } catch { return fallback }` idiom that the mail
 * settings readers each spelled out by hand. Callers that also post-process the
 * validated value should fold that step into the schema with `.transform(...)`,
 * so a throwing transform still yields the fallback (parity with the originals,
 * which ran the transform inside the same try/catch).
 */

import type { TypeOf, ZodType } from "zod";

export function parseStoredJson<S extends ZodType>(
  raw: string | null | undefined,
  schema: S,
  fallback: TypeOf<S>,
): TypeOf<S> {
  if (!raw) return fallback;
  try {
    return schema.parse(JSON.parse(raw)) as TypeOf<S>;
  } catch {
    return fallback;
  }
}
