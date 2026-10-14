// Cloudflare page — server IP + zones list/select/badges.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { state } from "./state";
import type { Zone, ServerIpResult } from "./state";
import { t, fmt, esc, showToast, $ } from "./dom";
import { loadTab } from "./tabs";
import { readScopedPreference, writeScopedPreference } from "/scripts/extracted/lib/scoped-preferences.js";
import {
  pendingDeepLink, clearDeepLink, maybeOpenDnsDeepLinkDialog,
  applyDeepLinkZoneSelection, openAccessDeepLinkDialog,
} from "./deep-links";

// ── Server IP ────────────────────────────────────────────────────────────────
export async function loadServerIp() {
  const res = await api.get<ServerIpResult>("/api/cloudflare/server-ip");
  if (res.ok) {
    // best-effort: on failure the badge simply stays empty
    state.serverIp = res.data?.ip ?? null;
    const ipEl = $("cf-server-ip-val");
    if (ipEl) ipEl.textContent = state.serverIp ?? "—";
  }
  if (pendingDeepLink) {
    pendingDeepLink.ipReady = true;
    maybeOpenDnsDeepLinkDialog();
  }
}

// ── Zones ────────────────────────────────────────────────────────────────────
export async function loadZones() {
  const sel = $("cf-zone") as HTMLSelectElement | null;
  if (!sel) return;
  const res = await api.get<Zone[]>("/api/cloudflare/zones");
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  state.zones = res.data ?? [];
  if (state.zones.length === 0) {
    sel.innerHTML = `<option value="">${esc(t("zones.empty", "No hay zonas visibles con este token."))}</option>`;
    state.zoneId = null;
    updateZoneBadges();
    if (pendingDeepLink?.domain) {
      showToast(fmt(t("zones.domainNotFound", "El dominio {domain} no pertenece a ninguna zona del token"), { domain: pendingDeepLink.domain }), false);
    }
    clearDeepLink();
    return;
  }
  sel.innerHTML = state.zones.map((z) => `<option value="${esc(z.id)}">${esc(z.name)}</option>`).join("");
  applyDeepLinkZoneSelection(); // may set state.zoneId + switch tab (dns/access)
  const preferred = state.zoneId || readScopedPreference("cloudflare", "zone", "");
  const keep = preferred && state.zones.some((z) => z.id === preferred) ? preferred : state.zones[0].id;
  sel.value = keep;
  selectZone(keep);
  if (pendingDeepLink?.ip) {
    openAccessDeepLinkDialog(pendingDeepLink.ip);
    clearDeepLink();
  }
}

export function selectZone(zoneId: string) {
  state.zoneId = zoneId || null;
  if (zoneId) writeScopedPreference("cloudflare", "zone", zoneId);
  state.records = [];
  state.rules = [];
  state.settings = null;
  updateZoneBadges();
  loadTab(state.tab);
}

export function updateZoneBadges() {
  const zone = state.zones.find((z) => z.id === state.zoneId) ?? null;
  const statusWrap = $("cf-zone-status");
  const planWrap = $("cf-zone-plan");
  const statusVal = $("cf-zone-status-val");
  const planVal = $("cf-zone-plan-val");
  const show = !!zone;
  for (const el of [statusWrap, planWrap]) {
    el?.classList.toggle("hidden", !show);
    el?.classList.toggle("inline-flex", show);
  }
  const hint = $("cf-zone-health");
  if (hint) hint.textContent = "";
  if (!zone) return;
  const statusLabel = ({
    active: t("runtime.active", "Activa"),
    pending: t("runtime.pending", "Pendiente"),
    initializing: t("runtime.initializing", "Inicializando"),
    moved: t("runtime.moved", "Trasladada"),
  } as Record<string, string>)[zone.status] ?? zone.status;
  if (statusVal) {
    const active = zone.status === "active" && !zone.paused;
    statusVal.textContent = zone.paused ? `${statusLabel} (${t("runtime.paused", "pausada")})` : statusLabel;
    statusVal.className = active ? "text-emerald-500" : "text-amber-500";
  }
  if (planVal) planVal.textContent = zone.planName || "—";
  if (hint) hint.textContent = zone.paused
    ? t("runtime.pausedHint", "Zona pausada: revisa la configuración antes de cambiar DNS.")
    : zone.status !== "active"
      ? fmt(t("runtime.inactiveHint", "Zona {status}: comprueba los servidores de nombres en el registrador."), { status: statusLabel })
      : fmt(t("runtime.activeHint", "Zona activa · {count} servidores de nombres configurados."), { count: (zone.nameServers ?? []).length });
}
