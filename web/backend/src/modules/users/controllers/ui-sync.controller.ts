import { verifyWsAuthorization } from "../../../shared/websocket/live-auth.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * UI Sync WebSocket controller — /api/preferences/ws
 *
 * Keeps a map of userId → active connections so that when any browser tab
 * or device updates the theme/language, every other open session of the
 * same user receives the change in real time.
 *
 * Protocol (JSON messages):
 *
 *   Server → Client (on connect):
 *     { type: "ui:state", isDark: boolean, language: string }
 *
 *   Client → Server:
 *     { type: "ui:state:update", isDark: boolean, language: string }
 *
 *   Server → Client (broadcast to OTHER sessions of the same user):
 *     { type: "ui:state:sync", isDark: boolean, language: string }
 */

import { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { apiLocaleFromRequest } from "../../../shared/i18n/errors.js";
import { apiModuleMessage } from "../../../shared/i18n/module-messages.js";
import { env } from "../../../config/env.js";
import { preferencesRepository } from "../repositories/preferences.repository.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { extractWsToken, wsConnKey, wsSend } from "../../../shared/websocket/upgrade-auth.js";

const log = createModuleLogger("ui-sync:ws");

// Derived from SUPPORTED_LOCALES so the i18n allowlist lives in one place
// (backend/src/config/env.ts). See shared/middleware/locale.ts.
const VALID_LANGUAGES = new Set(env.SUPPORTED_LOCALES);
const VALID_SOURCES = new Set(["web", "iframe", "webframe", "app", "desktop"] as const);
type ClientSource = "web" | "iframe" | "webframe" | "app" | "desktop";

/**
 * `<targetId>:<userId>` → all currently open WebSocket connections for that
 * user ON THAT SERVER. Keyed by the composite (not bare userId) because the
 * per-server panel user id is only unique within a server: two Linux users on
 * different servers can share the same numeric id, and a bare-userId key would
 * cross-broadcast their UI state. */
const connections = new Map<string, Set<WebSocket>>();
const sourceByConnection = new WeakMap<WebSocket, ClientSource>();

/** Composite connection-group key: scopes presence/broadcast per server+user. */
const connKey = wsConnKey;

// SECURITY FIX (B-02): this endpoint used to read `?token=` BEFORE the session
// cookie, so a same-origin upgrade published its JWT into the Nginx/Cloudflare
// access logs. The shared helper always prefers the cookie; the query param
// remains only as the cross-origin fallback.
const extractToken = extractWsToken;
const send = wsSend;

function broadcast(key: string, origin: WebSocket, payload: Record<string, unknown>): void {
  const userConns = connections.get(key);
  if (!userConns) return;
  for (const conn of userConns) {
    if (conn !== origin) send(conn, payload);
  }
}

function broadcastAll(key: string, payload: Record<string, unknown>): void {
  const userConns = connections.get(key);
  if (!userConns) return;
  for (const conn of userConns) {
    send(conn, payload);
  }
}

function sanitizeSource(value: unknown): ClientSource {
  if (typeof value !== "string") return "web";
  const normalized = value.trim().toLowerCase();
  return VALID_SOURCES.has(normalized as ClientSource) ? (normalized as ClientSource) : "web";
}

function inferSource(req: IncomingMessage): ClientSource {
  const url = new URL(req.url ?? "/", "http://localhost");
  const fromQuery = sanitizeSource(url.searchParams.get("source") ?? url.searchParams.get("lxp_source") ?? url.searchParams.get("clientSource"));
  if (fromQuery !== "web") return fromQuery;

  const headerSource = sanitizeSource(req.headers["x-lxp-client-source"] ?? req.headers["x-client-platform"]);
  if (headerSource !== "web") return headerSource;

  const ua = String(req.headers["user-agent"] ?? "").toLowerCase();
  if (ua.includes("reactnativewebview")) return "app";
  if (ua.includes("electron") && ua.includes("webview")) return "webframe";
  if (ua.includes("electron")) return "desktop";

  return "web";
}

function emitPresence(key: string): void {
  const userConns = connections.get(key);
  if (!userConns || userConns.size === 0) return;

  const counts: Record<ClientSource, number> = {
    web: 0,
    iframe: 0,
    webframe: 0,
    app: 0,
    desktop: 0,
  };

  for (const conn of userConns) {
    const source = sourceByConnection.get(conn) ?? "web";
    counts[source] += 1;
  }

  broadcastAll(key, {
    type: "ui:presence",
    counts,
    activeSources: (Object.entries(counts)
      .filter(([, total]) => total > 0)
      .map(([source]) => source)),
  });
}

export async function handleUiSyncConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
  const locale = apiLocaleFromRequest(req);
  const token = extractToken(req);
  if (!token) {
    send(ws, { type: "error", message: apiModuleMessage(locale, "wsUnauthorized") });
    ws.close(4001, "Unauthorized");
    return;
  }

  const payload = await verifyWsAuthorization(req);
  if (!payload) {
    send(ws, { type: "error", message: apiModuleMessage(locale, "wsInvalidToken") });
    ws.close(4001, "Invalid token");
    return;
  }

  const { userId } = payload;
  const key = connKey(userId, (payload as { targetId?: unknown }).targetId);
  const source = inferSource(req);

  if (!connections.has(key)) {
    connections.set(key, new Set());
  }
  connections.get(key)!.add(ws);
  sourceByConnection.set(ws, source);
  log.info({ userId, key, source }, "UI sync client connected");

  // Send current persisted state on connect
  try {
    const prefs = await preferencesRepository.findByUserId(userId);
    const data = prefs?.data ?? {};
    send(ws, {
      type: "ui:state",
      isDark: data.theme === "dark",
      language: data.language ?? "es",
      source,
    });
  } catch (err) {
    log.warn({ err, userId }, "Failed to load initial preferences for UI sync");
  }

  emitPresence(key);

  ws.on("message", async (raw) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (msg.type !== "ui:state:update") return;

    const isDark = typeof msg.isDark === "boolean" ? msg.isDark : false;
    const language = typeof msg.language === "string" && VALID_LANGUAGES.has(msg.language)
      ? (msg.language as "es" | "en")
      : "es";
    const source = sanitizeSource(msg.source);
    sourceByConnection.set(ws, source);

    try {
      await preferencesRepository.upsert(userId, {
        theme: isDark ? "dark" : "light",
        language,
      });
    } catch (err) {
      log.warn({ err, userId }, "Failed to persist UI preferences from socket");
    }

    broadcast(key, ws, { type: "ui:state:sync", isDark, language, source });
    emitPresence(key);
  });

  ws.on("close", () => {
    const userConns = connections.get(key);
    if (userConns) {
      userConns.delete(ws);
      if (userConns.size === 0) {
        connections.delete(key);
      } else {
        emitPresence(key);
      }
    }
    log.info({ userId, source: sourceByConnection.get(ws) ?? "web" }, "UI sync client disconnected");
    sourceByConnection.delete(ws);
  });

  ws.on("error", (err) => {
    log.error({ err, userId }, "UI sync WS error");
  });
}
