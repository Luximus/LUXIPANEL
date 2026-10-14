// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
export type LayoutSettingsMap = Record<string, string>;

import { LUXISOFT_LAYOUT_PALETTE, paletteToSettings } from "./layout-palettes";

const PANEL_ASSET_ALIASES: Record<string, string> = {
  "/favicon.ico": "/panel/favicon.ico",
  "/logo_50.webp": "/panel/logo_50.webp",
  "/logo_150.webp": "/panel/logo_150.webp",
  "/logo_300.webp": "/panel/logo_300.webp",
};

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettingsMap = {
  layout_logo: "/logo_300.webp",
  layout_favicon: "/favicon.ico",
  layout_login_background_enabled: "true",
  layout_login_background_fallback_color: "#020617",
  layout_login_background_type: "letter_glitch",
  layout_login_letter_glitch_color1: "#1c96e9",
  layout_login_letter_glitch_color2: "#8011dd",
  layout_login_letter_glitch_color3: "#11dc2d",
  layout_login_letter_glitch_speed: "50",
  layout_login_letter_glitch_center_vignette: "false",
  layout_login_letter_glitch_outer_vignette: "true",
  layout_login_letter_glitch_smooth: "true",
  layout_login_letter_glitch_characters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789",
  layout_login_linewaves_color1: "#1c96e9",
  layout_login_linewaves_color2: "#8011dd",
  layout_login_linewaves_color3: "#11dc2d",
  layout_login_linewaves_speed: "0.3",
  layout_login_linewaves_inner_line_count: "40",
  layout_login_linewaves_outer_line_count: "36",
  layout_login_linewaves_warp_intensity: "1.3",
  layout_login_linewaves_rotation: "-19",
  layout_login_linewaves_edge_fade_width: "0.15",
  layout_login_linewaves_color_cycle_speed: "0.9",
  layout_login_linewaves_brightness: "0.4",
  layout_login_linewaves_mouse_influence: "2",
  layout_login_linewaves_enable_mouse_interaction: "true",
  layout_radius: "0.95rem",
  layout_shadow: "0 1px 3px rgba(15, 23, 42, 0.10), 0 10px 30px rgba(15, 23, 42, 0.08)",
  layout_modal_shadow: "0 20px 60px rgba(15, 23, 42, 0.24)",
  layout_modal_backdrop: "rgba(15, 23, 42, 0.60)",

  ...paletteToSettings(LUXISOFT_LAYOUT_PALETTE),
};

export function normalizeLayoutSettings(raw: Record<string, unknown> | null | undefined): LayoutSettingsMap {
  const normalized: LayoutSettingsMap = { ...DEFAULT_LAYOUT_SETTINGS };

  for (const [key, value] of Object.entries(raw ?? {})) {
    if (typeof value === "string") {
      normalized[key] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      normalized[key] = String(value);
    }
  }

  // Normalize well-known public assets to their panel-safe paths.
  for (const key of ["layout_logo", "layout_favicon"]) {
    const value = normalized[key];
    if (typeof value === "string" && PANEL_ASSET_ALIASES[value]) {
      normalized[key] = PANEL_ASSET_ALIASES[value];
    }
  }

  // Backwards-compat: settings persisted under the legacy per-slot keys
  // (layout_logo_primary, _sidebar, _login, _footer) are folded into the single
  // layout_logo. The first non-empty legacy slot wins; once layout_logo is
  // written, the legacy keys are dropped from the in-memory map so callers
  // see a single source of truth.
  if (typeof normalized.layout_logo !== "string" || normalized.layout_logo === "") {
    for (const legacyKey of ["layout_logo_primary", "layout_logo_sidebar", "layout_logo_login", "layout_logo_footer"]) {
      const legacy = normalized[legacyKey];
      if (typeof legacy === "string" && legacy !== "") {
        normalized.layout_logo = legacy;
        break;
      }
    }
  }
  for (const legacyKey of ["layout_logo_primary", "layout_logo_sidebar", "layout_logo_login", "layout_logo_footer"]) {
    delete normalized[legacyKey];
  }

  return normalized;
}

export function pickLayoutSetting(settings: LayoutSettingsMap, key: string): string {
  return settings[key] ?? DEFAULT_LAYOUT_SETTINGS[key] ?? "";
}

// ---------------------------------------------------------------------------
// CSS value sanitizers (XSS hardening).
//
// Branding values come from the admin-controlled /api/public/layout endpoint
// and are interpolated *raw* into an inline <style set:html>. A malicious value
// such as `</style><script>…` or `red;}body{display:none` would break out of
// the <style> block (stored XSS). Every branding value that ends up inside the
// CSS MUST pass through one of these helpers before serialization.
// ---------------------------------------------------------------------------

// Characters that let a value escape its CSS declaration / the <style> element.
// `<`/`>` close the style tag; `{`/`}` open/close rule blocks; `;` ends a
// declaration; `:` starts a new property; `\\` enables CSS escapes; newlines and
// control chars reformat the output and can hide payloads. Spaces and commas
// are NOT dangerous (legitimate in `rgb(15, 23, 42)` / shadow lists).
const CSS_DANGEROUS_RE = /[<>{};:\\\r\n\t\f\x00-\x1f]/;

/**
 * Generic guard: rejects a value if it contains any character that could break
 * out of its CSS declaration or the surrounding <style> element. Returns the
 * value unchanged when safe, or `null` when it must be discarded.
 */
export function rejectDangerousCss(value: string): string | null {
  return CSS_DANGEROUS_RE.test(value) ? null : value;
}

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const NUM = "-?\\d+(?:\\.\\d+)?%?";
const RGB_FN_RE = new RegExp(
  `^rgba?\\(\\s*${NUM}\\s*,\\s*${NUM}\\s*,\\s*${NUM}\\s*(?:,\\s*${NUM}\\s*)?\\)$`,
);
const HSL_FN_RE = new RegExp(
  `^hsla?\\(\\s*${NUM}\\s*,\\s*${NUM}\\s*,\\s*${NUM}\\s*(?:,\\s*${NUM}\\s*)?\\)$`,
);

/**
 * Validates a color value. Accepts hex (#rgb/#rrggbb/#rrggbbaa) and
 * rgb()/rgba()/hsl()/hsla() with numeric components only. Anything else (and
 * anything containing CSS-dangerous characters) yields the provided fallback.
 */
export function sanitizeColor(value: string, fallback: string): string {
  const v = value.trim();
  if (rejectDangerousCss(v) === null) return fallback;
  if (HEX_COLOR_RE.test(v) || RGB_FN_RE.test(v) || HSL_FN_RE.test(v)) return v;
  return fallback;
}

const LENGTH_RE = /^-?\d+(?:\.\d+)?(?:px|rem|em|%)$/;

/**
 * Validates a single CSS length: number + allowed unit (px, rem, em, %).
 * Returns the fallback when the value is malformed or contains dangerous chars.
 */
export function sanitizeLength(value: string, fallback: string): string {
  const v = value.trim();
  if (rejectDangerousCss(v) === null) return fallback;
  return LENGTH_RE.test(v) ? v : fallback;
}

// A box-shadow value is a comma-separated list of layers, each a sequence of
// offset lengths (e.g. `0 1px 3px`) plus an optional color and `inset` keyword,
// e.g. "0 1px 3px rgba(15,23,42,.1), 0 10px 30px rgba(15,23,42,.08)". Each token
// must be a length (number + optional px/rem/em/% unit, or bare 0), `inset`, a
// hex color, or an rgb()/rgba()/hsl()/hsla() color. Anything else → fallback.
const LENGTH_TOKEN_RE = /^-?\d+(?:\.\d+)?(?:px|rem|em|%)?$/;

function isShadowLayer(layer: string): boolean {
  const tokens = layer.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  for (const t of tokens) {
    if (t === "inset") continue;
    if (LENGTH_TOKEN_RE.test(t)) continue;
    if (HEX_COLOR_RE.test(t)) continue;
    // A color function may itself contain whitespace (`rgba(15, 23, 42, .1)`),
    // so it can span several whitespace-split tokens; validate it below instead.
    return false;
  }
  return true;
}

/**
 * Validates a box-shadow style value. Rejects CSS-dangerous chars (no breakout)
 * and anything outside the safe shadow grammar: offset lengths, `inset`, hex and
 * rgb()/rgba()/hsl()/hsla() colors. Returns the fallback otherwise.
 */
export function sanitizeShadow(value: string, fallback: string): string {
  const v = value.trim();
  if (rejectDangerousCss(v) === null) return fallback;
  if (v === "none") return v;
  // Pull color functions out first (they contain commas/spaces that would
  // confuse the comma-split of layers); replace each with a placeholder token.
  const COLOR_FN = /(?:rgba?|hsla?)\([^()]*\)/gi;
  const colorFns = v.match(COLOR_FN) ?? [];
  for (const fn of colorFns) {
    if (!(RGB_FN_RE.test(fn) || HSL_FN_RE.test(fn))) return fallback;
  }
  const skeleton = v.replace(COLOR_FN, "#000000");
  if (/[()]/.test(skeleton)) return fallback; // leftover/garbage parens
  const layers = skeleton.split(",");
  return layers.every((l) => isShadowLayer(l)) ? v : fallback;
}

export function getLayoutThemeVars(settings: LayoutSettingsMap, mode: "light" | "dark"): Record<string, string> {
  const prefix = `layout_${mode}_`;
  // Colors are validated against their own per-key default so a malformed or
  // hostile value can never break out of the inline <style> (stored XSS). The
  // sanitized result is also used inside composed `color-mix(...)` expressions
  // below, so those stay safe by construction.
  const pick = (k: string) =>
    sanitizeColor(
      pickLayoutSetting(settings, `${prefix}${k}`),
      DEFAULT_LAYOUT_SETTINGS[`${prefix}${k}`] ?? "#000000",
    );

  // Container / base SURFACES. In DARK mode these are forced to LUXIPANEL's
  // default neutral dark scheme for EVERY theme, so dark containers (section
  // cards, banners, panels, sidebar, inputs) keep the same look across all
  // palettes — matching the default Luxisoft theme. Only the brand accent
  // (primary / primary_accent, handled below) changes per theme. Without this,
  // each palette tints card/background/muted/accent/border/secondary toward its
  // own hue (e.g. Rosa's dark card #221016 reads reddish). In LIGHT mode they
  // still track the chosen palette as before.
  const pickContainer = (k: string) =>
    mode === "dark"
      ? sanitizeColor(
          pickLayoutSetting(DEFAULT_LAYOUT_SETTINGS, `layout_dark_${k}`),
          DEFAULT_LAYOUT_SETTINGS[`layout_dark_${k}`] ?? "#000000",
        )
      : pick(k);

  const background = pickContainer("background");
  const foreground = pick("foreground");
  const card = pickContainer("card");
  const muted = pickContainer("muted");
  const accent = pickContainer("accent");
  const border = pickContainer("border");
  const primary = pick("primary");
  const primaryForeground = pick("primary_foreground");
  const primaryAccent = pick("primary_accent");
  const secondary = pickContainer("secondary");
  const secondaryForeground = pickContainer("secondary_foreground");
  const info = pick("info");
  const infoForeground = pick("info_foreground");
  const success = pick("success");
  const successForeground = pick("success_foreground");
  const warning = pick("warning");
  const warningForeground = pick("warning_foreground");
  const errorColor = pick("error");
  const errorForeground = pick("error_foreground");

  // Container FILL family. In DARK mode these stay LUXIPANEL's default Luxisoft
  // for EVERY theme: per request, dark containers keep the same default tinted
  // background and only the *accent* (text / icon / border / solid) follows the
  // chosen theme. In LIGHT mode we still follow the chosen primary, but with a
  // much softer blend so custom/tornasol do not flood white surfaces.
  const fillPrimary = mode === "dark" ? DEFAULT_LAYOUT_SETTINGS.layout_dark_primary : primary;
  const fillAccent = mode === "dark" ? DEFAULT_LAYOUT_SETTINGS.layout_dark_primary_accent : primaryAccent;
  const brandDimMix = mode === "dark" ? 12 : 5;
  const brandGlowMix = mode === "dark" ? 20 : 9;
  const borderBrandMix = mode === "dark" ? 35 : 22;
  const okBgPrimaryMix = mode === "dark" ? 10 : 4;
  const okBorderPrimaryMix = mode === "dark" ? 38 : 24;
  const badgeActiveBgPrimaryMix = mode === "dark" ? 14 : 6;
  const cardHoverPrimaryMix = mode === "dark" ? 16 : 7;

  return {
    "--background": background,
    "--foreground": foreground,
    "--card": card,
    "--card-foreground": foreground,
    "--popover": card,
    "--popover-foreground": foreground,
    "--primary": primary,
    "--primary-foreground": primaryForeground,
    "--primary-accent": primaryAccent,
    "--secondary": secondary,
    "--secondary-foreground": secondaryForeground,
    "--secondary-accent": primaryAccent,
    "--muted": muted,
    "--muted-foreground": mode === "dark" ? "#aab4af" : "#64748b",
    "--accent": accent,
    "--accent-foreground": foreground,
    "--info": info,
    "--info-foreground": infoForeground,
    "--success": success,
    "--success-foreground": successForeground,
    "--warning": warning,
    "--warning-foreground": warningForeground,
    "--error": errorColor,
    "--error-foreground": errorForeground,
    "--border": border,
    "--input": border,
    "--outline": mode === "dark" ? primary : primaryAccent,
    "--ring": mode === "dark" ? primary : primaryAccent,
    "--brand": primary,
    "--brand-light": primaryAccent,
    "--brand-dim": `color-mix(in srgb, ${fillPrimary} ${brandDimMix}%, transparent)`,
    "--brand-glow": `color-mix(in srgb, ${fillAccent} ${brandGlowMix}%, transparent)`,
    "--border-brand": `color-mix(in srgb, ${primary} ${borderBrandMix}%, ${border} ${100 - borderBrandMix}%)`,
    // Semantic "ok/active" palette. These are consumed by the emerald/green →
    // var() remap in starwind.css (badges like "Activa", success notices, the
    // floating-button resting tint, the admin-group banner). starwind.css ships
    // a HARDCODED purple default for them, so unless we regenerate them here the
    // theme picker leaves them stuck purple. Derive from the brand primary so
    // they follow the chosen theme in both light/dark (primary is already
    // contrast-correct per mode).
    "--ok-fg": primary,
    "--ok-bg": `color-mix(in srgb, ${fillPrimary} ${okBgPrimaryMix}%, ${card} ${100 - okBgPrimaryMix}%)`,
    "--ok-border": `color-mix(in srgb, ${primary} ${okBorderPrimaryMix}%, ${border} ${100 - okBorderPrimaryMix}%)`,
    "--badge-active-fg": primary,
    "--badge-active-bg": `color-mix(in srgb, ${fillPrimary} ${badgeActiveBgPrimaryMix}%, ${card} ${100 - badgeActiveBgPrimaryMix}%)`,
    "--ink": background,
    "--ink-1": card,
    "--ink-2": muted,
    "--ink-3": accent,
    "--bg": background,
    "--bg2": card,
    "--card-hover": `color-mix(in srgb, ${card} ${100 - cardHoverPrimaryMix}%, ${fillPrimary} ${cardHoverPrimaryMix}%)`,
    "--heading": foreground,
    "--text": foreground,
    "--text-muted": `color-mix(in srgb, ${foreground} 64%, ${background} 36%)`,
    "--text-sub": `color-mix(in srgb, ${foreground} 74%, ${background} 26%)`,
    "--nav-bg": `color-mix(in srgb, ${card} 92%, transparent)`,
    "--primary-fg": primaryForeground,
    "--primary-hover": `color-mix(in srgb, ${primary} 82%, black 18%)`,
    "--sidebar-background": card,
    "--sidebar-foreground": foreground,
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": primaryForeground,
    "--sidebar-accent": accent,
    "--sidebar-accent-foreground": foreground,
    "--sidebar-border": border,
    "--sidebar-outline": mode === "dark" ? primary : primaryAccent,
    "--sidebar-ring": mode === "dark" ? primary : primaryAccent,
  };
}

export function buildLayoutCss(settings: LayoutSettingsMap): string {
  const lightVars = getLayoutThemeVars(settings, "light");
  const darkVars = getLayoutThemeVars(settings, "dark");
  // Validate by TYPE: radius is a length, the shadows are box-shadow values,
  // the modal backdrop is a color. Each falls back to its hardcoded default
  // when the admin-supplied value is malformed or hostile.
  const radius = sanitizeLength(
    pickLayoutSetting(settings, "layout_radius"),
    DEFAULT_LAYOUT_SETTINGS.layout_radius,
  );
  const shadow = sanitizeShadow(
    pickLayoutSetting(settings, "layout_shadow"),
    DEFAULT_LAYOUT_SETTINGS.layout_shadow,
  );
  const modalShadow = sanitizeShadow(
    pickLayoutSetting(settings, "layout_modal_shadow"),
    DEFAULT_LAYOUT_SETTINGS.layout_modal_shadow,
  );
  const modalBackdrop = sanitizeColor(
    pickLayoutSetting(settings, "layout_modal_backdrop"),
    DEFAULT_LAYOUT_SETTINGS.layout_modal_backdrop,
  );

  // Defense in depth: every theme-var value was already sanitized at its source
  // in getLayoutThemeVars (colors / color-mix), but re-screen each one here so
  // no value can ever reach the inline <style> with CSS-dangerous characters.
  // A value that somehow slips through is dropped to a safe `initial`.
  const serializeVars = (vars: Record<string, string>) =>
    Object.entries(vars)
      .map(([key, value]) => {
        const safe = rejectDangerousCss(value) === null ? "initial" : value;
        return `  ${key}: ${safe};`;
      })
      .join("\n");

  return `
:root {
${serializeVars(lightVars)}
  --radius: ${radius};
  --shadow: ${shadow};
  --shadow-lg: ${modalShadow};
  --modal-shadow: ${modalShadow};
  --modal-backdrop: ${modalBackdrop};
}

.dark {
${serializeVars(darkVars)}
  --radius: ${radius};
  --shadow: ${shadow};
  --shadow-lg: ${modalShadow};
  --modal-shadow: ${modalShadow};
  --modal-backdrop: ${modalBackdrop};
}
`;
}

export function buildLogoMap(settings: LayoutSettingsMap): Record<string, string> {
  // One logo applies to every visual surface, including the browser favicon.
  // `layout_favicon` is read as a legacy alias and only used when the admin
  // hasn't set `layout_logo` yet.
  const logo = pickLayoutSetting(settings, "layout_logo");
  const favicon = logo || pickLayoutSetting(settings, "layout_favicon");
  return {
    primary: logo,
    sidebar: logo,
    login: logo,
    footer: logo,
    favicon,
  };
}
