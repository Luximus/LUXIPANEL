// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * License client — residual accessor stub.
 *
 * LUXIPANEL's license transport against LP-LICENSE-SERVER is retired in the
 * standalone multi-node model (see CLAUDE.md §"Transporte panel↔LP HISTÓRICO —
 * retirado"). There is no activation, heartbeat, fingerprint or degraded-mode
 * flow anymore: the panel is self-hosted and never validates a license.
 *
 * The former activation machinery (`activateLicense`/`startHeartbeat`/…) was
 * already dead — it was dropped from the boot sequence — so the license JWT was
 * always `null` at runtime. All that survives is the small accessor surface the
 * out-of-scope `panel-api.client.ts` still reads:
 *   - `getToken()`  → always `null` (no activation ⇒ no JWT).
 *   - `getServerUrl()` → the configured LP origin, used only to build URLs for
 *     the (now inert) authenticated `/panel-api/*` calls.
 *
 * This file exists so those consumers keep compiling; it can be removed entirely
 * once `panel-api.client.ts` (and its callers in admin/report/server-alerts/
 * module-dev) are excised.
 */

import { env } from "../../config/env.js";

export const licenseService = {
  /**
   * Current license JWT. Always `null`: activation is retired, so no token is
   * ever minted. Callers that build an `Authorization: Bearer` header off this
   * therefore throw ("panel not activated") — the intended inert behaviour.
   */
  getToken(): string | null {
    return null;
  },

  /** Configured license server origin (e.g. https://api.luxisoft.com). */
  getServerUrl(): string {
    return env.LICENSE_SERVER_URL;
  },
};
