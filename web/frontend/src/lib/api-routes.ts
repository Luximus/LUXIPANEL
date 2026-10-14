// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * api-routes.ts — single source of truth for the handful of panel API endpoint
 * paths that were re-typed as raw strings across several islands and scripts.
 *
 * Consumed by React/Astro islands, `.astro` frontmatter and `src/lib/**` (and
 * the `bundle:true` extracted entries, which inline it) via `@/lib/api-routes`.
 * Inline / define-vars / `bundle:false` extracted scripts that cannot import
 * (they only resolve runtime-URL shared libs, and this file is NOT emitted as a
 * `/scripts/extracted/lib/*` runtime entry) keep the literal and carry a
 * `// MUST match lib/api-routes.ts <SYMBOL>` coupling comment.
 *
 * Values are byte-identical to the former literals — the `resolvePanelApiPath`
 * `/panel` prefixing and any query string are applied at the call site.
 */

/** Modules the sidebar shows (already filtered for the current role). */
export const MODULES_INSTALLED_PATH = "/api/modules/installed";
/** Full panel module catalogue (admin-gated: `[{ id, enabled }]`). */
export const ADMIN_MODULES_PATH = "/api/admin/modules";
/** Short-lived WebSocket auth token endpoint. */
export const WS_TOKEN_PATH = "/api/auth/ws-token";
/** Enabled login methods (+ hCaptcha public config) for the login page. */
export const LOGIN_METHODS_PATH = "/api/auth/login-methods";
/** SSH target vault CRUD + switch base path. */
export const SERVERS_PATH = "/api/servers";
/** POST target-switch path for a target id. `"local"` (the LOCAL_TARGET_SCOPE
 *  sentinel) yields `/api/servers/local/switch` = return to the panel host. */
export function serverSwitchPath(targetId: string): string {
  return `${SERVERS_PATH}/${encodeURIComponent(targetId)}/switch`;
}
