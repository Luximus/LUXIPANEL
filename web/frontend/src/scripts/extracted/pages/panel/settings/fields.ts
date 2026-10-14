// Settings page — settings-key catalog: FIELDS (key→element id), KEY_CATEGORIES,
// LAYOUT_DEFAULTS and LAYOUT_COLOR_KEYS, populated (incl. per-effect + panel bg)
// from the login-effects registry at eval. Imports only the registry (by URL).
import { LOGIN_EFFECTS } from "/scripts/extracted/lib/login-effects-registry.js?v=20260602a";
import { DEFAULT_LAYOUT_PALETTE_ID, LUXISOFT_LAYOUT_PALETTE, paletteToSettings } from "@/lib/layout-palettes";

// Order matters: matches the visual grouping rendered in the layout panel.
export const LAYOUT_COLOR_KEYS = [
  "background", "foreground", "card", "muted", "accent", "border",
  "primary", "primary_foreground", "primary_accent",
  "secondary", "secondary_foreground",
  "info", "info_foreground",
  "success", "success_foreground",
  "warning", "warning_foreground",
  "error", "error_foreground",
] as const;

export const LAYOUT_DEFAULTS: Record<string, string> = {
  layout_palette_id: DEFAULT_LAYOUT_PALETTE_ID,
  layout_palette_custom_color: "#7c3aed",
  layout_tornasol_color: "#7c3aed",
  layout_tornasol_colors: "[\"#7c3aed\",\"#06b6d4\",\"#f59e0b\"]",
  layout_tornasol_intensity: "50",
  layout_logo: "/panel/logo_300.webp",
  layout_login_background_enabled: "true",
  layout_login_background_fallback_color: "#020617",
  layout_login_background_type: "letter_glitch",
  // Per-effect login-background defaults are merged from the login-effects
  // registry below (see mergeLoginEffectRegistry). Do not hardcode them here.
  layout_radius: "0.95rem",
  layout_shadow: "0 1px 3px rgba(15, 23, 42, 0.10), 0 10px 30px rgba(15, 23, 42, 0.08)",
  layout_modal_shadow: "0 20px 60px rgba(15, 23, 42, 0.24)",
  layout_modal_backdrop: "rgba(15, 23, 42, 0.60)",

  ...paletteToSettings(LUXISOFT_LAYOUT_PALETTE),
};

export const FIELDS: Record<string, string> = {
  panel_name: "s-panel-name",
  timezone: "s-timezone",
  language: "s-language",
  switch_open_new_tab: "s-switch-new-tab",
  layout_palette_id: "s-layout-palette-id",
  layout_palette_custom_color: "s-layout-palette-custom-color",
  layout_tornasol_color: "s-layout-tornasol-color",
  layout_tornasol_colors: "s-layout-tornasol-colors",
  layout_tornasol_intensity: "s-layout-tornasol-intensity",
  layout_logo: "s-layout-logo",
  layout_login_background_enabled: "s-layout-login-background-enabled",
  layout_login_background_fallback_color: "s-layout-login-background-fallback-color",
  layout_login_background_type: "s-layout-login-background-type",
  // Per-effect login-background field ids are merged from the login-effects
  // registry below (see mergeLoginEffectRegistry). Do not hardcode them here.
  layout_radius: "s-layout-radius",
  layout_shadow: "s-layout-shadow",
  layout_modal_shadow: "s-layout-modal-shadow",
  layout_modal_backdrop: "s-layout-modal-backdrop",
  // Color fields are appended below (generated from LAYOUT_COLOR_KEYS).
  smtp_host: "s-smtp-host",
  smtp_port: "s-smtp-port",
  smtp_user: "s-smtp-user",
  smtp_password: "s-smtp-password",
  smtp_from: "s-smtp-from",
  smtp_tls: "s-smtp-tls",
  session_ttl_hours: "s-session-ttl",
  max_login_attempts: "s-max-login-attempts",
  require_2fa: "s-require-2fa",
  hcaptcha_enabled: "s-hcaptcha-enabled",
  audit_log_enabled: "s-audit-log",
  login_allow_password: "s-login-allow-password",
  login_allow_passkey: "s-login-allow-passkey",
  login_allow_recovery: "s-login-allow-recovery",
  backup_dir: "s-backup-dir",
  backup_retention_days: "s-backup-retention",
  s3_endpoint: "s-s3-endpoint",
  s3_bucket: "s-s3-bucket",
  s3_access_key: "s-s3-key",
  s3_secret_key: "s-s3-secret",
  ai_enabled: "s-ai-enabled",
  ai_provider: "s-ai-provider",
  ai_model: "s-ai-model",
  ai_api_key: "s-ai-key",
  license_key: "s-license-key",
  license_payment_reference: "s-license-payment",
};

export const KEY_CATEGORIES: Record<string, string> = {
  panel_name: "general",
  timezone: "general",
  language: "general",
  switch_open_new_tab: "general",
  layout_palette_id: "layout",
  layout_palette_custom_color: "layout",
  layout_tornasol_color: "layout",
  layout_tornasol_colors: "layout",
  layout_tornasol_intensity: "layout",
  layout_logo: "layout",
  layout_login_background_enabled: "layout",
  layout_login_background_fallback_color: "layout",
  layout_login_background_type: "layout",
  // Per-effect login-background categories are merged from the login-effects
  // registry below (see mergeLoginEffectRegistry). Do not hardcode them here.
  layout_radius: "layout",
  layout_shadow: "layout",
  layout_modal_shadow: "layout",
  layout_modal_backdrop: "layout",
  // Color category entries appended below (generated from LAYOUT_COLOR_KEYS).
  smtp_host: "smtp",
  smtp_port: "smtp",
  smtp_user: "smtp",
  smtp_password: "smtp",
  smtp_from: "smtp",
  smtp_tls: "smtp",
  session_ttl_hours: "security",
  max_login_attempts: "security",
  require_2fa: "security",
  hcaptcha_enabled: "security",
  audit_log_enabled: "security",
  login_allow_password: "security",
  login_allow_passkey: "security",
  login_allow_recovery: "security",
  backup_dir: "storage",
  backup_retention_days: "storage",
  s3_endpoint: "storage",
  s3_bucket: "storage",
  s3_access_key: "storage",
  s3_secret_key: "storage",
  ai_enabled: "ai",
  ai_provider: "ai",
  ai_model: "ai",
  ai_api_key: "ai",
  license_key: "general",
  license_payment_reference: "general",
};

// Populate FIELDS / KEY_CATEGORIES with the layout color entries.
for (const mode of ["light", "dark"] as const) {
  for (const key of LAYOUT_COLOR_KEYS) {
    const settingKey = `layout_${mode}_${key}`;
    const elementId = `s-layout-${mode}-${key.replace(/_/g, "-")}`;
    FIELDS[settingKey] = elementId;
    KEY_CATEGORIES[settingKey] = "layout";
  }
}

// Top-level keys for the panel (app) background, mirroring the login ones.
// Panel background ships DISABLED by default (opt-in) — an animated WebGL layer
// behind the whole dashboard is GPU-heavy, so the admin turns it on explicitly.
LAYOUT_DEFAULTS.layout_panel_background_enabled = "false";
LAYOUT_DEFAULTS.layout_panel_background_fallback_color = "#0f0f0f";
LAYOUT_DEFAULTS.layout_panel_background_type = "letter_glitch";
FIELDS.layout_panel_background_enabled = "s-layout-panel-background-enabled";
FIELDS.layout_panel_background_fallback_color = "s-layout-panel-background-fallback-color";
FIELDS.layout_panel_background_type = "s-layout-panel-background-type";
KEY_CATEGORIES.layout_panel_background_enabled = "layout";
KEY_CATEGORIES.layout_panel_background_fallback_color = "layout";
KEY_CATEGORIES.layout_panel_background_type = "layout";

// Populate defaults / field ids / categories for every per-effect background
// prop from the registry (single source of truth shared with the SSR settings
// page and the layouts). Field ids mirror `s-<storageKey-dashed>`. The same
// registry drives two independent scopes: the login background (`layout_login_*`)
// and the panel background (`layout_panel_*`, key derived by swapping the scope
// segment — kept in sync with scopedStorageKey() in lib/login-effects/coerce.ts).
for (const effect of LOGIN_EFFECTS) {
  for (const prop of effect.props) {
    for (const storageKey of [
      prop.storageKey,
      prop.storageKey.replace(/^layout_login_/, "layout_panel_"),
    ]) {
      LAYOUT_DEFAULTS[storageKey] = String(prop.default);
      FIELDS[storageKey] = "s-" + storageKey.replace(/_/g, "-");
      KEY_CATEGORIES[storageKey] = "layout";
    }
  }
}
