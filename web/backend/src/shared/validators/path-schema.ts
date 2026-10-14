// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `pathOnlySchema` — the single-field `{ path }` payload (B-28).
 *
 * Eleven `files/` controllers each declared their own `z.object({ path:
 * z.string().min(1) })` under eight different names (`schema`, `pathSchema`,
 * `readSchema`, `getSchema`, `histSchema`, `scanSchema`, `mkdirSchema`,
 * `downloadSchema`). It validates the SHAPE only — the containment/jail check
 * is `safePath()` + `canAccessPath()` downstream, never this schema.
 *
 * Schemas that carry extra fields keep their own literal (they are not the same
 * contract); only the exact one-field copies were folded in here.
 */

import { z } from "zod";

/** `{ path: string }` — non-empty, unvalidated beyond that. */
export const pathOnlySchema = z.object({ path: z.string().min(1) });
