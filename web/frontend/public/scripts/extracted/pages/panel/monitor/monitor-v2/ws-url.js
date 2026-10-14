// Builds the monitor WebSocket URL, handling both direct (self-hosted) and
// managed-bridge sessions plus the short-lived ws-token exchange. Fully
// self-contained (owns its token cache). Extracted from monitor-v2.js.
let _wsTokenCache = null;
function getCookieToken() {
  return document.cookie.split("; ").find((entry) => entry.startsWith("luxipanel_session="))?.split("=")[1] ?? "";
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
  const cookieToken = getCookieToken();
  if (cookieToken) return cookieToken;
  if (_wsTokenCache && _wsTokenCache.expiresAt - Date.now() > 15e3) {
    return _wsTokenCache.token;
  }
  const res = await fetch(resolvePanelApiPath("/api/auth/ws-token"), {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" }
  }).catch(() => null);
  if (!res) return "";
  if (!res.ok) return "";
  const json = await res.json().catch(() => null);
  const token = typeof json?.data?.token === "string" ? json.data.token : "";
  const expiresAt = typeof json?.data?.expiresAt === "number" ? json.data.expiresAt : 0;
  if (token && expiresAt > Date.now()) {
    _wsTokenCache = { token, expiresAt };
  }
  return token;
}
export async function buildWsUrl() {
  const cookie = document.cookie ?? "";
  const isManagedProxySession = cookie.split("; ").some((entry) => entry === "lxp_auth_state=authenticated");
  const host = location.hostname.toLowerCase();
  const isManagedEntryHost = host.endsWith(".luxipanel.com") && host !== "luxipanel.com" && host !== "www.luxipanel.com";
  const defaultBridgeBase = "https://api.luxisoft.com/__luxipanel";
  const bridgeBase = String(window.__LUXIPANEL_BRIDGE_BASE ?? defaultBridgeBase).replace(/\/+$/, "");
  const bridgeHost = (() => {
    try {
      return new URL(bridgeBase).hostname.toLowerCase();
    } catch {
      return "api.luxisoft.com";
    }
  })();
  const isBridgePath = location.pathname === "/__luxipanel" || location.pathname.startsWith("/__luxipanel/");
  const isBridgeHost = host === bridgeHost;
  const useBridge = isManagedProxySession || isManagedEntryHost || isBridgePath || isBridgeHost;
  const proto = useBridge ? bridgeBase.startsWith("https://") ? "wss:" : "ws:" : window.location.protocol === "https:" ? "wss:" : "ws:";
  const qs = new URLSearchParams();
  const token = useBridge ? await getWebsocketToken() : getCookieToken();
  if (token) qs.set("token", token);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  if (useBridge) {
    return `${proto}//${bridgeBase.replace(/^https?:\/\//i, "")}/api/monitor/ws${suffix}`;
  }
  return `${proto}//${window.location.host}/api/monitor/ws${suffix}`;
}
