// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Legacy browser key. On first catalogue visit, the entries are imported as
 * saved bookmarks for the current user/server and this key is removed. They
 * were never verified server clones. The list script keeps this literal because
 * its standalone public bundle cannot import this source module at runtime.
 */
export const GITHUB_STORE_INSTALLED_KEY = "lxp-github-store-installed-v1";
