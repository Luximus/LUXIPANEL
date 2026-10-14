export type ThemeTokens = {
  bgPrimary: string;
  bgCard: string;
  bgCardSolid: string;
  bgSecondary: string;
  bgInput: string;
  bgOverlay: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  borderBrand: string;
  brand: string;
  brandLight: string;
  brandDim: string;
  brandGlow: string;
  /** Fondo de acciones sólidas. En oscuro replica la barra de acciones web. */
  actionPrimary: string;
  accent: string;
  accentText: string;
  danger: string;
  warning: string;
  success: string;
  inkOne: string;
  inkTwo: string;
  splashGradient: readonly [string, string, string];
  loginGradient: readonly [string, string, string];
  pageGradient: readonly [string, string];
};

export const darkTokens: ThemeTokens = {
  bgPrimary: "#181b20",
  bgCard: "rgba(34, 39, 46, 0.94)",
  bgCardSolid: "#22272e",
  bgSecondary: "#22272e",
  bgInput: "#22272e",
  bgOverlay: "rgba(0, 0, 0, 0.65)",
  textPrimary: "#f5f7f8",
  textSecondary: "#d8e1e7",
  textMuted: "#a0a0a0",
  border: "rgba(82, 82, 91, 0.55)",
  borderStrong: "rgba(82, 82, 91, 0.85)",
  borderBrand: "rgba(99, 230, 174, 0.35)",
  brand: "#63e6ae",
  brandLight: "#68da60",
  brandDim: "rgba(99, 230, 174, 0.12)",
  brandGlow: "rgba(104, 218, 96, 0.20)",
  actionPrimary: "#176b52",
  accent: "#63e6ae",
  accentText: "#151c2c",
  danger: "#fb7185",
  warning: "#fbbf24",
  success: "#34d399",
  inkOne: "#181b20",
  inkTwo: "#22272e",
  splashGradient: ["#151c2c", "#1f2937", "#181b20"] as const,
  loginGradient: ["#020617", "#151c2c", "#1e293b"] as const,
  pageGradient: ["#181b20", "#22272e"] as const,
};

export const lightTokens: ThemeTokens = {
  bgPrimary: "#f8fafc",
  bgCard: "rgba(255, 255, 255, 0.92)",
  bgCardSolid: "#ffffff",
  bgSecondary: "#f3f3f3",
  bgInput: "#ffffff",
  bgOverlay: "rgba(15, 23, 42, 0.55)",
  textPrimary: "#151c2c",
  textSecondary: "#394454",
  textMuted: "#64748b",
  border: "rgba(15, 23, 42, 0.08)",
  borderStrong: "rgba(15, 23, 42, 0.14)",
  borderBrand: "rgba(36, 225, 197, 0.32)",
  brand: "#151c2c",
  brandLight: "#24e1c5",
  brandDim: "rgba(36, 225, 197, 0.10)",
  brandGlow: "rgba(36, 225, 197, 0.18)",
  actionPrimary: "#151c2c",
  accent: "#151c2c",
  accentText: "#ffffff",
  danger: "#e11d48",
  warning: "#f59e0b",
  success: "#16a34a",
  inkOne: "#ffffff",
  inkTwo: "#f8fafc",
  splashGradient: ["#e0f2fe", "#c7d2fe", "#a5b4fc"] as const,
  loginGradient: ["#f8fafc", "#e2e8f0", "#cbd5e1"] as const,
  pageGradient: ["#f8fafc", "#eaf4f3"] as const,
};

import { getActivePalette, type PanelPalette } from "./panel-palette";

// Memo de 1 entrada: la paleta cambia rara vez (al cambiar de panel), así no
// reconstruimos el objeto de tokens en cada render de cada componente.
let memoDark: boolean | null = null;
let memoPalette: PanelPalette | null = null;
let memoResult: ThemeTokens | null = null;

/**
 * Tokens del tema. Si hay una PALETA de panel activa (copiada del tema de LUXIPANEL
 * del panel/servidor en uso), se mezcla sobre los tokens base; si no, base puros.
 */
export function getThemeTokens(isDark: boolean): ThemeTokens {
  const palette = getActivePalette();
  const base = isDark ? darkTokens : lightTokens;
  if (!palette) return base;
  if (memoResult && memoDark === isDark && memoPalette === palette) return memoResult;
  const side = isDark ? palette.dark : palette.light;
  const result = side && Object.keys(side).length > 0 ? { ...base, ...side } : base;
  memoDark = isDark;
  memoPalette = palette;
  memoResult = result;
  return result;
}

/**
 * Aplica `alpha` (0–1) a un color de token. Acepta hex (`#rgb`/`#rrggbb`) y
 * `rgb()/rgba()`; si no puede parsear, devuelve el color tal cual. Útil para
 * derivar tintes/bordes de un token semántico (p. ej. `success`) y que sigan a
 * la paleta del panel activo en vez de codificar el verde a mano.
 */
export function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    if (h.length !== 6) return color;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return color;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
  return color;
}

/** [r,g,b] de un color hex/rgb(a), o `null` si no se puede parsear. */
function parseRgb(color: string): [number, number, number] | null {
  const c = color.trim();
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    if (h.length !== 6) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : [r, g, b];
  }
  const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * Color de texto/icono legible sobre un fondo sólido `bg`: oscuro si el fondo es
 * claro, blanco si es oscuro (luminancia perceptual). Así un badge relleno con un
 * token semántico (p. ej. `success`) mantiene buen contraste en CUALQUIER paleta
 * de panel, sin codificar el color del texto a mano. */
export function readableTextOn(bg: string, dark = "#06210f", light = "#ffffff"): string {
  const rgb = parseRgb(bg);
  if (!rgb) return light;
  const [r, g, b] = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? dark : light;
}
