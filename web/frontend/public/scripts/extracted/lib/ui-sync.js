/**
 * UI Sync — real-time theme/language synchronisation across browser tabs
 * and devices of the same logged-in user via /api/preferences/ws.
 *
 * Usage (called once from PanelLayout):
 *   import { initUiSync, emitUiStateUpdate } from ".../ui-sync.js";
 *   initUiSync((isDark, language) => { applyTheme(isDark); applyLanguage(language); });
 *
 * When the user toggles the theme locally:
 *   emitUiStateUpdate(isDark, language);
 */

const RECONNECT_DELAY_MS = 4000;
const MAX_RECONNECT_ATTEMPTS = 8;
const VALID_SOURCES = new Set(["web", "iframe", "webframe", "app", "desktop"]);
const DEFAULT_BRIDGE_BASE = "https://api.luxisoft.com/__luxipanel";

let socket = null;
let onSyncCallback = null;
let onPresenceCallback = null;
let reconnectAttempts = 0;
let destroyed = false;
let currentSource = "web";
let websocketTokenCache = null;

function normalizeSource(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return VALID_SOURCES.has(normalized) ? normalized : null;
}

function isInsideIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function detectUiClientSource() {
  const search = new URLSearchParams(window.location.search);
  const explicit = normalizeSource(search.get("lxp_source") || search.get("source") || search.get("clientSource"));
  if (explicit) return explicit;

  const ua = String(navigator.userAgent || "").toLowerCase();
  if (typeof window.ReactNativeWebView !== "undefined" || ua.includes("reactnativewebview")) return "app";
  if (ua.includes("lpsdesktopwebframe") || (ua.includes("electron") && ua.includes("webview"))) return "webframe";
  if (ua.includes("electron") || typeof window.electronApi !== "undefined") return "desktop";
  if (isInsideIframe()) return "iframe";

  return "web";
}

export function isUiEmbeddedSource(source) {
  const normalized = normalizeSource(source);
  return normalized === "iframe" || normalized === "webframe" || normalized === "app" || normalized === "desktop";
}

function resolvePanelApiPath(path) {
  const pathname = location.pathname;
  const host = location.hostname.toLowerCase();
  if (host === "api.luxisoft.com" || pathname === "/__luxipanel" || pathname.startsWith("/__luxipanel/")) {
    return `/__luxipanel${path}`;
  }
  if (pathname === "/panel" || pathname.startsWith("/panel/")) {
    return `/panel${path}`;
  }
  return path;
}

async function getWebsocketToken() {
  const cookie = document.cookie ?? "";
  const cookieToken = cookie
    .split("; ")
    .find((entry) => entry.startsWith("luxipanel_session="))
    ?.split("=")[1] ?? "";
  if (cookieToken) return cookieToken;

  if (websocketTokenCache && websocketTokenCache.expiresAt - Date.now() > 15_000) {
    return websocketTokenCache.token;
  }

  const res = await fetch(resolvePanelApiPath("/api/auth/ws-token"), {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  }).catch(() => null);
  if (!res) return "";
  if (!res.ok) return "";

  const json = await res.json().catch(() => null);
  const token = typeof json?.data?.token === "string" ? json.data.token : "";
  const expiresAt = typeof json?.data?.expiresAt === "number" ? json.data.expiresAt : 0;
  if (token && expiresAt > Date.now()) {
    websocketTokenCache = { token, expiresAt };
  }
  return token;
}

async function getWsUrl(source) {
  const cookie = document.cookie ?? "";
  const isManagedProxySession = cookie
    .split("; ")
    .some((entry) => entry === "lxp_auth_state=authenticated");

  const host = location.hostname.toLowerCase();
  const isManagedEntryHost = host.endsWith(".luxipanel.com") && host !== "luxipanel.com" && host !== "www.luxipanel.com";

  const bridgeBase = (window.__LUXIPANEL_BRIDGE_BASE || DEFAULT_BRIDGE_BASE).replace(/\/+$/, "");
  let bridgeHost = "api.luxisoft.com";
  try { bridgeHost = new URL(bridgeBase).hostname.toLowerCase(); } catch { /* keep default */ }
  const isBridgePath = location.pathname === "/__luxipanel" || location.pathname.startsWith("/__luxipanel/");
  const isBridgeHost = host === bridgeHost;
  const useBridge = isManagedProxySession || isManagedEntryHost || isBridgePath || isBridgeHost;
  const proto = useBridge
    ? bridgeBase.startsWith("https://")
      ? "wss:"
      : "ws:"
    : location.protocol === "https:"
      ? "wss:"
      : "ws:";
  const qs = new URLSearchParams();
  qs.set("source", source);
  const token = useBridge ? await getWebsocketToken() : "";
  if (token) qs.set("token", token);

  if (useBridge) {
    const bridgePath = bridgeBase.replace(/^https?:\/\//i, "");
    return `${proto}//${bridgePath}/api/preferences/ws?${qs.toString()}`;
  }
  return `${proto}//${location.host}/api/preferences/ws?${qs.toString()}`;
}

async function connect() {
  if (destroyed) return;

  try {
    socket = new WebSocket(await getWsUrl(currentSource));
  } catch {
    scheduleReconnect();
    return;
  }

  socket.addEventListener("open", () => {
    reconnectAttempts = 0;
  });

  socket.addEventListener("message", (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }

    if ((msg.type === "ui:state" || msg.type === "ui:state:sync") && onSyncCallback) {
      const isDark = Boolean(msg.isDark);
      const language = typeof msg.language === "string" ? msg.language : "es";
      const source = normalizeSource(msg.source) ?? currentSource;
      // ui:state is the initial load from DB — always apply
      // ui:state:sync is a push from another device — always apply
      onSyncCallback(isDark, language, msg.type === "ui:state", source);
      return;
    }

    if (msg.type === "ui:presence" && onPresenceCallback) {
      onPresenceCallback(msg);
    }
  });

  socket.addEventListener("close", () => {
    socket = null;
    scheduleReconnect();
  });

  socket.addEventListener("error", () => {
    // close event fires right after, which triggers reconnect
  });
}

function scheduleReconnect() {
  if (destroyed || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
  reconnectAttempts++;
  setTimeout(connect, RECONNECT_DELAY_MS);
}

/**
 * Start the sync connection.
 * @param {(isDark: boolean, language: string, isInitial: boolean) => void} onSync
 *   Called when a state update arrives from another device (or initial load).
 *   `isInitial` is true only on the first load from the server.
 */
export function initUiSync(onSync, options = {}) {
  currentSource = normalizeSource(options.source) ?? detectUiClientSource();
  onSyncCallback = onSync;
  onPresenceCallback = typeof options.onPresence === "function" ? options.onPresence : null;
  destroyed = false;
  reconnectAttempts = 0;
  connect();
}

/**
 * Emit a UI state change to the backend, which broadcasts it to all
 * other devices of the same user.
 *
 * @param {boolean} isDark
 * @param {string} language
 */
export function emitUiStateUpdate(isDark, language) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "ui:state:update", isDark, language, source: currentSource }));
  }
}

/** Tear down the connection (call on logout). */
export function destroyUiSync() {
  destroyed = true;
  onPresenceCallback = null;
  socket?.close();
  socket = null;
}
