// Cloudflare page — API token config (load / save / test / clear).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { state } from "./state";
import type { CfConfig, TestResult } from "./state";
import { t, fmt, esc, showToast, $ } from "./dom";
import { loadServerIp, loadZones, updateZoneBadges } from "./zones";
import { setTab } from "./tabs";

// ── Token config ─────────────────────────────────────────────────────────────
export async function loadConfig() {
  const res = await api.get<CfConfig>("/api/cloudflare/config");
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  state.tokenSet = !!res.data?.tokenSet;
  state.tokenPreview = res.data?.tokenPreview ?? "";
  updateConfigUI();
  if (state.tokenSet) {
    void loadServerIp();
    await loadZones();
  } else {
    // No token yet → take the user straight to the config tab.
    setTab("config");
  }
}

export function updateConfigUI() {
  const notice = $("cf-no-token");
  if (notice) {
    notice.classList.toggle("hidden", state.tokenSet);
    notice.classList.toggle("flex", !state.tokenSet);
  }
  const stateEl = $("cf-token-state");
  if (stateEl) {
    stateEl.textContent = state.tokenSet
      ? `${t("config.tokenSet", "Token configurado")}${state.tokenPreview ? ` · ${state.tokenPreview}` : ""}`
      : t("config.tokenMissing", "Configura un API Token para empezar");
  }
  const clearBtn = $("cf-token-clear");
  if (clearBtn) {
    clearBtn.classList.toggle("hidden", !state.tokenSet);
    clearBtn.classList.toggle("inline-flex", state.tokenSet);
  }
  const zoneSel = $("cf-zone") as HTMLSelectElement | null;
  if (zoneSel) zoneSel.disabled = !state.tokenSet;
}

export async function saveToken() {
  const input = $("cf-token") as HTMLInputElement | null;
  const apiToken = input?.value.trim() ?? "";
  if (!apiToken) return;
  const btn = $("cf-token-save") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  const res = await api.put("/api/cloudflare/config", { apiToken });
  if (btn) btn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  if (input) input.value = "";
  showToast(t("config.saved", "Token guardado"));
  await loadConfig();
}

export async function testToken() {
  const btn = $("cf-token-test") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  const res = await api.post<TestResult>("/api/cloudflare/test");
  if (btn) btn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  const data = res.data;
  showToast(data?.message ?? (data?.valid ? "OK" : t("common.error", "Error")), !!data?.valid);
}

export async function clearToken() {
  if (!(await openConfirm(t("config.confirmClear", "¿Quitar el token de Cloudflare?"), { title: t("config.clear", "Quitar token"), confirmText: t("config.confirmClearBtn", "Quitar"), variant: "danger" }))) return;
  const res = await api.delete("/api/cloudflare/config");
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  showToast(t("config.cleared", "Token eliminado"));
  state.tokenSet = false;
  state.tokenPreview = "";
  state.zones = [];
  state.zoneId = null;
  const sel = $("cf-zone") as HTMLSelectElement | null;
  if (sel) sel.innerHTML = `<option value="">${esc(t("zones.select", "Selecciona una zona"))}</option>`;
  updateZoneBadges();
  updateConfigUI();
  setTab("config");
}
