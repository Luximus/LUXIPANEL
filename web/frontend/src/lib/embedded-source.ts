// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Detect whether a request is coming from an embedded wrapper that
 * already renders its own navigation chrome (LP-LICENSE-SERVER desktop
 * webview, Electron native, React Native app). When true, layouts and
 * pages should hide redundant controls (logo, theme/language toggles,
 * navigation buttons on error pages, etc.) — same pattern as the
 * `restrictPanelControls` flag in PanelLayout's init script.
 *
 * Mirrors the UA detection in `public/scripts/extracted/lib/ui-sync.js`
 * (`detectUiClientSource`).
 */

export type EmbeddedSource = "web" | "app" | "desktop" | "webframe";

export function detectEmbeddedSourceFromUA(userAgent: string | null | undefined): EmbeddedSource {
  if (!userAgent) return "web";
  const ua = userAgent.toLowerCase();
  if (ua.includes("reactnativewebview")) return "app";
  if (ua.includes("lpsdesktopwebframe") || (ua.includes("electron") && ua.includes("webview"))) return "webframe";
  if (ua.includes("electron")) return "desktop";
  return "web";
}

export function isDesktopWebframeUA(userAgent: string | null | undefined): boolean {
  return detectEmbeddedSourceFromUA(userAgent) === "webframe";
}

/**
 * True when the request comes from any embedded wrapper that renders its
 * own navigation chrome (React Native app, Electron desktop, or the
 * desktop's nested webframe). Mirrors `restrictPanelControls` in
 * PanelLayout's init script — use to hide redundant CTAs on standalone
 * pages (e.g. not-found landing) the same way the panel hides logo /
 * theme toggle / language selector.
 */
export function isEmbeddedClientUA(userAgent: string | null | undefined): boolean {
  const source = detectEmbeddedSourceFromUA(userAgent);
  return source === "app" || source === "desktop" || source === "webframe";
}

/**
 * True solo para los wrappers DESKTOP (Electron nativo o su webframe anidado),
 * donde el chrome nativo gobierna tema/idioma y los sincroniza al webview, por
 * lo que sus controles en la web sobran. La app MÓVIL (React Native, "app") NO
 * entra aquí: ahí los controles SÍ se muestran y son bidireccionales con la app
 * (la web postea por ReactNativeWebView y la app reinyecta el estado). Ver
 * `native-bridge.ts` y LP-LICENSE-SERVER/app/src/screens/SshScreen.tsx.
 */
export function isDesktopChromeUA(userAgent: string | null | undefined): boolean {
  const source = detectEmbeddedSourceFromUA(userAgent);
  return source === "desktop" || source === "webframe";
}
