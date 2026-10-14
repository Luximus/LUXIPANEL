// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * http-cache.ts — single source of truth for HTTP cache-control literals shared
 * by the SSR middleware and the panel pages that opt out of caching.
 */

/** `Cache-Control` value that fully disables caching (no-store + revalidate). */
export const NO_CACHE_HEADER = "no-store, no-cache, must-revalidate, max-age=0";
