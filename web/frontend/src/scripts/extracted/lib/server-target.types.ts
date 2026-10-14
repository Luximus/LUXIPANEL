// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * server-target.types.ts — single source of truth for the `ServerTarget` shape
 * shared by `layouts/server-switcher.ts` and `pages/panel/settings/servers-script1.ts`.
 *
 * It is the UNION/superset of the two previously divergent local definitions:
 * the switcher only needed id/name/host/port/username/authType/isLocal/active,
 * while the settings vault CRUD also needs the fingerprint/visibility/luxipanel
 * fields (plus a lax index signature). `id` is widened to `string | number` to
 * cover both call sites.
 *
 * Type-only module (erased at build), so the two `bundle:false` extracted
 * scripts import it with `import type` WITHOUT emitting a runtime import — no
 * new runtime dependency, safe in either bundle context.
 */
export interface ServerTarget {
  id: string | number;
  name?: string | null;
  host?: string | null;
  port?: number | null;
  username?: string | null;
  authType?: string | null;
  /** Synthetic local/connected-server entry marker (GET /api/servers[0]). */
  isLocal?: boolean;
  /** Backend flag: this target resolves the current request (per-tab bridge). */
  active?: boolean;
  hostFingerprint?: string | null;
  hostFingerprintPending?: string | null;
  visibility?: "global" | "private" | null;
  hasLuxipanel?: boolean | null;
  luxipanelBaseUrl?: string | null;
  [k: string]: unknown;
}
