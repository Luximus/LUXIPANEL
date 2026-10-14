// Cloudflare page — zone settings (SSL / security / dev mode / always-https).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { state } from "./state";
import type { ZoneSettings } from "./state";
import { t, fmt, esc, showToast, $ } from "./dom";

// ── Zone settings (SSL / security / dev mode / always-https) ────────────────
export async function loadSettings() {
  if (!state.zoneId) return;
  const zid = state.zoneId;
  const res = await api.get<ZoneSettings>(`/api/cloudflare/zones/${encodeURIComponent(zid)}/settings`);
  if (state.zoneId !== zid) return; // la zona cambió mientras respondía: descartar
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  state.settings = res.data ?? null;
  applySettingsUI();
}

export function applySettingsUI() {
  const s = state.settings;
  if (!s) return;
  const sslSel = $("cf-ssl-mode") as HTMLSelectElement | null;
  if (sslSel && s.ssl) sslSel.value = s.ssl;
  const levelSel = $("cf-security-level") as HTMLSelectElement | null;
  if (levelSel && s.securityLevel) levelSel.value = s.securityLevel;
  const httpsCb = $("cf-always-https") as HTMLInputElement | null;
  if (httpsCb) httpsCb.checked = s.alwaysUseHttps === "on";
  const devCb = $("cf-dev-mode") as HTMLInputElement | null;
  if (devCb) devCb.checked = s.developmentMode === "on";
}

export async function changeSetting(setting: "ssl" | "always_use_https" | "security_level" | "development_mode", value: string) {
  if (!state.zoneId) return;
  const res = await api.patch(`/api/cloudflare/zones/${encodeURIComponent(state.zoneId)}/settings`, { setting, value });
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    // Re-sync the controls with the real zone state after a failed change.
    void loadSettings();
    return;
  }
  showToast(t("security.updated", "Ajuste actualizado"));
}
