// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Real Linux login user UID range (SSOT).
 *
 * On a Debian-family system, interactive ("real") login accounts created by the
 * panel live in the `[MIN_REAL_UID, MAX_REAL_UID)` half-open range; UIDs below
 * `MIN_REAL_UID` are system/service accounts. Centralized here so the numeric
 * range has ONE definition instead of being re-typed inside per-module getent
 * `awk` filters. The exact filter SHAPE stays per-site on purpose (some include
 * root via `$3==0`, some drop the upper bound) — only the literals come from
 * here.
 */

/** Lowest UID treated as a real (non-system) Linux login user. */
export const MIN_REAL_UID = 1000;

/** First UID above the real-login range (the range is half-open: UID < MAX). */
export const MAX_REAL_UID = 60000;
