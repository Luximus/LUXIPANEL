// Settings page — hex/rgb/hsl color math (leaf; imports nothing).

// ---------------------------------------------------------------------------
// Derived layout controls: native color pickers, range sliders, decomposed
// shadows. The CANONICAL inputs keep their ids/values; the visible controls
// recompose those canonical strings and re-dispatch `input` so the existing
// bindAutoSaveField + reapplyLiveTheme bindings fire unchanged.
// ---------------------------------------------------------------------------

/** `#0f172a` -> { r:15, g:23, b:42 }. Defensive: bad input -> black. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** (15, 23, 42) -> `#0f172a` (lowercase, 2-digit each). */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v || 0)));
  const h = (v: number) => clamp(v).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** `#7c3aed` -> { h(0-360), s(0-100), l(0-100) }. Defensive: bad input -> black. */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
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

/** { h(0-360), s/l(0-100) } -> `#rrggbb`. */
export function hslToHex(h: number, s: number, l: number): string {
  const sf = Math.max(0, Math.min(100, s)) / 100;
  const lf = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sf * Math.min(lf, 1 - lf);
  const f = (n: number) => lf - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** Shift a hex color's HSL lightness by `deltaL` points, preserving hue and
 *  saturation so the result stays in the same color family. */
export function shiftLightness(hex: string, deltaL: number): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, s, l + deltaL);
}
