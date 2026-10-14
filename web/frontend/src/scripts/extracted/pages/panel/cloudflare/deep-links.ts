// Cloudflare page — deep links (/panel/cloudflare?tab=&domain=&ip=).
import { state } from "./state";
import type { Zone, Tab } from "./state";
import { t, fmt, esc, showToast, $ } from "./dom";
import { openDnsDialog } from "./dns";
import { openAccessDialog } from "./access";
import { showTab, setTab } from "./tabs";
import { selectZone } from "./zones";

// ── Deep links (/panel/cloudflare?tab=&domain=&ip=) ──────────────────────────
export interface PendingDeepLink {
  domain: string | null;
  ip: string | null;
  /** Zone preselection (or no-match toast) already ran. */
  zoneApplied: boolean;
  /** A zone matched the domain (suffix match). */
  zoneMatched: boolean;
  recordsReady: boolean;
  ipReady: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}
export let pendingDeepLink: PendingDeepLink | null = null;

/** Short wait for the parallel serverIp fetch before opening with empty content. */
export const DEEPLINK_IP_TIMEOUT_MS = 4000;

export const VALID_TABS: readonly Tab[] = ["dns", "cache", "security", "access", "config"];

export function isValidDeepLinkDomain(v: string): boolean {
  return /^[a-z0-9.-]{1,255}$/.test(v);
}

/** IPv4 / IPv6, with optional CIDR suffix. Invalid → ignored upstream. */
export function isValidDeepLinkIp(v: string): boolean {
  if (!v || v.length > 64) return false;
  const m = /^(.+?)(?:\/(\d{1,3}))?$/.exec(v);
  if (!m) return false;
  const addr = m[1];
  const cidr = m[2] === undefined ? null : Number(m[2]);
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(addr);
  if (v4) {
    if (v4.slice(1).some((o) => Number(o) > 255)) return false;
    return cidr === null || cidr <= 32;
  }
  if (!addr.includes(":") || !/^[0-9a-f:]{2,45}$/i.test(addr)) return false;
  const halves = addr.split("::");
  if (halves.length > 2) return false;
  const groups = addr.split(/::?/).filter(Boolean);
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return false;
  if (halves.length === 1 && groups.length !== 8) return false;
  if (halves.length === 2 && groups.length > 7) return false;
  return cidr === null || cidr <= 128;
}

export function clearDeepLink() {
  if (pendingDeepLink?.timer != null) clearTimeout(pendingDeepLink.timer);
  pendingDeepLink = null;
}

/** Longest-suffix zone match: "blog.acme.com" → zone "acme.com". */
export function matchZoneForDomain(domain: string): Zone | null {
  let best: Zone | null = null;
  for (const z of state.zones) {
    const name = z.name.toLowerCase();
    if (domain === name || domain.endsWith(`.${name}`)) {
      if (!best || name.length > best.name.toLowerCase().length) best = z;
    }
  }
  return best;
}

export function armDeepLinkIpTimeout(dl: PendingDeepLink) {
  if (dl.ipReady || dl.timer != null) return;
  dl.timer = setTimeout(() => {
    const cur = pendingDeepLink;
    if (cur?.domain && cur.zoneMatched && !cur.ipReady) {
      cur.ipReady = true; // give up on serverIp → content vacío
      maybeOpenDnsDeepLinkDialog();
    }
  }, DEEPLINK_IP_TIMEOUT_MS);
}

/** Opens the create-record dialog once records AND serverIp (or timeout) are in. */
export function maybeOpenDnsDeepLinkDialog() {
  const dl = pendingDeepLink;
  if (!dl?.domain || !dl.zoneMatched || !dl.recordsReady || !dl.ipReady) return;
  const domain = dl.domain;
  clearDeepLink();
  openDnsDialog("create", {
    id: "",
    type: "A",
    name: domain,
    content: state.serverIp ?? "",
    ttl: 1,
    proxied: false,
    pointsToServer: false,
  });
}

export function openAccessDeepLinkDialog(ip: string) {
  openAccessDialog(); // resets fields → mode "block", ip vacío
  const ipInput = $("cf-access-ip") as HTMLInputElement | null;
  if (ipInput) ipInput.value = ip;
}

/**
 * Runs inside loadZones (zones freshly loaded, BEFORE the keep/selectZone
 * logic): preselects the matched zone via state.zoneId and switches the pane
 * so the subsequent selectZone() loads the right tab exactly once.
 */
export function applyDeepLinkZoneSelection() {
  const dl = pendingDeepLink;
  if (!dl || dl.zoneApplied) return;
  dl.zoneApplied = true;
  if (dl.domain) {
    const zone = matchZoneForDomain(dl.domain);
    if (!zone) {
      showToast(fmt(t("zones.domainNotFound", "El dominio {domain} no pertenece a ninguna zona del token"), { domain: dl.domain }), false);
      clearDeepLink();
      return;
    }
    dl.zoneMatched = true;
    state.zoneId = zone.id;
    showTab("dns");
    armDeepLinkIpTimeout(dl);
  } else if (dl.ip) {
    showTab("access");
  }
}

/**
 * Cooldown path (SPA re-nav while loadConfig is skipped): zones are already
 * in memory, so apply the deep link directly.
 */
export function applyDeepLinkNow() {
  const dl = pendingDeepLink;
  if (!dl || dl.zoneApplied) return;
  if (!state.tokenSet || state.zones.length === 0) return; // loadZones hooks (or nothing) handle it
  dl.zoneApplied = true;
  if (dl.domain) {
    const zone = matchZoneForDomain(dl.domain);
    if (!zone) {
      showToast(fmt(t("zones.domainNotFound", "El dominio {domain} no pertenece a ninguna zona del token"), { domain: dl.domain }), false);
      clearDeepLink();
      return;
    }
    dl.zoneMatched = true;
    dl.ipReady = true; // serverIp ya se intentó en la carga inicial
    showTab("dns");
    const sel = $("cf-zone") as HTMLSelectElement | null;
    if (sel) sel.value = zone.id;
    selectZone(zone.id); // → loadTab("dns") → loadDns → hook abre el dialog
  } else if (dl.ip) {
    setTab("access");
    openAccessDeepLinkDialog(dl.ip);
    clearDeepLink();
  }
}

/**
 * Reads location.search ONCE per navigation (params are stripped immediately
 * via history.replaceState, so refresh / duplicate init calls are no-ops).
 */
export function consumeDeepLinkParams() {
  const params = new URLSearchParams(location.search);
  if (!params.has("tab") && !params.has("domain") && !params.has("ip")) return;
  const rawTab = params.get("tab") ?? "";
  const rawDomain = (params.get("domain") ?? "").trim().toLowerCase();
  const rawIp = (params.get("ip") ?? "").trim();

  // Strip the consumed params so refresh/SPA-nav doesn't re-trigger dialogs.
  const url = new URL(location.href);
  for (const p of ["tab", "domain", "ip"]) url.searchParams.delete(p);
  history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);

  if ((VALID_TABS as readonly string[]).includes(rawTab)) setTab(rawTab as Tab);

  const domain = rawDomain && isValidDeepLinkDomain(rawDomain) ? rawDomain : null;
  const ip = rawIp && isValidDeepLinkIp(rawIp) ? rawIp : null;
  if (!domain && !ip) return; // invalid → silently ignored

  clearDeepLink();
  pendingDeepLink = {
    domain,
    ip: domain ? null : ip, // domain manda si vienen ambos (solo un dialog)
    zoneApplied: false,
    zoneMatched: false,
    recordsReady: false,
    ipReady: false,
    timer: null,
  };
}
