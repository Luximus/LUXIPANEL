// Settings page — load/apply/collect/autosave pipeline, factory/layout reset,
// system timezone sync and the backup/smtp module gate. Module-local:
// selectedBackupId, smtpModuleInstalled, autosave flags, key sets.
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { MODULES_INSTALLED_PATH } from "@/lib/api-routes";
import { installTornasolAnimation, uninstallTornasolAnimation, isTornasolActive } from "/scripts/extracted/layouts/tornasol-animation.js?v=20260628a";
import { t, fmt, showToast, parseBoolean, normalizePanelAssetPath } from "./dom";
import { FIELDS, KEY_CATEGORIES, LAYOUT_DEFAULTS } from "./fields";
import { S } from "./state";
import { activateTab, setSmtpVisibility, SETTINGS_TAB_SESSION_KEY } from "./tabs";
import { loadLayoutPalettes, setCustomPaletteColor, setTornasolPaletteColors, setCurrentTornasolIntensity, refreshActivePalette, currentTornasolIntensity, tornasolPaletteColors } from "./layout-palettes";
import { reapplyLiveTheme, reapplyLiveLogos, syncDerivedControlsFromCanonical, updateLoginBackgroundSettingsVisibility, initImageListEditors } from "./layout-theme";
import { refreshAllLogoPreviews } from "./branding";
import { enforceAtLeastOneMethod, updateAuditLogButtonVisibility, applyHcaptchaCredential, loadAuthMethodStatus, load2FAStatusSettings } from "./security";

export function getAiModelHints(): Record<string, { models: string; hint: string; keyHint: string }> {
  return {
    anthropic: {
      models: "claude-fable-5, claude-sonnet-4-6, claude-opus-4-6, claude-haiku-4-5-20251001",
      hint: t("labels.aiHintAnthropic", "Modelos recomendados: claude-fable-5 (mas reciente), claude-sonnet-4-6 (equilibrio), claude-opus-4-6 (mas potente)"),
      keyHint: t("labels.aiKeyHintAnthropic", "Obten tu API key en console.anthropic.com"),
    },
    openai: {
      models: "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna",
      hint: t("labels.aiHintOpenai", "Modelos recomendados: gpt-5.6-sol (maximo), gpt-5.6-terra (equilibrio), gpt-5.6-luna (economico)"),
      keyHint: t("labels.aiKeyHintOpenai", "Obten tu API key en platform.openai.com"),
    },
    ollama: {
      models: "llama3.2, mistral, phi3",
      hint: t("labels.aiHintOllama", "Nombre del modelo instalado en Ollama local. No soporta herramientas."),
      keyHint: t("labels.aiKeyHintOllama", "No requiere API key para Ollama local"),
    },
  };
}

export let selectedBackupId: string | null = null;
export let smtpModuleInstalled = false;
export let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
export let autosaveInFlight = false;
export let autosaveQueued = false;
export const SMTP_SETTING_KEYS = new Set([
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_password",
  "smtp_from",
  "smtp_tls",
]);

export const MANUAL_LICENSE_KEYS = new Set([
  "license_key",
  "license_payment_reference",
]);

export function syncProviderCards(provider: string) {
  const radio = document.querySelector<HTMLInputElement>(`input[name="ai-provider-radio"][value="${provider}"]`);
  if (radio) radio.checked = true;

  const sel = document.getElementById("s-ai-provider") as HTMLSelectElement | null;
  if (sel) sel.value = provider;

  const info = getAiModelHints()[provider];
  if (!info) return;
  const mHint = document.getElementById("ai-model-hint");
  const kHint = document.getElementById("ai-key-hint");
  if (mHint) mHint.textContent = info.hint;
  if (kHint) kHint.textContent = info.keyHint;
}

export function applySettings(data: Record<string, unknown>) {
  for (const [key, elId] of Object.entries(FIELDS)) {
    if (!smtpModuleInstalled && SMTP_SETTING_KEYS.has(key)) continue;
    const el = document.getElementById(elId) as HTMLInputElement | HTMLSelectElement | null;
    if (!el) continue;
    const val = data[key];
    const fallback = LAYOUT_DEFAULTS[key];
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      const checkboxValue = (val === undefined || val === null || val === "") ? fallback : val;
      el.checked = parseBoolean(checkboxValue);
    } else if (fallback && (val === undefined || val === null || val === "")) {
      el.value = normalizePanelAssetPath(fallback);
    } else {
      const resolved = String(val ?? "");
      if (key.startsWith("layout_logo")) {
        el.value = normalizePanelAssetPath(resolved);
      } else {
        el.value = resolved;
      }
    }
  }

  enforceAtLeastOneMethod();

  // After loading, sync derived UI: highlight the active palette; logo previews track inputs.
  // The persisted `layout_palette_id` is the AUTHORITATIVE source for which
  // palette is selected — sessionStorage alone fails on a new tab / closed
  // browser (it is per-tab), and Tornasol's saved static colors are an exact
  // mirror of the violet palette so color-matching falls back to violet.
  const persistedPaletteId = String(data.layout_palette_id ?? "").trim();
  S.activePaletteId = null;
  if (persistedPaletteId && loadLayoutPalettes().some((p) => p.id === persistedPaletteId)) {
    S.activePaletteId = persistedPaletteId;
  }
  setCustomPaletteColor(String(data.layout_palette_custom_color ?? LAYOUT_DEFAULTS.layout_palette_custom_color));
  setTornasolPaletteColors((data.layout_tornasol_colors ?? data.layout_tornasol_color ?? LAYOUT_DEFAULTS.layout_tornasol_colors) as string | string[]);
  setCurrentTornasolIntensity(Number(data.layout_tornasol_intensity ?? LAYOUT_DEFAULTS.layout_tornasol_intensity));
  // If a previous Tornasol pick is persisted in sessionStorage (within the same
  // tab), restore the animation so a hard reload (which keeps the saved color
  // map but loses the running CSS keyframes) still shows the tornasol effect.
  if (S.activePaletteId === "prisma" || (!S.activePaletteId && isTornasolActive())) {
    S.activePaletteId = "prisma";
  }
  refreshActivePalette();
  // Sync the persisted live-theme override to the freshly loaded values, so SPA
  // navigation (and factory reset, which re-loads) reflects the current theme.
  reapplyLiveTheme();
  // Install the Tornasol animation AFTER reapplyLiveTheme so its <style> is
  // appended/moved to the END of <head>. Otherwise the live-theme block (also
  // `:root:root:root { --primary: … }`, later in document order) would win
  // over the keyframe-set `--primary` and the user would see static violet
  // instead of the cycling colors. Mirrors applyPersistedTheme in branding-runtime.
  if (S.activePaletteId === "prisma") {
    installTornasolAnimation(currentTornasolIntensity(), tornasolPaletteColors());
  } else {
    uninstallTornasolAnimation();
  }
  // Re-sync the visible derived controls (radius slider, decomposed shadows,
  // range readouts) from the canonical inputs after every (re)load — covers
  // initial load, palette switches and factory-reset re-load.
  syncDerivedControlsFromCanonical();
  refreshAllLogoPreviews();
  // Igual que reapplyLiveTheme: sincroniza el override vivo de logos con los
  // valores recién cargados (cubre carga inicial y factory reset).
  reapplyLiveLogos();
  updateLoginBackgroundSettingsVisibility();
  initImageListEditors();

  if (data.ai_provider) syncProviderCards(String(data.ai_provider));
  updateAuditLogButtonVisibility();
}

/** Reset ONLY the layout/appearance settings (logos, login/panel backgrounds,
 *  radius, shadows and the full light/dark color theme) to LUXIPANEL's built-in
 *  defaults, then re-apply the live preview and persist. Other tabs
 *  (general/seguridad/smtp/…) are left untouched. Mirrors the derived-UI
 *  pipeline applySettings()/applyLayoutPalette() run after a (re)load. */
export function resetLayoutToDefaults() {
  for (const [key, elId] of Object.entries(FIELDS)) {
    if (!key.startsWith("layout_")) continue;
    const def = LAYOUT_DEFAULTS[key];
    if (def === undefined) continue;
    const el = document.getElementById(elId) as HTMLInputElement | null;
    if (!el) continue;
    if (el.type === "checkbox") {
      el.checked = parseBoolean(def);
    } else if (key.startsWith("layout_logo")) {
      el.value = normalizePanelAssetPath(def);
    } else {
      el.value = def;
    }
  }
  S.activePaletteId = LAYOUT_DEFAULTS.layout_palette_id;
  setCustomPaletteColor(LAYOUT_DEFAULTS.layout_palette_custom_color);
  setTornasolPaletteColors(LAYOUT_DEFAULTS.layout_tornasol_colors);
  setCurrentTornasolIntensity(Number(LAYOUT_DEFAULTS.layout_tornasol_intensity));
  reapplyLiveTheme();
  syncDerivedControlsFromCanonical();
  refreshActivePalette();
  refreshAllLogoPreviews();
  updateLoginBackgroundSettingsVisibility();
  initImageListEditors();
  // Layout keys write through to LP-LICENSE-SERVER branding on save.
  scheduleAutosave(true);
}

export function collectSettings(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, elId] of Object.entries(FIELDS)) {
    if (!smtpModuleInstalled && SMTP_SETTING_KEYS.has(key)) continue;
    if (MANUAL_LICENSE_KEYS.has(key)) continue;
    // Derived/read-only: the panel name mirrors the registered subdomain and
    // the timezone comes straight from the connected server — neither is
    // user-editable here, so they must never be pushed to /api/settings/bulk.
    if (key === "panel_name" || key === "timezone") continue;
    const el = document.getElementById(elId) as HTMLInputElement | HTMLSelectElement | null;
    if (!el) continue;
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      out[key] = el.checked;
    } else {
      out[key] = key.startsWith("layout_logo")
        ? normalizePanelAssetPath(el.value)
        : el.value;
    }
  }
  return out;
}

export function scheduleAutosave(immediate = false) {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }

  if (immediate) {
    void saveSettingsAutomatically();
    return;
  }

  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    void saveSettingsAutomatically();
  }, 600);
}

export async function saveSettingsAutomatically() {
  if (autosaveInFlight) {
    autosaveQueued = true;
    return;
  }

  autosaveInFlight = true;

  try {
    const raw = collectSettings();
    const payload = {
      settings: Object.entries(raw)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) => ({
          key,
          value: String(value),
          category: KEY_CATEGORIES[key] ?? "general",
        })),
    };

    if (payload.settings.length === 0) return;

    const res = await api.put<any>("/api/settings/bulk", payload);
    if (res.ok) {
      // El logo del navbar/sidebar (y favicon) debe reflejar el cambio al
      // instante: el mapa SSR queda stale justo tras guardar (mismo motivo
      // que el live-theme), así que se aplica y persiste el override aquí.
      reapplyLiveLogos();
    }
    if (!res.ok) {
      showToast(res.error ?? t("toasts.errorSaving", "Error al guardar ajustes"), false);
    }
  } finally {
    autosaveInFlight = false;
    if (autosaveQueued) {
      autosaveQueued = false;
      void saveSettingsAutomatically();
    }
  }
}

export function bindAutoSaveField(el: HTMLInputElement | HTMLSelectElement | null) {
  if (!el) return;

  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox" || el.type === "radio") {
      el.addEventListener("change", () => scheduleAutosave(true));
      return;
    }

    el.addEventListener("input", () => scheduleAutosave());
    el.addEventListener("change", () => scheduleAutosave(true));
    return;
  }

  el.addEventListener("change", () => scheduleAutosave(true));
}

export function bindDeferredCheckboxAutoSave(el: HTMLInputElement | null) {
  if (!el) return;
  el.addEventListener("change", () => {
    setTimeout(() => scheduleAutosave(true), 0);
  });
}

/**
 * A load failure whose `code`/`status` points to an unresolved per-server
 * session (e.g. the backend lost the bridged session after a restart and now
 * returns a typed `NO_SERVER_EXECUTOR`/`SESSION_EXPIRED`/409/428). These are
 * recoverable by reselecting the server or logging back in, so we surface a
 * more specific, actionable message. Matched tolerantly so we don't couple
 * hard to the exact backend code string.
 */
function isSessionLoadError(code?: string, status?: number): boolean {
  if (status === 401 || status === 409 || status === 428 || status === 440) return true;
  if (!code) return false;
  return /EXECUTOR|SESSION|SERVER_SCOPE|TARGET_SCOPE|RESELECT|BRIDGE|NO_SERVER|NO_TARGET/i.test(code);
}

/** Hide skeleton + error banner and reveal the settings content container. */
function revealSettingsContent() {
  document.getElementById("settings-skeleton")?.classList.add("hidden");
  document.getElementById("settings-load-error")?.classList.add("hidden");
  document.getElementById("settings-content")?.classList.remove("hidden");
}

/**
 * Resilience: a failed `GET /api/settings` must NEVER leave the page stuck on
 * an infinite skeleton. Reveal the content container anyway, hide the skeleton,
 * and show an actionable error banner (session/server → reselect/relogin;
 * otherwise a generic "couldn't load Settings" + retry).
 */
function showSettingsLoadError(code?: string, status?: number) {
  // Reveal the content container so the user never sees a hung skeleton.
  document.getElementById("settings-skeleton")?.classList.add("hidden");
  document.getElementById("settings-content")?.classList.remove("hidden");

  const banner = document.getElementById("settings-load-error");
  const msgEl = document.getElementById("settings-load-error-msg");
  if (msgEl) {
    msgEl.textContent = isSessionLoadError(code, status)
      ? t(
          "loadFailure.sessionMessage",
          "No se pudo cargar Ajustes: la sesión con el servidor no está disponible. Vuelve a seleccionar el servidor en el selector, o cierra sesión e inicia de nuevo.",
        )
      : t("loadFailure.genericMessage", "No se pudo cargar Ajustes. Revisa tu conexión e inténtalo de nuevo.");
  }
  const retry = document.getElementById("settings-load-error-retry");
  if (retry) {
    // Assign (not addEventListener) so repeated failures never stack handlers.
    (retry as HTMLButtonElement).onclick = () => {
      banner?.classList.add("hidden");
      document.getElementById("settings-content")?.classList.add("hidden");
      document.getElementById("settings-skeleton")?.classList.remove("hidden");
      void loadSettings();
    };
  }
  banner?.classList.remove("hidden");
}

let settingsLoadGeneration = 0;
export async function loadSettings() {
 const generation = ++settingsLoadGeneration;
 const root = document.getElementById("settings-content");
 const scope = resolveTargetScope();
 const isCurrent = () => generation === settingsLoadGeneration && scope === resolveTargetScope()
   && root === document.getElementById("settings-content");
 try {
  const res = await api.get<any>("/api/settings");
  if (!isCurrent()) return;
  if (!res.ok) {
    showSettingsLoadError(res.code, res.status);
    return;
  }
  revealSettingsContent();

  const map: Record<string, unknown> = {};
  if (res.ok && res.data) {
    if (Array.isArray(res.data)) {
      for (const s of res.data) map[s.key] = s.value;
    } else {
      Object.assign(map, res.data);
    }
  }

  // Always sync the timezone <select> with whatever the connected server
  // reports — it's the source of truth for the OS clock. The kv-store
  // value is just a mirror used for fast reads.
  // The OS timezone is read-only here. Populate the remaining form now and
  // update only this select when the independent system read finishes.

  // "Nombre del panel" = the registered subdomain this panel is served on.
  // It's derived (not user-editable); keep the label, show the host read-only.
  const subdomain = (typeof location !== "undefined" && location.hostname) ? location.hostname : "";
  if (subdomain) map.panel_name = subdomain;

  // Default UI language is English unless a value was explicitly stored.
  if (map.language === undefined || map.language === null || map.language === "") {
    map.language = "en";
  }

  applySettings(map);
  applyHcaptchaCredential(map);

  // Lock the derived/read-only General fields after values are applied.
  const panelNameEl = document.getElementById("s-panel-name") as HTMLInputElement | null;
  if (panelNameEl) {
    panelNameEl.readOnly = true;
    panelNameEl.classList.add("opacity-70", "cursor-not-allowed");
  }
  const tzEl = document.getElementById("s-timezone") as HTMLSelectElement | null;
  if (tzEl) {
    tzEl.disabled = true;
    tzEl.classList.add("opacity-70", "cursor-not-allowed");
  }
  updateAuditLogButtonVisibility();
  void syncTimezoneFromSystem(map).then(() => {
    if (!isCurrent() || !tzEl || !map.timezone) return;
    tzEl.value = String(map.timezone);
  });
  void Promise.allSettled([loadAuthMethodStatus(), load2FAStatusSettings()]);
 } catch {
  // Any thrown error (network, non-JSON, downstream failure) must not leave
  // the page hung on the skeleton. Reveal the content + actionable banner.
  if (isCurrent()) showSettingsLoadError();
 }
}

/**
 * Read the system timezone from the connected server and reflect it in the
 * <select>. If the value isn't already an option, append it dynamically so
 * the dropdown shows the correct selection regardless of the catalog.
 */
export async function syncTimezoneFromSystem(map: Record<string, unknown>) {
  const select = document.getElementById("s-timezone") as HTMLSelectElement | null;
  if (!select) return;
  const scope = resolveTargetScope();
  try {
    const res = await api.get<any>("/api/admin/system/timezone");
    if (select !== document.getElementById("s-timezone") || scope !== resolveTargetScope()) return;
    const tz = (res.ok && res.data?.timezone) ? String(res.data.timezone) : "";
    if (!tz) return;
    if (!Array.from(select.options).some((o) => o.value === tz)) {
      const opt = document.createElement("option");
      opt.value = tz;
      opt.textContent = tz;
      select.appendChild(opt);
    }
    map.timezone = tz;
  } catch {
    // best-effort
  }
}

/**
 * When the user changes the timezone <select>, also apply the change to the
 * OS via timedatectl so the connected server's clock reflects it.
 */
export function bindSystemTimezoneApply() {
  const select = document.getElementById("s-timezone") as HTMLSelectElement | null;
  if (!select) return;
  select.addEventListener("change", async () => {
    const tz = select.value.trim();
    if (!tz) return;
    const res = await api.put<any>("/api/admin/system/timezone", { timezone: tz });
    if (!res.ok) {
      showToast(res.error ?? t("toasts.timezoneApplyError", "No se pudo aplicar la zona horaria al sistema"), false);
    } else if (res.data?.applied === false) {
      showToast(t("toasts.timezoneSavedNotApplied", "Zona horaria guardada en el panel, pero no se pudo aplicar al sistema (revisa permisos sudo)."), false);
    }
  });
}

export async function loadBackupSection() {
  const res = await api.get<any>(MODULES_INSTALLED_PATH);
  const installed: string[] = res.ok ? ((res.data as any[]) ?? []).map((m: any) => m.id ?? m.name) : [];
  const hasMail = installed.some((id) => id === "mail");
  const hasBackup = installed.some((id) => id === "backup" || id === "backups");

  smtpModuleInstalled = hasMail;
  setSmtpVisibility(hasMail);
  const currentTab = sessionStorage.getItem(SETTINGS_TAB_SESSION_KEY);
  if (!hasMail && currentTab === "smtp") {
    activateTab("general");
  }

  document.getElementById("backup-restore-section")?.classList.toggle("hidden", !hasBackup);
  document.getElementById("no-backup-notice")?.classList.toggle("hidden", hasBackup);
  if (!hasBackup) return;

  const bRes = await api.get<any>("/api/backups");
  const backupList = document.getElementById("backup-list")!;
  const restoreBtn = document.getElementById("btn-restore-backup") as HTMLButtonElement;

  if (!bRes.ok || !Array.isArray(bRes.data) || bRes.data.length === 0) {
    backupList.innerHTML = `<p class="text-sm text-muted-foreground">${t("empty.noBackups", "No hay backups disponibles.")}</p>`;
    restoreBtn.disabled = true;
    return;
  }

  const formatBytes = (value: unknown) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = value;
    let idx = 0;
    while (size >= 1024 && idx < units.length - 1) {
      size /= 1024;
      idx += 1;
    }
    return `${size.toFixed(size >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
  };

  backupList.innerHTML = bRes.data
    .map(
      (b: any) => `
      <label class="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
        <input type="radio" name="backup-item" value="${String(b.id ?? "")}" class="accent-primary" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">${b.label ?? `Backup #${b.id ?? "-"}`}</p>
          <p class="text-xs text-muted-foreground">${b.createdAt ? new Date(b.createdAt).toLocaleString(document.documentElement.lang || navigator.language || "en") : ""} ${b.status ? `· ${b.status}` : ""} ${formatBytes(b.sizeBytes) ? `· ${formatBytes(b.sizeBytes)}` : ""}</p>
        </div>
      </label>`
    )
    .join("");

  backupList.querySelectorAll<HTMLInputElement>("input[name='backup-item']").forEach((radio) => {
    radio.addEventListener("change", () => {
      selectedBackupId = radio.value;
      restoreBtn.disabled = false;
    });
  });

  restoreBtn.addEventListener("click", async () => {
    if (!selectedBackupId) return;
    if (!await openConfirm(fmt(t("confirm.restoreBackupBody", '¿Restaurar el backup "{id}"?'), { id: selectedBackupId }), { title: t("confirm.restoreBackupTitle", "Restaurar backup"), confirmText: t("actions.continue", "Continuar") })) return;
    showToast(t("toasts.backupRestoreUnavailable", "La restauracion de backups aun no esta disponible desde este panel."), false);
  });
}
