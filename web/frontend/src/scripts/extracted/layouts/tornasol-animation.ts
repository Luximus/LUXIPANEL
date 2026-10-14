// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tornasol / iridescent palette animation.
 *
 * The "Tornasol" palette (id `tornasol` in LAYOUT_PALETTES) does not commit
 * static colors to the layout settings — instead it overrides the brand slots
 * (`--primary`, `--primary-accent`, `--brand`, `--brand-light`, `--ok-fg`,
 * `--ok-border`, `--badge-active-fg`, `--border-brand`) with a CSS `@keyframes`
 * animation that cycles through 12 rainbow hues in a continuous, infinite loop.
 *
 * The animation drives the HSL hue directly via `@property` so the browser
 * interpolates between adjacent keyframes smoothly. Without `@property`,
 * `<color>` custom properties snap discretely (which is still acceptable but
 * visibly choppy); registering them makes the tornasol effect a true smooth
 * gradient sweep.
 *
 * Activation model:
 *   - `setTornasolActive(true, intensity)` stores the state + slider value in
 *     sessionStorage so the animation survives SPA navigation (re-installed
 *     by branding-runtime on every `astro:after-swap` / `astro:page-load`).
 *   - `installTornasolAnimation()` is idempotent: safe to call repeatedly.
 *   - `setTornasolIntensity(value)` updates the live `--tornasol-duration`
 *     CSS variable so the slider takes effect immediately without rebuilding
 *     any style block.
 */

import {
  TORNASOL_FLAG_KEY,
  TORNASOL_INTENSITY_KEY,
  TORNASOL_COLOR_KEY,
  TORNASOL_COLORS_KEY,
} from "/scripts/extracted/lib/branding-storage-keys.js";

declare global {
  interface Window {
    __lxpTornasolInstalled?: boolean;
    __lxpTornasolRaf?: number;
  }
}

// MUST match layout-palettes.ts DEFAULT_CUSTOM_LAYOUT_COLOR (bundle:false
// extracted module resolving only runtime-URL shared libs; keep the literal).
const DEFAULT_TORNASOL_COLOR = "#7c3aed";

/** Build a customized iridescent hue table anchored on the chosen base color. */
function normalizeHexColor(input: string, fallback = DEFAULT_TORNASOL_COLOR): string {
  const value = String(input ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const safe = normalizeHexColor(hex);
  const n = parseInt(safe.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rf) h = (gf - bf) / d + (gf < bf ? 6 : 0);
    else if (max === gf) h = (bf - rf) / d + 2;
    else h = (rf - gf) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function normalizeTornasolColors(input: string[] | string | undefined): string[] {
  const values = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[,\n]/) : [];
  const deduped = new Set<string>();
  for (const value of values) {
    const color = normalizeHexColor(value, "");
    if (color) deduped.add(color);
  }
  if (deduped.size > 0) return Array.from(deduped).slice(0, 8);
  return [DEFAULT_TORNASOL_COLOR];
}
type TornasolStop = { lightPrimary: string; lightAccent: string; darkPrimary: string; darkAccent: string };
function buildTornasolStops(colors: string[] | string): TornasolStop[] {
  const palette = normalizeTornasolColors(colors);
  return palette.map((color) => {
    const { h, s, l } = hexToHsl(color);
    return {
      // Use the admin-selected color as the actual primary stop so the live
      // animation matches the saved list exactly instead of drifting to
      // derived neighboring hues.
      lightPrimary: normalizeHexColor(color),
      lightAccent: hslLight(h, Math.max(18, Math.min(86, l + 12)), Math.min(s + 6, 100)),
      darkPrimary: normalizeHexColor(color),
      darkAccent: hslLight(h, Math.max(24, Math.min(88, l + 16)), Math.min(s + 10, 100)),
    };
  });
}

/** Build a `hsl(H S% L%)` string from one hue in the rainbow table. */
function hslLight(hue: number, light: number, saturation = 75): string {
  return `hsl(${hue} ${saturation}% ${light}%)`;
}

/**
 * Build the Tornasol CSS block: `@property` registrations (so the browser
 * interpolates the custom-property color values smoothly), the per-mode keyframe
 * rules, and the rules that wire `--tornasol-duration` (slider-controlled) to
 * `animation-duration`. The block targets `:root:root:root` and
 * `:root:root.dark` for the same specificity-bump reason as the regular live
 * palette (so it wins over the SSR theme).
 */
export function buildTornasolCss(colors: string[] | string = DEFAULT_TORNASOL_COLOR): string {
  const stops = buildTornasolStops(colors);
  const lightKeyframes = stops.map((stop, i) => {
    const pct = ((i / stops.length) * 100).toFixed(3);
    return `  ${pct}% { --primary: ${stop.lightPrimary}; --primary-accent: ${stop.lightAccent}; --brand: ${stop.lightPrimary}; --brand-light: ${stop.lightAccent}; --ok-fg: ${stop.lightPrimary}; --ok-border: ${stop.lightAccent}; --badge-active-fg: ${stop.lightPrimary}; --border-brand: ${stop.lightAccent}; }`;
  }).join("\n");
  const darkKeyframes = stops.map((stop, i) => {
    const pct = ((i / stops.length) * 100).toFixed(3);
    return `  ${pct}% { --primary: ${stop.darkPrimary}; --primary-accent: ${stop.darkAccent}; --brand: ${stop.darkPrimary}; --brand-light: ${stop.darkAccent}; --ok-fg: ${stop.darkPrimary}; --ok-border: ${stop.darkAccent}; --badge-active-fg: ${stop.darkPrimary}; --border-brand: ${stop.darkAccent}; }`;
  }).join("\n");

  return `
@property --primary { syntax: '<color>'; inherits: true; initial-value: #7c3aed; }
@property --primary-accent { syntax: '<color>'; inherits: true; initial-value: #a78bfa; }
@property --brand { syntax: '<color>'; inherits: true; initial-value: #7c3aed; }
@property --brand-light { syntax: '<color>'; inherits: true; initial-value: #a78bfa; }
@property --ok-fg { syntax: '<color>'; inherits: true; initial-value: #7c3aed; }
@property --ok-border { syntax: '<color>'; inherits: true; initial-value: #a78bfa; }
@property --badge-active-fg { syntax: '<color>'; inherits: true; initial-value: #7c3aed; }
@property --border-brand { syntax: '<color>'; inherits: true; initial-value: #a78bfa; }
:root:root:root {
  --tornasol-duration: 24s;
  animation: tornasol-cycle-light var(--tornasol-duration) linear infinite;
}
:root:root.dark {
  --tornasol-duration: 24s;
  animation: tornasol-cycle-dark var(--tornasol-duration) linear infinite;
}
@keyframes tornasol-cycle-light {
${lightKeyframes}
}
@keyframes tornasol-cycle-dark {
${darkKeyframes}
}
@media (prefers-reduced-motion: reduce) {
  :root:root:root, :root:root.dark { animation-duration: 120s; }
}
`;
}

/** Slider value (0..100) -> animation duration in seconds.
 *  0  = effectively frozen (very long duration); 50 = 24s (default);
 *  100 = 4s (fastest pleasant cycle). */
export function tornasolDurationFromIntensity(value: number): number {
  const v = Math.max(0, Math.min(100, value));
  // Exponential mapping: 0→90s, 50→24s, 100→4s (clamped to sane bounds).
  if (v <= 0) return 90;
  if (v >= 100) return 4;
  // 90 * (90/24)^(v/50 - 1) ... simpler: linear between two anchors
  const t = v / 100;
  const min = 4;
  const max = 90;
  return max + (min - max) * t;
}

/** Persist Tornasol active flag + current intensity so branding-runtime
 *  re-installs the animation on SPA navigation. */
export function setTornasolActive(active: boolean, intensity: number, colors: string[] | string = DEFAULT_TORNASOL_COLOR) {
  try {
    if (active) {
      const normalizedColors = normalizeTornasolColors(colors);
      sessionStorage.setItem(TORNASOL_FLAG_KEY, "1");
      sessionStorage.setItem(TORNASOL_INTENSITY_KEY, String(intensity));
      sessionStorage.setItem(TORNASOL_COLORS_KEY, JSON.stringify(normalizedColors));
      sessionStorage.setItem(TORNASOL_COLOR_KEY, normalizedColors[0] ?? DEFAULT_TORNASOL_COLOR);
    } else {
      sessionStorage.removeItem(TORNASOL_FLAG_KEY);
      sessionStorage.removeItem(TORNASOL_INTENSITY_KEY);
      sessionStorage.removeItem(TORNASOL_COLORS_KEY);
      sessionStorage.removeItem(TORNASOL_COLOR_KEY);
    }
  } catch {
    /* sessionStorage unavailable — animation will only live on this page. */
  }
}

export function isTornasolActive(): boolean {
  try {
    return sessionStorage.getItem(TORNASOL_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function getTornasolIntensity(): number {
  try {
    const raw = sessionStorage.getItem(TORNASOL_INTENSITY_KEY);
    const n = raw === null ? 50 : parseInt(raw, 10);
    if (Number.isNaN(n)) return 50;
    return Math.max(0, Math.min(100, n));
  } catch {
    return 50;
  }
}

export function getTornasolColors(): string[] {
  try {
    const raw = sessionStorage.getItem(TORNASOL_COLORS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeTornasolColors(parsed);
    }
  } catch {
    /* fallback legacy */
  }
  try {
    return normalizeTornasolColors(sessionStorage.getItem(TORNASOL_COLOR_KEY) ?? DEFAULT_TORNASOL_COLOR);
  } catch { return [DEFAULT_TORNASOL_COLOR]; }
}

/** Inject the Tornasol keyframes + animation as the LAST <style> in <head>,
 *  gated by a dedicated id so we can install/remove without touching the
 *  regular `lxp-layout-live` block (palette colors keep persisting through
 *  their own channel; Tornasol only adds the animation on top). */
function ensureTornasolStyle(colors: string[] | string): HTMLStyleElement | null {
  let style = document.getElementById("lxp-layout-tornasol") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "lxp-layout-tornasol";
  }
  style.textContent = buildTornasolCss(colors);
  document.head.appendChild(style);
  return style;
}

/** Remove the Tornasol animation block (called when switching away from the
 *  tornasol palette so the regular palette's static colors take over). */
export function uninstallTornasolAnimation() {
  const style = document.getElementById("lxp-layout-tornasol");
  if (style) style.remove();
  setTornasolActive(false, 50);
}

/** Install / refresh the Tornasol animation. Idempotent: re-calling updates
 *  the duration to match the slider value. */
export function installTornasolAnimation(intensity: number = getTornasolIntensity(), colors: string[] | string = getTornasolColors()) {
  const normalizedColors = normalizeTornasolColors(colors);
  ensureTornasolStyle(normalizedColors);
  // Apply the slider-driven duration as an inline custom property on <html>
  // so the keyframe rule's `animation-duration: var(--tornasol-duration)`
  // resolves without re-injecting CSS.
  const duration = tornasolDurationFromIntensity(intensity);
  document.documentElement.style.setProperty("--tornasol-duration", `${duration}s`);
  setTornasolActive(true, intensity, normalizedColors);
}

/** Update the live animation duration from the intensity slider without
 *  re-installing the whole block. Cheap to call on every `input` event. */
export function setTornasolIntensity(value: number) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const duration = tornasolDurationFromIntensity(v);
  document.documentElement.style.setProperty("--tornasol-duration", `${duration}s`);
  try {
    sessionStorage.setItem(TORNASOL_INTENSITY_KEY, String(v));
  } catch {
    /* ignore */
  }
}
