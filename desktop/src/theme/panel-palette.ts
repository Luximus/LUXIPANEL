import { getPanelBranding } from "../api/client";

/**
 * Paleta de marca POR SERVIDOR/PANEL — paridad con web (`frontend/src/lib/
 * panel-palette.ts`) y el app móvil (`app/src/theme/panel-palette.ts`): cuando el
 * carrusel de servidores cambia de slide, se carga el branding del panel activo
 * (mapa `layout` con claves `layout_{light,dark}_<color>` que persiste LUXIPANEL
 * en su apariencia) y se recolorean los tokens de marca del UI mientras se está
 * sobre ese servidor. Al cambiar de servidor, cambia la paleta; al salir de la
 * pantalla se limpia.
 *
 * En el desktop sólo sobreescribimos la familia de marca (`--lp-brand` y
 * derivados): es lo que tiñe botones, tabs activos, hovers, acentos y bordes de
 * marca, sin tocar las superficies (card/fondo/borde neutro) que ya están
 * afinadas por tema. El tema se controla por el atributo `data-theme` de `<html>`
 * (no por clase `.dark`, como en web), así que la reactividad lo observa.
 */

/** Variables de marca derivadas del primary/accent del panel (un lado de tema). */
export type BrandVars = {
  brand: string;
  brandLight: string;
  brandDim: string;
  brandGlow: string;
  borderBrand: string;
};
export type PanelPalette = { light: BrandVars; dark: BrandVars } | null;

/** Mapeo var lógica → custom property CSS del proyecto (index.css). */
const VAR_KEYS: Array<[keyof BrandVars, string]> = [
  ["brand", "--lp-brand"],
  ["brandLight", "--lp-brand-light"],
  ["brandDim", "--lp-brand-dim"],
  ["brandGlow", "--lp-brand-glow"],
  ["borderBrand", "--lp-border-brand"],
];

function hexToRgba(hex: string, alpha: number): string | null {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Construye las variables de marca de un lado (light|dark) desde el layout. */
function sideVars(layout: Record<string, string>, mode: "light" | "dark"): BrandVars | null {
  const read = (key: string): string | undefined => {
    const v = layout[`layout_${mode}_${key}`];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const primary = read("primary");
  if (!primary) return null;
  const accent = read("primary_accent") ?? primary;
  return {
    brand: primary,
    brandLight: accent,
    brandDim: hexToRgba(primary, 0.12) ?? primary,
    brandGlow: hexToRgba(accent, 0.2) ?? accent,
    borderBrand: hexToRgba(primary, 0.35) ?? primary,
  };
}

// ── Carga + caché por panelId ────────────────────────────────────────────────
const cache = new Map<string, PanelPalette>();

/** Devuelve la paleta del panel (de caché o pidiendo el branding). `null` si el
 *  panel no personalizó colores o falla la petición. Las llamadas del desktop son
 *  por token (Bearer), no por cookie como en web. */
export async function loadPanelPalette(panelId: string, token: string): Promise<PanelPalette> {
  const cached = cache.get(panelId);
  if (cached !== undefined) return cached;
  try {
    const branding = await getPanelBranding(panelId, token);
    const layout = branding?.layout ?? {};
    const hasColors = Object.keys(layout).some(
      (k) => k.startsWith("layout_light_") || k.startsWith("layout_dark_"),
    );
    const light = hasColors ? sideVars(layout, "light") : null;
    const dark = hasColors ? sideVars(layout, "dark") : null;
    // Si sólo personalizó un lado, el otro lo reutiliza (mejor que volver al base).
    const palette: PanelPalette = light || dark ? { light: (light ?? dark)!, dark: (dark ?? light)! } : null;
    cache.set(panelId, palette);
    return palette;
  } catch {
    return null; // no cachear el fallo: reintentar en el próximo foco
  }
}

// ── Aplicación al DOM (con reactividad a light/dark) ──────────────────────────
let current: PanelPalette = null;
let themeObserver: MutationObserver | null = null;

function isDark(): boolean {
  return typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";
}

function ensureThemeObserver(): void {
  if (themeObserver || typeof MutationObserver === "undefined") return;
  themeObserver = new MutationObserver(() => {
    if (current) applyServerPalette(current);
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

/** Aplica (o limpia, si `null`) las variables de marca del panel activo sobre
 *  `<html>`, eligiendo el lado según el tema actual. */
export function applyServerPalette(palette: PanelPalette): void {
  if (typeof document === "undefined") return;
  current = palette;
  const root = document.documentElement;
  if (!palette) {
    for (const [, cssVar] of VAR_KEYS) root.style.removeProperty(cssVar);
    return;
  }
  ensureThemeObserver();
  const vars = isDark() ? palette.dark : palette.light;
  for (const [k, cssVar] of VAR_KEYS) root.style.setProperty(cssVar, vars[k]);
}

/** Limpia el override (vuelve a la paleta base del tema). */
export function clearServerPalette(): void {
  applyServerPalette(null);
}
