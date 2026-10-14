import {
  LIVE_LOGOS_KEY,
  LIVE_CSS_KEY,
  LIVE_CSS_VERSION,
  TORNASOL_FLAG_KEY,
  TORNASOL_INTENSITY_KEY,
  TORNASOL_COLOR_KEY,
  TORNASOL_COLORS_KEY,
  syncBrandingScope,
} from "/scripts/extracted/lib/branding-storage-keys.js?v=20260930serverbranding";
import { applyBrandedAsset } from "/scripts/extracted/lib/branding-images.js";

type LogoMap = {
  __scope?: string;
  primary?: string;
  sidebar?: string;
  login?: string;
  footer?: string;
  favicon?: string;
};

declare global {
  interface Window {
    __lxpBrandingInit?: boolean;
  }
}

const LOGO_MAP_ID = "lxp-layout-logo-map";
const LOGO_SELECTOR = "img[data-lxp-logo-role], img[id*='logo'], img[src^='/logo']";
// LIVE_LOGOS_KEY: override vivo escrito por la página de Ajustes al cambiar
// logos/favicon (reapplyLiveLogos). Igual que el live-theme CSS: el mapa SSR
// queda cache-stale justo después de guardar, así que el último valor que el
// admin fijó en esta pestaña gana sobre el embebido. (Clave en el SSOT
// branding-storage-keys.)

// Shared with the settings page (see injectLivePaletteCss). The theme is
// server-rendered as a per-page inline <style>, but that value is cache-stale
// for a moment right after the admin changes it, and the settings page's live
// override <style> is discarded when Astro swaps the <head> on SPA navigation.
// We persist the chosen theme CSS here and re-inject it as the LAST <style> in
// <head> (so it wins over the SSR block) on initial load AND after every swap —
// so a theme change applies instantly across SPA navigation, no reload needed.
const LIVE_STYLE_ID = "lxp-layout-live";
// LIVE_CSS_KEY + LIVE_CSS_VERSION live in the SSOT branding-storage-keys module
// (shared with the settings page, which stamps the same version onto the cached
// CSS so branding-runtime can drop stale entries from previous builds).

function applyPersistedTheme(): void {
  try {
    const map = JSON.parse(document.getElementById(LOGO_MAP_ID)?.textContent ?? "{}");
    const scope = typeof map.__scope === "string" ? map.__scope : "local";
    const previous = sessionStorage.getItem("lxp-layout-live-scope");
    syncBrandingScope(sessionStorage, scope);
    if (previous !== scope) {
      document.getElementById(LIVE_STYLE_ID)?.remove();
      document.getElementById("lxp-layout-tornasol")?.remove();
    }
  } catch { /* blocked storage or malformed SSR payload */ }
  let raw = "";
  try {
    raw = sessionStorage.getItem(LIVE_CSS_KEY) ?? "";
  } catch {
    return; // sessionStorage unavailable (private mode / blocked) — skip.
  }
  if (!raw) return;

  // Newer payloads are JSON `{ v, css }`. Legacy strings (from older builds)
  // are always discarded because they may carry strongly-tinted values that
  // the current generator no longer emits — keep the new palette intact.
  let css = "";
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.css === "string") {
      if (parsed.v !== LIVE_CSS_VERSION) {
        try { sessionStorage.removeItem(LIVE_CSS_KEY); } catch { /* ignore */ }
        return;
      }
      css = parsed.css;
    } else {
      try { sessionStorage.removeItem(LIVE_CSS_KEY); } catch { /* ignore */ }
      return;
    }
  } catch {
    try { sessionStorage.removeItem(LIVE_CSS_KEY); } catch { /* ignore */ }
    return;
  }
  if (!css) return;

  let style = document.getElementById(LIVE_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = LIVE_STYLE_ID;
  }
  if (style.textContent !== css) style.textContent = css;
  // Re-append so it stays the last <style>, overriding the per-page SSR theme.
  document.head.appendChild(style);
  // Tornasol animation must be re-installed AFTER the persisted theme so its
  // animation rule stays the last (winning) declaration in <head>.
  if (isTornasolActive()) {
    installTornasolAnimation(getTornasolIntensity(), getTornasolColors());
  }
}

function readLogoMap(): LogoMap {
  let embedded: LogoMap = {};
  const payload = document.getElementById(LOGO_MAP_ID)?.textContent;
  if (payload) {
    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === "object") embedded = parsed;
    } catch {
      /* embebido corrupto — seguimos con el override */
    }
  }

  let live: LogoMap = {};
  try {
    const raw = sessionStorage.getItem(LIVE_LOGOS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && parsed.__scope === embedded.__scope) live = parsed;
  } catch {
    /* sessionStorage no disponible / corrupto — usamos solo el embebido */
  }

  // Solo las entradas con valor del override pisan al embebido (un rol vacío
  // en Ajustes no debe borrar el logo que el SSR sí conoce).
  const merged: LogoMap = { ...embedded };
  for (const [key, value] of Object.entries(live)) {
    if (typeof value === "string" && value.trim()) (merged as Record<string, string>)[key] = value;
  }
  return merged;
}

function applyLogo(target: Element, url?: string, scope?: string): void {
  if (!(target instanceof HTMLImageElement) || !url) return;
  void applyBrandedAsset(target, url, scope);
}

function logoForRole(role: string | null, logoMap: LogoMap): string | undefined {
  if (role === "sidebar") return logoMap.sidebar || logoMap.primary;
  if (role === "login") return logoMap.login || logoMap.primary;
  if (role === "footer") return logoMap.footer || logoMap.primary;
  return logoMap.primary;
}

function applyBranding(): void {
  const logoMap = readLogoMap();

  for (const target of document.querySelectorAll(LOGO_SELECTOR)) {
    applyLogo(target, logoForRole(target.getAttribute("data-lxp-logo-role"), logoMap), logoMap.__scope);
  }

  const iconHref = logoMap.favicon || logoMap.primary;
  if (!iconHref) return;
  // Sync every browser-icon link to the same DB-backed logo so the tab,
  // shortcut, and Apple home-screen icons all show the customer's brand.
  const selectors = [
    "link[rel='icon']",
    "link[rel='shortcut icon']",
    "link[rel='apple-touch-icon']",
  ];
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((el) => { void applyBrandedAsset(el, iconHref, logoMap.__scope); });
  }
}

if (!window.__lxpBrandingInit) {
  window.__lxpBrandingInit = true;
  // Theme first (before paint on swap) so there's no flash of the SSR theme.
  applyPersistedTheme();
  applyBranding();
  document.addEventListener("astro:after-swap", applyPersistedTheme);
  document.addEventListener("astro:page-load", applyBranding);
  document.addEventListener("astro:after-swap", applyBranding);
} else {
  applyPersistedTheme();
  applyBranding();
}

// Lazy-import the Tornasol module only when a persisted state asks for it,
// so non-tornasol sessions don't pay the parse cost on every page load.
// isTornasolActive() / installTornasolAnimation() are referenced from the
// closures above; we resolve them at first use.
async function maybeImportTornasol() {
  if ((window as any).__lxpTornasolModule) return (window as any).__lxpTornasolModule;
  try {
    // Forma ABSOLUTA (como el resto de scripts extraídos): resuelve igual en
    // runtime y además está declarada en `types/extracted-scripts.d.ts`, así que
    // el módulo llega TIPADO en vez de degradar a `any`.
    const mod = await import("/scripts/extracted/layouts/tornasol-animation.js?v=20260628a");
    (window as any).__lxpTornasolModule = mod;
    return mod;
  } catch {
    return null;
  }
}
function isTornasolActive(): boolean {
  try { return sessionStorage.getItem(TORNASOL_FLAG_KEY) === "1"; } catch { return false; }
}
function installTornasolAnimation(intensity: number, colors?: string[] | string) {
  void maybeImportTornasol().then((mod) => {
    if (mod) mod.installTornasolAnimation(intensity, colors);
  });
}
function getTornasolIntensity(): number {
  try {
    const raw = sessionStorage.getItem(TORNASOL_INTENSITY_KEY);
    if (raw === null) return 50;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? 50 : Math.max(0, Math.min(100, n));
  } catch { return 50; }
}
function normalizeHexColor(input: string): string | null {
  const value = String(input ?? "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}
function getTornasolColors(): string[] {
  try {
    const raw = sessionStorage.getItem(TORNASOL_COLORS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const colors = parsed.map((entry) => normalizeHexColor(String(entry))).filter((value): value is string => Boolean(value));
        if (colors.length > 0) return colors;
      }
    }
  } catch {
    /* fallback legacy */
  }
  try {
    const raw = sessionStorage.getItem(TORNASOL_COLOR_KEY);
    const single = normalizeHexColor(String(raw ?? ""));
    // "#7c3aed" fallback MUST match layout-palettes.ts DEFAULT_CUSTOM_LAYOUT_COLOR
    // (bundle:false extracted module; keep the literal in lockstep).
    return [single || "#7c3aed"];
  } catch { return ["#7c3aed"]; }
}

export {};
