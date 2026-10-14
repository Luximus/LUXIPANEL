// Expo page — access-token config, account connection and build-quota cards.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { S } from "./state";
import type { ExpoConfig, ExpoAccount, ExpoQuota } from "./state";
import { t, showToast, $, esc, skelBar } from "./dom";
import { loadProjects, renderProjects } from "./projects";
import { renderBuilds } from "./builds";
import { renderEnvVars } from "./env";
import { readExpoData } from "./read";

// ── Config / account ─────────────────────────────────────────────────────────
export async function loadConfig() {
  const targetGeneration = S.targetGeneration;
  // Local project discovery does not need an Expo token or its preview.
  void loadProjects();
  const res = await readExpoData(() => api.get<ExpoConfig>("/api/expo/config"));
  if (targetGeneration !== S.targetGeneration) return;
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  if (!res.ok) {
    const account = $("expo-account-state");
    if (account) account.textContent = res.error ?? t("common.error", "Error");
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  S.tokenSet = !!res.data?.tokenSet;
  S.tokenPreview = res.data?.tokenPreview ?? "";
  updateConfigUI();
  // Project discovery is local to the selected server and must work before an
  // Expo token is configured, so users can choose what to link.
  renderProjects();
  if (S.tokenSet) {
    void loadAccount();
    void loadQuota();
  } else {
    renderAccount();
  }
}

export function updateConfigUI() {
  const notice = $("expo-no-token");
  if (notice) {
    notice.classList.toggle("hidden", S.tokenSet);
    notice.classList.toggle("flex", !S.tokenSet);
  }
  const clearBtn = $("expo-token-clear");
  if (clearBtn) {
    clearBtn.classList.toggle("hidden", !S.tokenSet);
    clearBtn.classList.toggle("inline-flex", S.tokenSet);
  }
  const setLabel = $("expo-token-set-label");
  if (setLabel) setLabel.textContent = S.tokenSet ? t("config.replace", "Reemplazar token") : t("account.setToken", "Configurar token");
}

/** A username other than the GraphQL "unknown" placeholder means connected. */
export function accountUsername(a: ExpoAccount | null): string | null {
  const u = (a?.username ?? "").trim();
  return u && u !== "desconocido" ? u : null;
}

export async function loadAccount() {
  const targetGeneration = S.targetGeneration;
  const res = await readExpoData(() => api.get<ExpoAccount>("/api/expo/account"));
  if (targetGeneration !== S.targetGeneration) return;
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  S.account = res.ok ? res.data ?? null : null;
  renderAccount();
}

export function renderAccount() {
  const el = $("expo-account-state");
  if (!el) return;
  if (!S.tokenSet) {
    el.textContent = t("config.tokenMissing", "Configura un Access Token para empezar");
    el.className = "text-sm text-muted-foreground";
    return;
  }
  const username = accountUsername(S.account);
  if (username) {
    el.className = "text-sm";
    el.innerHTML = `${esc(t("account.connected", "Conectado como"))} <span class="font-semibold text-foreground">${esc(username)}</span>${
      S.tokenPreview ? ` · <span class="font-mono text-xs">${esc(S.tokenPreview)}</span>` : ""
    }`;
  } else {
    el.textContent = t("account.notConnected", "Sin conectar");
    el.className = "text-sm text-muted-foreground";
  }
}

export async function testToken() {
  const btn = $("expo-token-test") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  // No dedicated /test endpoint: the GraphQL viewer validates the token.
  const res = await api.get<ExpoAccount>("/api/expo/account");
  if (btn) btn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("config.testError", "No se pudo validar el token"), false);
    return;
  }
  S.account = res.data ?? null;
  renderAccount();
  const username = accountUsername(S.account);
  showToast(username ? `${t("account.connected", "Conectado como")} ${username}` : t("config.tokenInvalid", "Token inválido"), !!username);
}

export async function clearToken() {
  if (!(await openConfirm(t("config.confirmClear", "¿Quitar el token de Expo?"), { title: t("config.clearTitle", "Quitar token"), confirmText: t("config.clearConfirm", "Quitar"), variant: "danger" }))) return;
  const res = await api.delete("/api/expo/config");
  if (!res.ok) {
    showToast(res.error ?? t("common.error", "Error"), false);
    return;
  }
  showToast(t("config.cleared", "Token eliminado"));
  S.tokenSet = false;
  S.tokenPreview = "";
  S.account = null;
  S.projects = [];
  S.currentProject = null;
  S.builds = [];
  S.envVars = [];
  updateConfigUI();
  renderAccount();
  renderProjects();
  renderBuilds();
  renderEnvVars();
}

// ── Quota ────────────────────────────────────────────────────────────────────
export async function loadQuota() {
  if (!S.tokenSet) return;
  const targetGeneration = S.targetGeneration;
  const selectedPath = S.currentProject?.path ?? "";
  // Skeleton the four metric values while the query runs.
  const valueIds = ["expo-quota-plan", "expo-quota-remaining", "expo-quota-concurrency", "expo-quota-used"];
  for (const id of valueIds) {
    const el = $(id);
    if (el) el.innerHTML = skelBar("h-5 w-16");
  }
  // Account-level (GraphQL); the optional path lets the backend add a CLI
  // build-count fallback when a project is selected.
  const body = S.currentProject?.path ? { path: S.currentProject.path } : {};
  const res = await readExpoData(() => api.post<ExpoQuota>("/api/expo/quota", body), () => (S.currentProject?.path ?? "") === selectedPath);
  if (targetGeneration !== S.targetGeneration || (S.currentProject?.path ?? "") !== selectedPath) return;
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  const q = res.ok ? res.data : null;
  const set = (id: string, v: unknown) => {
    const el = $(id);
    if (el) el.textContent = v === null || v === undefined || v === "" ? "—" : String(v);
  };
  set("expo-quota-plan", q?.planName ?? null);
  set("expo-quota-remaining", q?.remainingBuilds ?? null);
  set("expo-quota-concurrency", q?.concurrencies ?? null);
  set("expo-quota-used", q?.buildsThisMonth ?? q?.usedBuilds ?? null);
}
