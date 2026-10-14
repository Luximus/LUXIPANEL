// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * WebSocket upgrade helpers — the ONE copy.
 *
 * Every WS endpoint (terminal, monitor, users UI-sync, assistant) repeated the
 * same four helpers: parse the `Cookie` header, pull the JWT out of the
 * upgrade, read the per-tab bridge override, and send JSON without throwing on
 * a closed socket. Two of the four looked for `?token=` BEFORE the cookie,
 * which is a real security divergence: a query-string JWT lands in Nginx /
 * Cloudflare / proxy access logs, while the cookie does not. {@link
 * extractWsToken} settles it — cookie first, query param only as the fallback
 * for cross-origin upgrades where the browser does not attach the cookie (there
 * the client mints a short-lived `ws-token`, never the session JWT).
 *
 * The token from the query string is consumed here and MUST NEVER be logged.
 */

import type { IncomingMessage } from "http";
import { WebSocket } from "ws";
import { authConfig } from "../../config/auth.js";

/**
 * Parse cookies from a raw `Cookie` header.
 *
 * NOTE: the empty header yields `{ "": "" }` — kept byte-compatible with the
 * copy that `terminal-connection.service.test.ts` pins.
 */
export function parseCookies(cookieHeader: string): Record<string, string> {
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k?.trim() ?? "", v.join("=")];
    }),
  );
}

/**
 * Extract the JWT for a WS upgrade: session cookie first, `?token=` second.
 *
 * Do NOT flip the order — see the module docstring.
 */
export function extractWsToken(req: IncomingMessage): string | null {
  // 1. Cookie (preferred — same-origin upgrades, never hits proxy logs).
  const cookieHeader = req.headers.cookie ?? "";
  if (cookieHeader) {
    const token = parseCookies(cookieHeader)[authConfig.cookie.sessionName];
    if (token) return token;
  }

  // 2. Query param fallback (cross-origin upgrades; short-lived ws-token only).
  const tokenParam = new URL(req.url ?? "/", "http://localhost").searchParams.get("token");
  if (tokenParam) return tokenParam;

  return null;
}

/**
 * Per-tab bridge override id from the upgrade URL (`bridge` query param).
 * Browsers cannot set custom headers on a WS upgrade, so this is the WS parity
 * of the HTTP `X-Bridge-Session-Id` header.
 */
export function extractOverrideBridgeId(req: IncomingMessage): string | null {
  const raw = new URL(req.url ?? "/", "http://localhost").searchParams.get("bridge");
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

/** Send a JSON payload to a WS client, swallowing errors if it is closed. */
export function wsSend(ws: WebSocket, payload: Record<string, unknown>): void {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  } catch {
    // WS already closed
  }
}

/**
 * Composite connection-group key `"<targetId>:<userId>"`.
 *
 * The per-server panel user id is only unique WITHIN a server: two Linux users
 * on different servers can share the same numeric id, so a bare-userId key
 * would cross-broadcast their state between servers.
 */
export function wsConnKey(userId: number, targetId: unknown): string {
  return `${typeof targetId === "string" && targetId ? targetId : "_"}:${userId}`;
}
