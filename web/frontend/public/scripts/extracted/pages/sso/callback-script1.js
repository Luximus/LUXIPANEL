const I18N = window.__LXP_SSO_I18N__ ?? {
  missingSession: "",
  accessFailed: "",
  accessFailedRedirect: ""
};
const status = document.getElementById("status");
const callbackPath = window.location.pathname;
const isPanelPrefixed = callbackPath.startsWith("/panel/");
const apiCandidates = isPanelPrefixed ? ["/panel/api/sso/callback", "/api/sso/callback"] : ["/api/sso/callback", "/panel/api/sso/callback"];
const _managed = window.__LXP_SSO_MANAGED__;
const _lsUrl = window.__LXP_SSO_LS_URL__;
const loginPath = "/login";
function resolveNextPath(url) {
  const raw = url.searchParams.get("next")?.trim() ?? "";
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw[1] === "/" || raw[1] === "\\") return "/";
  if (raw.startsWith("/panel/")) return raw.slice("/panel".length) || "/";
  if (raw === "/panel") return "/";
  return raw;
}
function clearSshOriginMarker() {
  const expired = "lxp_auth_origin=; Path=/; Max-Age=0; SameSite=Lax; Secure";
  document.cookie = expired;
  document.cookie = `${expired}; Domain=.luxipanel.com`;
  try {
    sessionStorage.removeItem("lxp_auth_origin");
  } catch {
  }
}
async function run() {
  if (window.__lxp_sso_processing) return;
  window.__lxp_sso_processing = true;
  const currentUrl = new URL(window.location.href);
  const session = currentUrl.searchParams.get("session")?.trim() ?? "";
  const nextPath = resolveNextPath(currentUrl);
  if (!session) {
    status.textContent = I18N.missingSession;
    window.location.replace(loginPath);
    return;
  }
  try {
    let connected = false;
    let lastError = I18N.accessFailed;
    for (const endpoint of apiCandidates) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ session })
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        connected = true;
        break;
      }
      lastError = json?.error ?? `HTTP ${res.status}`;
    }
    if (!connected) throw new Error(lastError);
    clearSshOriginMarker();
    window.location.replace(nextPath);
  } catch {
    status.textContent = I18N.accessFailedRedirect;
    window.location.replace(loginPath);
  }
}
run();
