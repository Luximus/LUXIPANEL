// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `pickDefined()` — drop `undefined` entries from an object literal (B-39).
 *
 * Used when building a patch/update payload from optional request fields: an
 * explicit `undefined` would otherwise overwrite a stored value (or trip
 * `exactOptionalPropertyTypes`). `null` is KEPT — it means "clear this field".
 *
 * Duplicated in `auth/controllers/qr.controller.ts` and `session.controller.ts`.
 */

/** Shallow copy of `obj` without the keys whose value is `undefined`. */
export function pickDefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}
