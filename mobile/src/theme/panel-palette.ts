import type { ThemeTokens } from "./colors";
import { getPanelBrandingRaw } from "../api/client";
import { registerStoreReset } from "../lib/store-reset";

/**
 * Paleta de colores POR PANEL: copia el tema de "ajustes → apariencia" de LUXIPANEL
 * (que se persiste en el branding de LP, mapa `layout` con claves
 * `layout_{light,dark}_<color>`) y la aplica al UI nativo del app mientras se está
 * sobre ese panel/servidor. Al cambiar de panel, cambia la paleta.
 *
 * - `getActivePalette()` lo lee `getThemeTokens` (en colors.ts) para mezclar sobre
 *   los tokens base.
 * - `setActivePalette()` notifica a los suscriptores (useTheme se re-renderiza).
 * - `loadPanelPalette()` busca en caché o pide el branding y construye la paleta.
 */
export type PanelPalette = { light: Partial<ThemeTokens>; dark: Partial<ThemeTokens> };

let activePalette: PanelPalette | null = null;
const listeners = new Set<() => void>();

export function getActivePalette(): PanelPalette | null {
  return activePalette;
}

export function setActivePalette(next: PanelPalette | null): void {
  if (next === activePalette) return;
  // Si ambos son "vacíos" (sin override), no notificar.
  const wasEmpty = isEmptyPalette(activePalette);
  const willEmpty = isEmptyPalette(next);
  activePalette = next;
  if (wasEmpty && willEmpty) return;
  listeners.forEach((l) => l());
}

export function subscribeActivePalette(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function isEmptyPalette(p: PanelPalette | null): boolean {
  if (!p) return true;
  return Object.keys(p.light).length === 0 && Object.keys(p.dark).length === 0;
}

// ── Carga + caché por panelId ────────────────────────────────────────────────
// Cachea el RESULTADO RESUELTO (incl. `null` = panel sin paleta) para distinguir
// "no cargado" (undefined) de "resuelto sin paleta" (null) → el carousel sabe si
// ya tiene el color o sigue cargando.
const cache = new Map<string, PanelPalette | null>();

/** Paleta cacheada: `undefined` = aún no cargada; `null` = resuelta sin paleta. */
export function getCachedPalette(panelId: string): PanelPalette | null | undefined {
  return cache.get(panelId);
}

/** Devuelve la paleta del panel (de caché o pidiendo el branding). `null` si no
 *  hay colores personalizados o falla la petición. */
export async function loadPanelPalette(panelId: string, token: string): Promise<PanelPalette | null> {
  const cached = cache.get(panelId);
  if (cached !== undefined) return cached;
  try {
    const branding = await getPanelBrandingRaw(panelId, token);
    const layout = branding?.layout ?? {};
    // Solo aplicamos paleta si el panel PERSONALIZÓ algún color (claves
    // `layout_{light,dark}_*`). Si no, tema base del app (sin forzar nada). Nota: la
    // cara dark usa contenedores constantes, así que `isEmptyPalette` no sirve aquí.
    const hasColors = Object.keys(layout).some((k) => k.startsWith("layout_light_") || k.startsWith("layout_dark_"));
    const palette: PanelPalette | null = hasColors
      ? { light: sideTokens(layout, "light"), dark: sideTokens(layout, "dark") }
      : null;
    const resolved = palette && !isEmptyPalette(palette) ? palette : null;
    cache.set(panelId, resolved);
    return resolved;
  } catch {
    return null; // no cachear el fallo: reintentar en el próximo foco
  }
}

// Logout / cambio de cuenta: la paleta activa y el caché de branding son de los
// paneles del usuario saliente → tema base y caché vacío.
registerStoreReset(() => {
  cache.clear();
  setActivePalette(null);
});

// ── Mapeo branding (layout_<mode>_<color>) → ThemeTokens ──────────────────────
// Réplica EXACTA de cómo LUXIPANEL deriva los colores (lib/layout-branding.ts
// `getLayoutThemeVars`): los CONTENEDORES (background/card/muted/border) en modo
// DARK usan SIEMPRE el neutro por defecto de LUXIPANEL (ignoran el color del panel,
// para que las tarjetas no se tiñan); en LIGHT siguen al panel. La MARCA, el texto
// principal y los semánticos siguen al panel en AMBOS modos. Los tintes
// (brand-dim/glow) usan el primary "de relleno": default violeta en dark, primary
// del panel en light.
const DARK_CONTAINER: Record<string, string> = {
  background: "#181b20",
  card: "#22272e",
  muted: "#2a3037",
  border: "#363d45",
};
const DARK_FILL_PRIMARY = "#63e6ae";
const DARK_FILL_ACCENT = "#68da60";

function sideTokens(layout: Record<string, string>, mode: "light" | "dark"): Partial<ThemeTokens> {
  // Valor del panel para `layout_<mode>_<key>` (o undefined si no lo personalizó).
  const panel = (key: string): string | undefined => {
    const v = layout[`layout_${mode}_${key}`];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  // Contenedores: en dark → neutro por defecto de LUXIPANEL; en light → del panel.
  const container = (key: string): string | undefined => (mode === "dark" ? DARK_CONTAINER[key] : panel(key));

  const out: Partial<ThemeTokens> = {};
  const background = container("background");
  const card = container("card");
  const muted = container("muted");
  const border = container("border");
  const foreground = panel("foreground");
  const primary = panel("primary");
  const primaryAccent = panel("primary_accent");
  const primaryFg = panel("primary_foreground");
  const error = panel("error");
  const warning = panel("warning");
  const success = panel("success");

  // Contenedores (en dark son constantes; en light, del panel si los personalizó).
  if (background) out.bgPrimary = background;
  if (card) { out.bgCardSolid = card; out.bgCard = card; }
  if (muted) { out.bgSecondary = muted; out.bgInput = muted; }
  if (border) { out.border = border; out.borderStrong = border; }
  // Texto principal + marca + semánticos: del panel (por modo).
  if (foreground) out.textPrimary = foreground;
  if (primary) {
    out.brand = primary;
    out.accent = primary;
    out.borderBrand = hexToRgba(primary, 0.35);
    // La acción sólida de la cabecera web usa la marca del panel sólo en claro.
    // En oscuro conserva el verde profundo de LUXIPANEL.
    if (mode === "light") out.actionPrimary = primary;
  }
  // Tintes de marca: primary de relleno (dark=violeta default, light=panel).
  const fillPrimary = mode === "dark" ? DARK_FILL_PRIMARY : primary;
  const fillAccent = mode === "dark" ? DARK_FILL_ACCENT : primaryAccent;
  if (fillPrimary) out.brandDim = hexToRgba(fillPrimary, 0.12);
  if (fillAccent ?? fillPrimary) out.brandGlow = hexToRgba((fillAccent ?? fillPrimary) as string, 0.20);
  if (primaryAccent) out.brandLight = primaryAccent;
  if (primaryFg) out.accentText = primaryFg;
  if (error) out.danger = error;
  if (warning) out.warning = warning;
  if (success) out.success = success;
  return out;
}

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return hex; // no es hex → no se puede aplicar alpha
  const r = parseInt(h.slice(0, 2), 16);
  const gn = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(gn) || Number.isNaN(b)) return hex;
  return `rgba(${r}, ${gn}, ${b}, ${alpha})`;
}

/** Direct clients read branding from their selected LUXIPANEL, without the LP account API. */
export function paletteFromLayout(layout: Record<string,string>): PanelPalette { return {light:sideTokens(layout,"light"),dark:sideTokens(layout,"dark")}; }
