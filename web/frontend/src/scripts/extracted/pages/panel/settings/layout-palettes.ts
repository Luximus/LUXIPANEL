// Settings page — predefined color palettes, the custom/Tornasol palette editors
// and the per-palette intensity sliders. Fans values into the hidden inputs.
import { installTornasolAnimation, uninstallTornasolAnimation } from "/scripts/extracted/layouts/tornasol-animation.js?v=20260628a";
import { t } from "./dom";
import { FIELDS, LAYOUT_DEFAULTS } from "./fields";
import { S } from "./state";
import { hexToRgb, rgbToHex, hexToHsl, hslToHex, shiftLightness } from "./color-math";
import { reapplyLiveTheme } from "./layout-theme";
import { scheduleAutosave } from "./settings-io";
// SSOT default brand color (reused instead of re-declaring the literal).
import { DEFAULT_CUSTOM_LAYOUT_COLOR } from "@/lib/layout-palettes";

// ── Predefined color palettes ("layouts") ────────────────────────────────
// The whole site is themed from the `layout_{light,dark}_*` settings. Instead
// of editing colors one by one, the user picks a palette card; we fan its
// values into the hidden inputs (so save/load is unchanged), swap a live
// <style> for instant site-wide preview, and autosave. The catalog (with
// per-palette precomputed CSS) is serialized by the SSR page as JSON.
export interface PaletteEntry {
  id: string;
  settings: Record<string, string>;
  css: string;
  cyclic?: boolean;
  customizable?: boolean;
}

export let layoutPalettes: PaletteEntry[] | null = null;
// Re-exported for the other settings submodules that imported it from here.
export { DEFAULT_CUSTOM_LAYOUT_COLOR };

export function loadLayoutPalettes(): PaletteEntry[] {
  if (layoutPalettes) return layoutPalettes;
  const el = document.getElementById("lxp-layout-palettes");
  try {
    layoutPalettes = el?.textContent ? (JSON.parse(el.textContent) as PaletteEntry[]) : [];
  } catch {
    layoutPalettes = [];
  }
  return layoutPalettes;
}

export function normalizeHexColor(input: string, fallback = DEFAULT_CUSTOM_LAYOUT_COLOR): string {
  const value = String(input ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

export function customPaletteColor(): string {
  const hidden = document.getElementById("s-layout-palette-custom-color") as HTMLInputElement | null;
  return normalizeHexColor(hidden?.value ?? DEFAULT_CUSTOM_LAYOUT_COLOR);
}

export function setCustomPaletteColor(color: string) {
  const normalized = normalizeHexColor(color);
  const hidden = document.getElementById("s-layout-palette-custom-color") as HTMLInputElement | null;
  const picker = document.getElementById("s-layout-palette-custom-color-picker") as HTMLInputElement | null;
  const text = document.getElementById("s-layout-palette-custom-color-text") as HTMLInputElement | null;
  if (hidden) hidden.value = normalized;
  if (picker) picker.value = normalized;
  if (text) text.value = normalized.toUpperCase();
}

export function tornasolPaletteColor(): string {
  const hidden = document.getElementById("s-layout-tornasol-color") as HTMLInputElement | null;
  return normalizeHexColor(hidden?.value ?? LAYOUT_DEFAULTS.layout_tornasol_color);
}

export function parseTornasolPaletteColors(value: unknown): string[] {
  if (Array.isArray(value)) {
    const colors = value
      .map((entry) => normalizeHexColor(String(entry), ""))
      .filter(Boolean);
    return colors.length > 0 ? Array.from(new Set(colors)).slice(0, 8) : [LAYOUT_DEFAULTS.layout_tornasol_color];
  }
  const raw = String(value ?? "").trim();
  if (!raw) return [LAYOUT_DEFAULTS.layout_tornasol_color];
  try {
    return parseTornasolPaletteColors(JSON.parse(raw));
  } catch {
    const colors = raw
      .split(/[,\n]/)
      .map((entry) => normalizeHexColor(entry, ""))
      .filter(Boolean);
    return colors.length > 0 ? Array.from(new Set(colors)).slice(0, 8) : [normalizeHexColor(raw, LAYOUT_DEFAULTS.layout_tornasol_color)];
  }
}

export function tornasolPaletteColors(): string[] {
  const hidden = document.getElementById("s-layout-tornasol-colors") as HTMLInputElement | null;
  if (hidden?.value) return parseTornasolPaletteColors(hidden.value);
  return [tornasolPaletteColor()];
}

export function renderTornasolPaletteColors() {
  const host = document.getElementById("s-layout-palette-tornasol-colors");
  if (!(host instanceof HTMLElement)) return;
  const colors = tornasolPaletteColors();
  host.innerHTML = "";
  const labelUp = t("settings.palettes.prisma.moveUpAria", "Move color up");
  const labelDown = t("settings.palettes.prisma.moveDownAria", "Move color down");
  const labelRemove = t("settings.palettes.prisma.removeColorAria", "Remove color");
  const labelEdit = t("settings.palettes.prisma.editColorAria", "Edit color");
  const labelPicker = t("settings.palettes.prisma.editColorInputAria", "Edit color value");
  const labelHex = t("settings.palettes.prisma.editColorHexAria", "Hex value of the color");
  colors.forEach((color, index) => {
    const row = document.createElement("div");
    row.className = "flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5";
    row.dataset.color = color;
    row.innerHTML = `
      <span class="tornasol-swatch h-4 w-4 shrink-0 rounded-full border border-black/10 dark:border-white/10" style="background:${color}"></span>
      <span class="tornasol-label min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">${color.toUpperCase()}</span>
      <div class="tornasol-editor hidden flex-1 items-center gap-1 rounded-md border border-border bg-background px-1.5 py-1">
        <input type="color" value="${color}" aria-label="${escapeAttr(labelPicker)}" class="tornasol-edit-picker h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
        <input type="text" value="${color.toUpperCase()}" inputmode="text" spellcheck="false" maxlength="7" aria-label="${escapeAttr(labelHex)}" class="tornasol-edit-text h-6 flex-1 rounded border border-input bg-background px-1.5 text-[11px] uppercase focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>
      <div class="flex items-center gap-1">
        <button type="button" class="tornasol-edit inline-flex h-6 w-6 items-center justify-center rounded border border-border text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-primary" aria-label="${escapeAttr(labelEdit)}" title="${escapeAttr(labelEdit)}">
          <i class="ti ti-pencil"></i>
        </button>
        <button type="button" class="tornasol-move-up inline-flex h-6 w-6 items-center justify-center rounded border border-border text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40" aria-label="${escapeAttr(labelUp)}"${index === 0 ? " disabled" : ""}>
          <i class="ti ti-chevron-up"></i>
        </button>
        <button type="button" class="tornasol-move-down inline-flex h-6 w-6 items-center justify-center rounded border border-border text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40" aria-label="${escapeAttr(labelDown)}"${index === colors.length - 1 ? " disabled" : ""}>
          <i class="ti ti-chevron-down"></i>
        </button>
        <button type="button" class="tornasol-remove inline-flex h-6 w-6 items-center justify-center rounded border border-border text-[11px] text-muted-foreground transition hover:border-red-500/50 hover:text-red-400" aria-label="${escapeAttr(labelRemove)}">
          <i class="ti ti-x"></i>
        </button>
      </div>
    `;
    row.querySelector<HTMLButtonElement>(".tornasol-move-up")?.addEventListener("click", (event) => {
      event.stopPropagation();
      moveTornasolPaletteColor(index, -1);
    });
    row.querySelector<HTMLButtonElement>(".tornasol-move-down")?.addEventListener("click", (event) => {
      event.stopPropagation();
      moveTornasolPaletteColor(index, 1);
    });
    row.querySelector<HTMLButtonElement>(".tornasol-remove")?.addEventListener("click", (event) => {
      event.stopPropagation();
      removeTornasolPaletteColor(color, index);
    });
    const editBtn = row.querySelector<HTMLButtonElement>(".tornasol-edit");
    const labelEl = row.querySelector<HTMLElement>(".tornasol-label");
    const swatchEl = row.querySelector<HTMLElement>(".tornasol-swatch");
    const editorEl = row.querySelector<HTMLElement>(".tornasol-editor");
    const pickerEl = row.querySelector<HTMLInputElement>(".tornasol-edit-picker");
    const textEl = row.querySelector<HTMLInputElement>(".tornasol-edit-text");
    editBtn?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!editorEl || !labelEl) return;
      labelEl.classList.add("hidden");
      editorEl.classList.remove("hidden");
      editorEl.classList.add("flex");
      pickerEl?.focus();
    });
    const commitEdit = (immediate: boolean) => {
      const candidate = textEl?.value ?? "";
      const normalized = normalizeHexColor(candidate, color);
      if (normalized === color) {
        // No actual change; just collapse the editor back.
        if (textEl) textEl.value = color.toUpperCase();
        if (pickerEl) pickerEl.value = color;
        return;
      }
      updateTornasolPaletteColor(index, color, normalized, immediate);
    };
    // While the picker is being dragged, only sync the hex text — don't
    // rebuild the DOM (which would yank the picker out from under the user).
    pickerEl?.addEventListener("input", () => {
      if (!textEl) return;
      textEl.value = pickerEl.value.toUpperCase();
    });
    pickerEl?.addEventListener("change", () => commitEdit(true));
    textEl?.addEventListener("input", () => {
      if (!pickerEl) return;
      const candidate = textEl.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(candidate)) {
        pickerEl.value = candidate.toLowerCase();
      }
    });
    textEl?.addEventListener("change", () => commitEdit(true));
    textEl?.addEventListener("blur", () => commitEdit(true));
    textEl?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitEdit(true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        if (textEl) textEl.value = color.toUpperCase();
        if (pickerEl) pickerEl.value = color;
        renderTornasolPaletteColors();
      }
    });
    host.appendChild(row);
  });
}

export function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function setTornasolPaletteColors(colors: string[] | string) {
  const normalizedColors = parseTornasolPaletteColors(colors);
  const hidden = document.getElementById("s-layout-tornasol-color") as HTMLInputElement | null;
  const hiddenColors = document.getElementById("s-layout-tornasol-colors") as HTMLInputElement | null;
  const picker = document.getElementById("s-layout-palette-tornasol-color-picker") as HTMLInputElement | null;
  if (hidden) hidden.value = normalizedColors[0] ?? LAYOUT_DEFAULTS.layout_tornasol_color;
  if (hiddenColors) hiddenColors.value = JSON.stringify(normalizedColors);
  if (picker && !picker.value) picker.value = normalizedColors[normalizedColors.length - 1] ?? LAYOUT_DEFAULTS.layout_tornasol_color;
  renderTornasolPaletteColors();
}

export function moveTornasolPaletteColor(index: number, direction: -1 | 1) {
  const current = tornasolPaletteColors();
  const targetIndex = index + direction;
  if (index < 0 || index >= current.length || targetIndex < 0 || targetIndex >= current.length) return;
  const next = [...current];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  setTornasolPaletteColors(next);
  refreshTornasolPalettePreview();
  applyLayoutPalette("prisma", true);
}

export function removeTornasolPaletteColor(color: string, indexToRemove?: number) {
  const current = tornasolPaletteColors();
  const remaining = current.filter((entry, index) => (
    entry !== color ? true : (indexToRemove !== undefined ? index !== indexToRemove : false)
  ));
  setTornasolPaletteColors(remaining.length > 0 ? remaining : [LAYOUT_DEFAULTS.layout_tornasol_color]);
  refreshTornasolPalettePreview();
  applyLayoutPalette("prisma", true);
}

export function updateTornasolPaletteColor(index: number, oldColor: string, newColor: string, immediate: boolean) {
  if (!newColor || newColor === oldColor) return;
  const current = tornasolPaletteColors();
  const target = current[index];
  if (target !== oldColor) return;
  const next = [...current];
  next[index] = newColor;
  setTornasolPaletteColors(next);
  refreshTornasolPalettePreview();
  applyLayoutPalette("prisma", immediate);
  if (!immediate) scheduleAutosave();
}

export function currentTornasolIntensity(): number {
  const hidden = document.getElementById("s-layout-tornasol-intensity") as HTMLInputElement | null;
  const raw = parseInt(hidden?.value ?? LAYOUT_DEFAULTS.layout_tornasol_intensity, 10);
  if (Number.isNaN(raw)) return 50;
  return Math.max(0, Math.min(100, raw));
}

export function setCurrentTornasolIntensity(value: number) {
  const normalized = Math.max(0, Math.min(100, Math.round(value)));
  const hidden = document.getElementById("s-layout-tornasol-intensity") as HTMLInputElement | null;
  if (hidden) hidden.value = String(normalized);
}

export function saturate(hex: string, delta: number): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, s + delta, l);
}

/**
 * Weighted RGB mix: `weight` is the share of `a` (0..1). The remaining share
 * goes to `b`. Mirrors `mixHex` in layout-palettes.ts so the live preview and
 * the persisted palette produce the same color. Used by buildCustomPaletteSettings
 * to keep light surfaces mostly neutral: mixing the chosen primary at <5% into
 * the neutral baseline avoids flooding whites and cards with the brand hue.
 */
export function mixHex(a: string, b: string, weight = 0.5): string {
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

export function buildCustomPaletteSettings(color: string): Record<string, string> {
  const primary = normalizeHexColor(color);
  const lightAccent = shiftLightness(saturate(primary, 8), 18);
  const darkPrimary = shiftLightness(saturate(primary, 6), 10);
  const darkAccent = shiftLightness(saturate(primary, 10), 24);
  return {
    // Light surfaces: keep them almost neutral so the chosen primary only shows
    // up as accent/border. The weights mirror layout-palettes.ts exactly so the
    // preview, the live CSS injection and the persisted DB row all agree.
    layout_light_background: mixHex("#f8fafc", primary, 0.98),
    layout_light_foreground: "#0f172a",
    layout_light_card: "#ffffff",
    layout_light_muted: mixHex("#f1f5f9", primary, 0.96),
    layout_light_accent: mixHex("#e2e8f0", primary, 0.9),
    layout_light_border: mixHex("#dbe3ef", primary, 0.86),
    layout_light_primary: primary,
    layout_light_primary_foreground: "#ffffff",
    layout_light_primary_accent: lightAccent,
    layout_light_secondary: mixHex("#f1f5f9", primary, 0.95),
    layout_light_secondary_foreground: "#0f172a",
    layout_light_info: "#7dd3fc",
    layout_light_info_foreground: "#082f49",
    layout_light_success: "#86efac",
    layout_light_success_foreground: "#052e16",
    layout_light_warning: "#fcd34d",
    layout_light_warning_foreground: "#451a03",
    layout_light_error: "#ef4444",
    layout_light_error_foreground: "#f8fafc",
    layout_dark_background: shiftLightness(primary, -24),
    layout_dark_foreground: "#f8fafc",
    layout_dark_card: shiftLightness(primary, -21),
    layout_dark_muted: shiftLightness(primary, -18),
    layout_dark_accent: shiftLightness(primary, -8),
    layout_dark_border: shiftLightness(primary, -12),
    layout_dark_primary: darkPrimary,
    layout_dark_primary_foreground: "#ffffff",
    layout_dark_primary_accent: darkAccent,
    layout_dark_secondary: shiftLightness(primary, -16),
    layout_dark_secondary_foreground: "#fafafa",
    layout_dark_info: "#7dd3fc",
    layout_dark_info_foreground: "#082f49",
    layout_dark_success: "#86efac",
    layout_dark_success_foreground: "#052e16",
    layout_dark_warning: "#fcd34d",
    layout_dark_warning_foreground: "#451a03",
    layout_dark_error: "#ef4444",
    layout_dark_error_foreground: "#fafafa",
  };
}

export function resolvePaletteSettings(palette: PaletteEntry): Record<string, string> {
  return palette.customizable ? buildCustomPaletteSettings(customPaletteColor()) : palette.settings;
}

export function refreshCustomPalettePreview() {
  const card = document.querySelector<HTMLElement>('.layout-palette-card[data-palette-id="custom"]');
  if (!card) return;
  const settings = buildCustomPaletteSettings(customPaletteColor());
  const setBg = (selector: string, value: string) => {
    const el = card.querySelector<HTMLElement>(selector);
    if (el) el.style.background = value;
  };
  const setBorder = (selector: string, value: string) => {
    const el = card.querySelector<HTMLElement>(selector);
    if (el) el.style.borderColor = value;
  };
  const setColor = (selector: string, value: string) => {
    const el = card.querySelector<HTMLElement>(selector);
    if (el) el.style.color = value;
  };
  setBg(".h-4.w-4", settings.layout_light_primary);
  setBg('[data-preview-mode="light"]', settings.layout_light_background);
  setBorder('[data-preview-mode="light"]', settings.layout_light_border);
  setBg('[data-preview-mode="light"] .rounded-md', settings.layout_light_card);
  setBg('[data-preview-mode="light"] [data-preview-swatch=\"primary\"]', settings.layout_light_primary);
  setBg('[data-preview-mode="light"] [data-preview-swatch=\"accent\"]', settings.layout_light_primary_accent);
  setBg('[data-preview-mode="light"] [data-preview-line=\"strong\"]', settings.layout_light_foreground);
  setBg('[data-preview-mode="light"] [data-preview-line=\"soft\"]', settings.layout_light_foreground);
  setColor('[data-preview-mode="light"] .palette-preview-label', settings.layout_light_foreground);
  setBg('[data-preview-mode="dark"]', settings.layout_dark_background);
  setBorder('[data-preview-mode="dark"]', settings.layout_dark_border);
  setBg('[data-preview-mode="dark"] .rounded-md', settings.layout_dark_card);
  setBg('[data-preview-mode="dark"] [data-preview-swatch=\"primary\"]', settings.layout_dark_primary);
  setBg('[data-preview-mode="dark"] [data-preview-swatch=\"accent\"]', settings.layout_dark_primary_accent);
  setBg('[data-preview-mode="dark"] [data-preview-line=\"strong\"]', settings.layout_dark_foreground);
  setBg('[data-preview-mode="dark"] [data-preview-line=\"soft\"]', settings.layout_dark_foreground);
  setColor('[data-preview-mode="dark"] .palette-preview-label', settings.layout_dark_foreground);
}

export function refreshTornasolPalettePreview() {
  const card = document.querySelector<HTMLElement>('.layout-palette-card[data-palette-id="prisma"]');
  if (!card) return;
  const colors = tornasolPaletteColors();
  const base = colors[0] ?? LAYOUT_DEFAULTS.layout_tornasol_color;
  const accent = colors[1] ?? shiftLightness(saturate(base, 12), 16);
  const darkBase = colors[1] ?? shiftLightness(base, 10);
  const darkAccent = colors[2] ?? shiftLightness(saturate(base, 10), 24);
  const gradient = `linear-gradient(90deg, ${colors.join(", ")})`;
  const dot = card.querySelector<HTMLElement>(".h-4.w-4");
  if (dot) dot.style.background = gradient;
  card.querySelectorAll<HTMLElement>('[data-preview-mode="light"] [data-preview-swatch="primary"]').forEach((el) => { el.style.background = base; });
  card.querySelectorAll<HTMLElement>('[data-preview-mode="light"] [data-preview-swatch="accent"]').forEach((el) => { el.style.background = accent; });
  card.querySelectorAll<HTMLElement>('[data-preview-mode="dark"] [data-preview-swatch="primary"]').forEach((el) => { el.style.background = darkBase; });
  card.querySelectorAll<HTMLElement>('[data-preview-mode="dark"] [data-preview-swatch="accent"]').forEach((el) => { el.style.background = darkAccent; });
}

/** Read the current color values from the hidden inputs. */
export function currentLayoutColors(): Record<string, string> {
  const current: Record<string, string> = {};
  for (const [key, elId] of Object.entries(FIELDS)) {
    if (!key.startsWith("layout_light_") && !key.startsWith("layout_dark_")) continue;
    const el = document.getElementById(elId) as HTMLInputElement | null;
    if (el) current[key] = el.value;
  }
  return current;
}

// Per-palette "intensity" slider: shifts the brand colors (primary + accent,
// light + dark) lighter/darker within the SAME hue, from lightest (slider 0) to
// darkest (slider 100). 50 = the palette's native tone (exact base colors).
// Only these four keys move; every other color stays at the palette base, so
// `refreshActivePalette` can still identify the active palette by ignoring them.
export const PALETTE_INTENSITY_MID = 50;
export const PALETTE_INTENSITY_MAX_DELTA = 22; // HSL lightness points at the extremes
export const PALETTE_INTENSITY_KEYS: readonly string[] = [
  "layout_light_primary",
  "layout_light_primary_accent",
  "layout_dark_primary",
  "layout_dark_primary_accent",
];

/** Slider value (0..100) -> lightness delta (+lighter at 0, -darker at 100). */
export function intensityDelta(sliderValue: number): number {
  const v = Math.max(0, Math.min(100, sliderValue));
  return ((PALETTE_INTENSITY_MID - v) / PALETTE_INTENSITY_MID) * PALETTE_INTENSITY_MAX_DELTA;
}

/** Lightness delta -> slider value (inverse of `intensityDelta`), clamped 0..100. */
export function intensitySliderFromDelta(deltaL: number): number {
  const v = PALETTE_INTENSITY_MID - (deltaL / PALETTE_INTENSITY_MAX_DELTA) * PALETTE_INTENSITY_MID;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Apply a palette at a given intensity: write every base color, but shift the
 *  four brand keys lighter/darker by the slider. Live-preview + highlight + persist. */
export function applyLayoutPaletteWithIntensity(id: string, sliderValue: number, persist: boolean) {
  const palette = loadLayoutPalettes().find((p) => p.id === id);
  if (!palette) return;
  S.activePaletteId = id;
  const delta = intensityDelta(sliderValue);
  const settings = resolvePaletteSettings(palette);
  const paletteIdEl = document.getElementById("s-layout-palette-id") as HTMLInputElement | null;
  if (paletteIdEl) paletteIdEl.value = id;
  for (const [settingKey, baseValue] of Object.entries(settings)) {
    const value = PALETTE_INTENSITY_KEYS.includes(settingKey)
      ? shiftLightness(baseValue, delta)
      : baseValue;
    const elId = FIELDS[settingKey];
    const el = elId ? (document.getElementById(elId) as HTMLInputElement | null) : null;
    if (el) el.value = value;
  }
  // Rebuild from the current inputs (preserves the user's radius/shadow choices).
  reapplyLiveTheme();
  refreshActivePalette();
  if (persist) scheduleAutosave(true);
}

/** Highlight the palette card whose colors match the current hidden inputs and
 *  sync each card's intensity slider (active -> its derived tone, rest -> middle). */
export function refreshActivePalette() {
  refreshCustomPalettePreview();
  refreshTornasolPalettePreview();
  const current = currentLayoutColors();
  // First preference: explicit user pick (set on click). Falls back to color matching
  // for SSR-loaded state. Tornasol uses static violet-derived colors so it would
  // otherwise match violet — the explicit pick is the source of truth.
  let activeId: string | null = S.activePaletteId;
  if (!activeId) {
    for (const p of loadLayoutPalettes()) {
      const settings = resolvePaletteSettings(p);
      // The four brand keys are intensity-adjustable; match on everything else.
      const match = Object.entries(settings).every(([k, v]) =>
        PALETTE_INTENSITY_KEYS.includes(k)
          ? true
          : (current[k] ?? "").trim().toLowerCase() === v.toLowerCase(),
      );
      if (match) { activeId = p.id; break; }
    }
  }
  // Derive the active palette's slider from how far its primary lightness moved.
  let activeSlider = PALETTE_INTENSITY_MID;
  const activePalette = activeId ? loadLayoutPalettes().find((p) => p.id === activeId) : null;
  if (activePalette && !activePalette.cyclic) {
    const base = resolvePaletteSettings(activePalette)["layout_light_primary"];
    const now = current["layout_light_primary"];
    if (base && now) activeSlider = intensitySliderFromDelta(hexToHsl(now).l - hexToHsl(base).l);
  }
  document.querySelectorAll<HTMLElement>(".layout-palette-card").forEach((card) => {
    const on = card.dataset.paletteId === activeId;
    card.classList.toggle("border-primary", on);
    card.classList.toggle("bg-primary/5", on);
    card.setAttribute("aria-pressed", on ? "true" : "false");
    const check = card.querySelector(".palette-check");
    check?.classList.toggle("hidden", !on);
    check?.classList.toggle("flex", on);
  });
  // Never fight a slider the user is actively dragging.
  document.querySelectorAll<HTMLInputElement>("input[data-palette-intensity]").forEach((slider) => {
    if (slider === document.activeElement) return;
    if (activePalette?.cyclic && slider.dataset.paletteId === activeId) {
      // For the active Tornasol palette, the slider is the persisted animation
      // intensity control — keep it synced with the hidden field.
      slider.value = String(currentTornasolIntensity());
    } else {
      slider.value = String(slider.dataset.paletteId === activeId ? activeSlider : PALETTE_INTENSITY_MID);
    }
  });
}

/** Apply a palette: write hidden inputs, live-preview, highlight, persist. */
export function applyLayoutPalette(id: string, persist: boolean) {
  const palette = loadLayoutPalettes().find((p) => p.id === id);
  if (!palette) return;
  S.activePaletteId = id;
  // Mirror the active pick into the hidden input so collectSettings() picks
  // it up on the next autosave. `palette.settings` only carries the color map,
  // so without this write the input stays at its SSR default ("violet") and
  // every save round-trip overwrites the user's tornasol pick with violet.
  const paletteIdEl = document.getElementById("s-layout-palette-id") as HTMLInputElement | null;
  if (paletteIdEl) paletteIdEl.value = id;
  for (const [settingKey, value] of Object.entries(resolvePaletteSettings(palette))) {
    const elId = FIELDS[settingKey];
    const el = elId ? (document.getElementById(elId) as HTMLInputElement | null) : null;
    if (el) el.value = value;
  }
  // Rebuild from the current inputs (not the precomputed palette.css) so the
  // user's radius/shadow choices are preserved when switching palettes.
  reapplyLiveTheme();
  // Tornasol mode: the static colors mirror violet (so settings persist
  // cleanly), but the brand slots get a CSS keyframe animation on top of
  // them. Switching to ANY other palette tears the animation down. Install
  // AFTER reapplyLiveTheme so the tornasol <style> is the LAST one in <head>
  // — otherwise the live-theme `:root:root:root { --primary: … }` (later in
  // document order, same specificity) would override the keyframe-set
  // `--primary` and the user would see static violet instead of the cycling
  // colors. Mirrors applyPersistedTheme in branding-runtime.
  if (palette.cyclic) {
    installTornasolAnimation(currentTornasolIntensity(), tornasolPaletteColors());
  } else {
    uninstallTornasolAnimation();
  }
  refreshActivePalette();
  if (persist) scheduleAutosave(true);
}

export function bindLayoutPalettes() {
  loadLayoutPalettes();
  document.querySelectorAll<HTMLElement>(".layout-palette-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.paletteId;
      if (id) applyLayoutPalette(id, true);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const id = card.dataset.paletteId;
      if (id) applyLayoutPalette(id, true);
    });
  });
  // Per-palette intensity sliders: for static palettes, dragging shifts the
  // brand colors lighter/darker within the same hue. For the Tornasol (cyclic)
  // palette, the slider drives the animation duration instead.
  document.querySelectorAll<HTMLInputElement>("input[data-palette-intensity]").forEach((slider) => {
    slider.addEventListener("input", () => {
      const id = slider.dataset.paletteId;
      if (!id) return;
      const palette = loadLayoutPalettes().find((p) => p.id === id);
      if (!palette) return;
      if (palette.cyclic) {
        // Tornasol intensity: map slider directly to animation duration.
        // Selecting Tornasol implicitly (so refreshActivePalette highlights it).
        S.activePaletteId = id;
        // Mirror the pick into the hidden input so collectSettings() saves
        // "prisma" instead of the SSR default "violet" (same reason as the
        // click handler in applyLayoutPalette).
        const paletteIdEl = document.getElementById("s-layout-palette-id") as HTMLInputElement | null;
        if (paletteIdEl) paletteIdEl.value = id;
        setCurrentTornasolIntensity(Number(slider.value));
        installTornasolAnimation(currentTornasolIntensity(), tornasolPaletteColors());
        refreshActivePalette();
        scheduleAutosave(true);
      } else {
        applyLayoutPaletteWithIntensity(id, Number(slider.value), true);
      }
    });
  });
  const colorPicker = document.getElementById("s-layout-palette-custom-color-picker") as HTMLInputElement | null;
  const colorText = document.getElementById("s-layout-palette-custom-color-text") as HTMLInputElement | null;
  const applyCustomColor = (value: string, immediate: boolean) => {
    setCustomPaletteColor(value);
    refreshCustomPalettePreview();
    const slider = document.querySelector<HTMLInputElement>('input[data-palette-intensity][data-palette-id="custom"]');
    if (slider) applyLayoutPaletteWithIntensity("custom", Number(slider.value), immediate);
    else applyLayoutPalette("custom", immediate);
    if (!immediate) scheduleAutosave();
  };
  colorPicker?.addEventListener("input", () => applyCustomColor(colorPicker.value, false));
  colorPicker?.addEventListener("change", () => applyCustomColor(colorPicker.value, true));
  colorText?.addEventListener("input", () => {
    const normalized = normalizeHexColor(colorText.value, customPaletteColor());
    if (/^#[0-9a-f]{6}$/i.test(colorText.value.trim())) applyCustomColor(normalized, false);
  });
  colorText?.addEventListener("change", () => applyCustomColor(colorText.value, true));
  const tornasolPicker = document.getElementById("s-layout-palette-tornasol-color-picker") as HTMLInputElement | null;
  const applyTornasolColors = (colors: string[] | string, immediate: boolean) => {
    setTornasolPaletteColors(colors);
    refreshTornasolPalettePreview();
    applyLayoutPalette("prisma", immediate);
    if (!immediate) scheduleAutosave();
  };
  const addTornasolColor = (immediate: boolean) => {
    const candidate = normalizeHexColor(tornasolPicker?.value || "", tornasolPaletteColor());
    const next = [...tornasolPaletteColors(), candidate];
    applyTornasolColors(next, immediate);
  };
  tornasolPicker?.addEventListener("input", (event) => {
    event.stopPropagation();
    addTornasolColor(false);
  });
  tornasolPicker?.addEventListener("change", (event) => {
    event.stopPropagation();
    addTornasolColor(true);
  });
}
