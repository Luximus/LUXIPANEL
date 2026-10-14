// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Predefined color palettes ("layouts") for the panel.
 *
 * Each palette defines a complete LIGHT and DARK color scheme. Selecting a
 * palette in Settings → Layout writes every `layout_{light,dark}_*` setting and
 * re-themes the whole site (the same keys consumed by `buildLayoutCss` in
 * `layout-branding.ts`). This is the single source of truth shared by the SSR
 * settings page and its client script (serialized as JSON into the page).
 */

// Order matters: matches the grouping used across the layout panel.
export const LAYOUT_COLOR_KEYS = [
  "background", "foreground", "card", "muted", "accent", "border",
  "primary", "primary_foreground", "primary_accent",
  "secondary", "secondary_foreground",
  "info", "info_foreground",
  "success", "success_foreground",
  "warning", "warning_foreground",
  "error", "error_foreground",
] as const;

export type LayoutColorKey = (typeof LAYOUT_COLOR_KEYS)[number];
export type ColorMap = Record<LayoutColorKey, string>;

export interface LayoutPalette {
  /** Stable id persisted nowhere directly — derived by matching color values. */
  id: string;
  /** Display name (proper noun, intentionally not translated). */
  name: string;
  /** One-line description shown under the name. */
  description: string;
  light: ColorMap;
  dark: ColorMap;
  /**
   * Tornasol / iridescent mode: the saved `light` / `dark` color maps are the
   * "rest" / fallback palette (mirrored to settings for backwards-compat), but
   * the runtime overrides `--primary`, `--primary-accent` and friends with a
   * CSS `@keyframes` animation that cycles through rainbow hues in a loop.
   * The intensity slider drives animation duration (slow ↔ fast).
   */
  cyclic?: boolean;
  /** User-picked brand color that regenerates this palette on the fly. */
  customizable?: boolean;
}

// Status colors are shared across palettes so feedback stays consistent.
const LIGHT_SEMANTIC = {
  info: "#7dd3fc", info_foreground: "#082f49",
  success: "#86efac", success_foreground: "#052e16",
  warning: "#fcd34d", warning_foreground: "#451a03",
  error: "#ef4444", error_foreground: "#f8fafc",
};
const DARK_SEMANTIC = { ...LIGHT_SEMANTIC, error_foreground: "#fafafa" };

/** Build a full color map from brand + base-tint overrides on a neutral base. */
function light(over: Partial<ColorMap>): ColorMap {
  return {
    background: "#f8fafc", foreground: "#0f172a", card: "#ffffff",
    muted: "#f1f5f9", accent: "#e2e8f0", border: "#dbe3ef",
    primary: "#7c3aed", primary_foreground: "#ffffff", primary_accent: "#a78bfa",
    secondary: "#f1f5f9", secondary_foreground: "#0f172a",
    ...LIGHT_SEMANTIC,
    ...over,
  };
}
function dark(over: Partial<ColorMap>): ColorMap {
  return {
    background: "#0f0f0f", foreground: "#f8fafc", card: "#1a1a1a",
    muted: "#242424", accent: "#2e2e2e", border: "#2a2a2a",
    primary: "#c084fc", primary_foreground: "#ffffff", primary_accent: "#d8b4fe",
    secondary: "#292929", secondary_foreground: "#fafafa",
    ...DARK_SEMANTIC,
    ...over,
  };
}

export const DEFAULT_CUSTOM_LAYOUT_COLOR = "#7c3aed";

// Matches the Luxisoft product console in /var/www/luxisoft/frontend/src/App.css
// and its brand tokens in src/index.css. Keep this map as the source for both
// the server fallback and the appearance settings reset.
export const LUXISOFT_LAYOUT_PALETTE: LayoutPalette = {
  id: "luxisoft",
  name: "Luxisoft",
  description: "Navy and mint in light mode; graphite and mint in dark mode.",
  light: light({
    background: "#f8fafc",
    foreground: "#171d2c",
    card: "#ffffff",
    muted: "#f1f5f9",
    accent: "#e6f9f6",
    border: "#e1e7ef",
    primary: "#151c2c",
    primary_foreground: "#ffffff",
    primary_accent: "#24e1c5",
    secondary: "#f1f5f9",
    secondary_foreground: "#171d2c",
  }),
  dark: dark({
    background: "#181b20",
    foreground: "#f4f7f5",
    card: "#22272e",
    muted: "#2a3037",
    accent: "#233830",
    border: "#363d45",
    primary: "#63e6ae",
    primary_foreground: "#151c2c",
    primary_accent: "#68da60",
    secondary: "#2a3037",
    secondary_foreground: "#f4f7f5",
  }),
};

export const DEFAULT_LAYOUT_PALETTE_ID = LUXISOFT_LAYOUT_PALETTE.id;

function normalizeHexColor(input: string, fallback = DEFAULT_CUSTOM_LAYOUT_COLOR): string {
  const value = String(input ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const safe = normalizeHexColor(hex);
  const n = parseInt(safe.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const h = (v: number) => clamp(v).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function mixHex(a: string, b: string, weight = 0.5): string {
  const wa = Math.max(0, Math.min(1, weight));
  const wb = 1 - wa;
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  return rgbToHex(
    left.r * wa + right.r * wb,
    left.g * wa + right.g * wb,
    left.b * wa + right.b * wb,
  );
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rf) h = (gf - bf) / d + (gf < bf ? 6 : 0);
    else if (max === gf) h = (bf - rf) / d + 2;
    else h = (rf - gf) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sf = Math.max(0, Math.min(100, s)) / 100;
  const lf = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sf * Math.min(lf, 1 - lf);
  const f = (n: number) => lf - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

function shiftLightness(hex: string, delta: number): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, s, l + delta);
}

function saturate(hex: string, delta: number): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, s + delta, l);
}

export function buildCustomLayoutPalette(color: string): LayoutPalette {
  const primary = normalizeHexColor(color);
  const lightAccent = shiftLightness(saturate(primary, 8), 18);
  const darkPrimary = shiftLightness(saturate(primary, 6), 10);
  const darkAccent = shiftLightness(saturate(primary, 10), 24);
  return {
    id: "custom",
    name: "Personalizado", // intentional brand label (see layout-palettes comment).
    description: "Elige tu color base y ajusta su intensidad.",
    light: light({
      primary,
      primary_accent: mixHex("#ffffff", lightAccent, 0.28),
      accent: mixHex("#e2e8f0", primary, 0.9),
      border: mixHex("#dbe3ef", primary, 0.86),
      secondary: mixHex("#f1f5f9", primary, 0.95),
      background: mixHex("#f8fafc", primary, 0.98),
      muted: mixHex("#f1f5f9", primary, 0.96),
    }),
    dark: dark({
      primary: darkPrimary,
      primary_accent: darkAccent,
      accent: shiftLightness(primary, -8),
      border: shiftLightness(primary, -12),
      secondary: shiftLightness(primary, -16),
      background: shiftLightness(primary, -24),
      card: shiftLightness(primary, -21),
      muted: shiftLightness(primary, -18),
    }),
    customizable: true,
  };
}

export const LAYOUT_PALETTES: LayoutPalette[] = [
  LUXISOFT_LAYOUT_PALETTE,
  {
    // id/name/description los aporta ya `buildCustomLayoutPalette` con los mismos
    // valores; repetirlos ANTES del spread era redundante (el spread los pisaba).
    ...buildCustomLayoutPalette(DEFAULT_CUSTOM_LAYOUT_COLOR),
  },
  {
    id: "prisma",
    name: "Prisma", // intentional brand label.
    description: "Mezcla los colores de todas las paletas en una transición continua e infinita.",
    // Static "rest" colors mirror the default violet palette so persisted
    // settings remain valid; the client overrides the brand slots with a
    // CSS keyframe animation (see branding-runtime + settings index-script).
    light: light({}),
    dark: dark({}),
    cyclic: true,
  },
];

/** Flatten a palette into the `layout_{light,dark}_<key>` settings shape. */
export function paletteToSettings(p: LayoutPalette): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of LAYOUT_COLOR_KEYS) {
    out[`layout_light_${k}`] = p.light[k];
    out[`layout_dark_${k}`] = p.dark[k];
  }
  return out;
}
