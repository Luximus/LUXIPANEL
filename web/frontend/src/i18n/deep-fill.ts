// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Deep-fill of i18n dictionaries — single implementation (F-10).
 *
 * Lives in its own module (instead of `i18n/index.ts`) because the React
 * islands need it too and `i18n/index.ts` pulls the `import.meta.glob` of every
 * locale file, which must never reach a client bundle.
 *
 * `deepFill(value, fallback)` returns a copy of `value` where any key/path that
 * is missing (or `undefined`) is taken from `fallback`. Locale namespace files
 * can lag the default locale (keys added to a page before every translation is
 * filled in); without this, reading a missing nested key (`t.x.y.z`) throws
 * during SSR and the whole page returns a 502.
 *
 * Two important invariants (they were the fix for React #300 loops in the
 * assistant): a `undefined` slot in `value` ALWAYS falls back to `fallback`, and
 * a non-object on either side short-circuits to `value`, so object identity
 * stays stable across renders.
 */
export function deepFill<T>(value: T, fallback: T): T {
  if (value === undefined || value === null) return fallback;
  if (
    typeof value !== "object" ||
    typeof fallback !== "object" ||
    Array.isArray(value) ||
    Array.isArray(fallback) ||
    fallback === null
  ) {
    return value;
  }
  const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const key of Object.keys(fallback as Record<string, unknown>)) {
    out[key] = deepFill(
      (value as Record<string, unknown>)[key],
      (fallback as Record<string, unknown>)[key],
    );
  }
  return out as T;
}

/**
 * `deepFill` with the arguments in "merge" order (`base` first, override
 * second) — the shape the floating-assistant call sites use.
 */
export function deepMerge<T>(base: T, override: Partial<T> | undefined): T {
  return deepFill(override as T, base);
}
