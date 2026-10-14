// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * theme-storage-keys.ts — single source of truth for the localStorage keys that
 * hold the panel theme preference. These keys are read/written by the early
 * anti-flash inline scripts (`theme-init.ts`, `PanelLayout-define-vars`,
 * `login-define-vars`), which run as classic inline / `bundle:false` scripts and
 * therefore CANNOT import this module — they keep the literal plus a
 * `// MUST match lib/theme-storage-keys.ts LXP_THEME_KEY / LXP_THEME_USER_SET_KEY`
 * coupling comment. This module is the documented SSOT for any future React /
 * `src/lib/**` code that manipulates the theme cache. Values are byte-identical
 * to the former literals — do not change them without updating every script in
 * lockstep (a mismatch causes a theme flash / lost preference).
 */

/** localStorage key holding the resolved theme (`"dark"` | `"light"`). */
export const LXP_THEME_KEY = "lxp-theme";
/** localStorage flag ("1") marking the theme as an explicit user choice. */
export const LXP_THEME_USER_SET_KEY = "lxp-theme-user-set";

/** CustomEvent name dispatched on `window` when the panel theme changes at
 *  runtime (SSOT for `editor.ts` / `theme.ts` / `panel-files-monaco.ts`, which
 *  listen to re-theme Monaco). */
export const THEME_CHANGE_EVENT = "lxp-theme-change";
