// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * WsRouter — centralized WebSocket upgrade dispatcher.
 *
 * Instead of each module registering its own `server.on("upgrade", ...)` listener
 * (which caused modules to accidentally destroy each other's sockets), a single
 * listener routes connections to the correct WebSocketServer by pathname.
 *
 * Usage:
 *   const router = new WsRouter(httpServer);
 *   router.register("/api/terminal/ws", handleTerminalConnection);
 *   router.register("/api/monitor/ws",  handleMonitorConnection);
 *
 * Adding a new WebSocket service in the future is just one `router.register()` call —
 * no risk of interfering with existing services.
 */

import type { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import { WebSocketServer } from "ws";
import { WebSocket } from "ws";
import { verifyWsAuthorization } from "./live-auth.js";
import { authorizationChanges, subscribeAuthorizationChanges } from "../auth/authorization-revision.js";
import { env } from "../../config/env.js";
import { createModuleLogger } from "../logger/index.js";

const log = createModuleLogger("ws-router");

export type WsConnectionHandler = (ws: WebSocket, req: IncomingMessage) => void | Promise<void>;

// Cap a single inbound WS message. The default (100 MiB) lets one client message
// pin the event loop / heap (DoS); terminal keystrokes/resizes and monitor
// subscribe frames are tiny, so 64 KiB is generous headroom.
const WS_MAX_PAYLOAD_BYTES = 64 * 1024;

/** Configured WS origins: CORS_ORIGIN (comma-separated) + PANEL_PUBLIC_URL. */
function configuredOrigins(): string[] {
  const out: string[] = [];
  for (const o of String(env.CORS_ORIGIN ?? "").split(",")) {
    const t = o.trim();
    if (t) out.push(t);
  }
  if (env.PANEL_PUBLIC_URL) out.push(env.PANEL_PUBLIC_URL.trim());
  return out;
}

/**
 * Guard the WS upgrade against cross-site hijacking. Terminal auth accepts the
 * session cookie, so with `COOKIE_SAMESITE=none` an attacker page could open a
 * remote terminal as the victim unless we check the handshake Origin.
 *
 *   • No `Origin` header → allowed. Browsers ALWAYS send Origin on a WS
 *     handshake, so its absence means a non-browser client (no CSRF vector).
 *   • Same-origin (Origin host === the `Host` nginx forwarded) → allowed. This
 *     needs no configuration and covers every real deployment (browser opening
 *     wss://<panel>/… ); a page on attacker.com has Origin: attacker.com but
 *     Host: <panel>, so it fails here.
 *   • Otherwise the Origin must match an explicitly configured origin.
 */
function isAllowedWsOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false; // malformed Origin → reject
  }
  const host = String(req.headers.host ?? "").toLowerCase();
  if (host && originHost === host) return true;
  for (const allowed of configuredOrigins()) {
    if (allowed === "*") return true;
    try {
      if (new URL(allowed).host.toLowerCase() === originHost) return true;
    } catch {
      /* not a URL — ignore */
    }
  }
  return false;
}

export class WsRouter {
  private readonly routes = new Map<string, WebSocketServer>();
  private attached = false;

  constructor(private readonly server: HttpServer) {}

  /**
   * Register a WebSocket path and its connection handler.
   * Throws if the path is already registered (catches misconfiguration early).
   */
  register(path: string, handler: WsConnectionHandler): void {
    if (this.routes.has(path)) {
      throw new Error(`WsRouter: path "${path}" is already registered`);
    }

    const wss = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD_BYTES });

    wss.on("connection", (ws, req) => {
      subscribeAuthorizationChanges();
      Promise.resolve().then(async () => {
        // Register before the asynchronous read, so a simultaneous revocation
        // cannot slip between authentication and installation of the listener.
        let changed = false;
        const duringAuth = () => { changed = true; };
        authorizationChanges.on("changed", duringAuth);
        let user;
        try { user = await verifyWsAuthorization(req); }
        finally { authorizationChanges.off("changed", duringAuth); }
        if (!user || changed || ws.readyState !== WebSocket.OPEN) { ws.close(1008, "Authentication required"); return; }
        const revoke = () => ws.close(1008, "Permissions changed; reconnect");
        authorizationChanges.on("changed", revoke);
        const expiry = setTimeout(revoke, Math.max(1, Math.min(2147483647, Math.min(Number(user.exp ?? 0) * 1000, user.hostingPolicy?.expiresAt ? Date.parse(user.hostingPolicy.expiresAt) : Infinity) - Date.now())));
        expiry.unref();
        // Pubsub gives immediate revocation; the periodic fresh check also
        // closes sockets when Redis disconnects or a subscription is lost.
        let checking = false;
        const heartbeat = setInterval(() => {
          if (checking) return;
          checking = true;
          void verifyWsAuthorization(req, true).then(current => {
            if (!current || current.authorizationRevision !== user.authorizationRevision) revoke();
          }).catch(revoke).finally(() => { checking = false; });
        }, 5000);
        heartbeat.unref();
        ws.once("close", () => { clearTimeout(expiry); clearInterval(heartbeat); authorizationChanges.off("changed", revoke); });
        await handler(ws, req);
      }).catch((err) => {
        ws.close(1008, "Authorization failed");
        log.error({ err, path }, "Uncaught error in WS connection handler");
      });
    });

    this.routes.set(path, wss);
    log.info({ path }, "WS route registered");

    // Attach the single upgrade listener the first time a route is registered.
    // All subsequent register() calls just add to the routes map — no new listeners.
    if (!this.attached) {
      this.attached = true;
      this.server.on("upgrade", (req, socket, head) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const wss = this.routes.get(url.pathname);

        if (!wss) {
          // No handler registered — reject the upgrade cleanly
          log.warn({ pathname: url.pathname }, "No WS handler for path — rejecting upgrade");
          socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
          socket.destroy();
          return;
        }

        // CSRF/hijack guard: reject cross-site WS handshakes before auth runs.
        if (!isAllowedWsOrigin(req)) {
          log.warn(
            { pathname: url.pathname, origin: req.headers.origin, host: req.headers.host },
            "Rejecting WS upgrade — Origin not allowed",
          );
          socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
          socket.destroy();
          return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req);
        });
      });
    }
  }
}
