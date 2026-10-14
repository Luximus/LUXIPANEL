// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * branding-storage-keys.ts — single source of truth for the sessionStorage keys
 * (and the live-CSS schema version) that the branding runtime, the settings
 * page's live-theme injector and the Tornasol animation all read/write.
 *
 * These keys were previously declared independently in three extracted scripts
 * (`layouts/branding-runtime.ts`, `settings/layout-theme.ts`,
 * `layouts/tornasol-animation.ts`) — some as named constants, some as raw
 * string literals. Persistence correctness depends on every reader and writer
 * agreeing byte-for-byte on each key, so they live here now.
 *
 * Emitted as a runtime shared lib (`/scripts/extracted/lib/branding-storage-keys.js`,
 * registered in `scripts/build-extracted.mjs`) so the `bundle:false` extracted
 * scripts (branding-runtime, tornasol-animation) can import it by runtime URL
 * without pulling in unrelated bundles; the settings bundle (`bundle:true`,
 * external `/scripts/extracted/lib/*`) imports the same URL and it stays
 * external. Also importable via `@/lib/branding-storage-keys`.
 *
 * The values are byte-identical to the former literals — do NOT change them or
 * previously persisted theme/logo overrides stop resolving.
 */

/** sessionStorage key: live logo override map written by the settings page. */
export const LIVE_LOGOS_KEY = "lxp-layout-live-logos";
/** sessionStorage key: live theme CSS payload `{ v, css }` (schema-versioned). */
export const LIVE_CSS_KEY = "lxp-layout-live-css";
/** Schema version stamped onto the persisted live CSS. Bump whenever the
 *  palette/layout-color generation logic changes so branding-runtime drops
 *  stale entries from previous builds. */
export const LIVE_CSS_VERSION = 3;

/** sessionStorage key: Tornasol palette active flag (`"1"` = on). */
export const TORNASOL_FLAG_KEY = "lxp-layout-tornasol-active";
/** sessionStorage key: Tornasol animation intensity (0..100). */
export const TORNASOL_INTENSITY_KEY = "lxp-layout-tornasol-intensity";
/** sessionStorage key: single Tornasol base color (legacy fallback). */
export const TORNASOL_COLOR_KEY = "lxp-layout-tornasol-color";
/** sessionStorage key: Tornasol base color list (JSON array of hex). */
export const TORNASOL_COLORS_KEY = "lxp-layout-tornasol-colors";

/** Discard live previews when the rendered server changes, including legacy
 * unscoped previews. A local admin's logo/theme must never override a remote. */
export function syncBrandingScope(storage: Storage, scope: string): void {
  const scopeKey = "lxp-layout-live-scope";
  if (storage.getItem(scopeKey) === scope) return;
  for (const key of [LIVE_LOGOS_KEY, LIVE_CSS_KEY, TORNASOL_FLAG_KEY,
    TORNASOL_INTENSITY_KEY, TORNASOL_COLOR_KEY, TORNASOL_COLORS_KEY]) storage.removeItem(key);
  storage.setItem(scopeKey, scope);
}
