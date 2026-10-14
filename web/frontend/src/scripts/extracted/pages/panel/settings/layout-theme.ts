// Settings page — live theme injection (colors/radius/shadows/logos), the derived
// shadow/radius controls, background-effect visibility, image-list editors.
import { buildLayoutCss } from "/scripts/extracted/lib/layout-branding.js?v=20260928luxisoft";
import { applyBrandedAsset } from "/scripts/extracted/lib/branding-images.js";
import { resolveTargetScope } from "/scripts/extracted/lib/api-client.js";
import {
  LIVE_LOGOS_KEY,
  LIVE_CSS_KEY,
  LIVE_CSS_VERSION,
} from "/scripts/extracted/lib/branding-storage-keys.js?v=20260928luxisoft2";
import { t, normalizePanelAssetPath } from "./dom";
import { FIELDS } from "./fields";
import { hexToRgb, rgbToHex } from "./color-math";

let loginPreviewTimer: ReturnType<typeof setTimeout> | undefined;

export function scheduleLoginPreview() {
  clearTimeout(loginPreviewTimer);
  loginPreviewTimer = setTimeout(() => {
    const iframe = document.getElementById("layout-login-preview") as HTMLIFrameElement | null;
    if (!iframe) return;
    const params = new URLSearchParams();
    const fields = [
      document.getElementById("s-layout-login-background-enabled"),
      document.getElementById("s-layout-login-background-fallback-color"),
      document.getElementById("s-layout-login-background-type"),
      ...document.querySelectorAll<HTMLElement>(
        `[data-background-scope="login"][data-background-effect-panel="${CSS.escape((document.getElementById("s-layout-login-background-type") as HTMLSelectElement | null)?.value ?? "")}"] .layout-login-bg-field`,
      ),
    ];
    for (const field of fields) {
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) continue;
      const key = field.id.replace(/^s-/, "").replaceAll("-", "_");
      params.set(key, field instanceof HTMLInputElement && field.type === "checkbox" ? String(field.checked) : field.value);
    }
    const url = `/settings/login-preview?${params}`;
    if (iframe.getAttribute("src") !== url) iframe.setAttribute("src", url);
  }, 300);
}

// Scope-aware: drives both the login background (`scope="login"`) and the panel
// background (`scope="panel"`) sections. Toggles the enable→fallback/settings
// reveal and unfolds only the selected effect's control panel for that scope.
export function updateBackgroundSettingsVisibility(scope: "login" | "panel") {
  const enabledCheckbox = document.getElementById(`s-layout-${scope}-background-enabled`) as HTMLInputElement | null;
  const select = document.getElementById(`s-layout-${scope}-background-type`) as HTMLSelectElement | null;
  const fallbackColor = document.getElementById(`layout-${scope}-fallback-color-settings`);
  const backgroundSettings = document.getElementById(`layout-${scope}-background-settings`);
  if (!enabledCheckbox || !select || !fallbackColor || !backgroundSettings) return;

  const enabled = enabledCheckbox.checked;
  fallbackColor.classList.toggle("hidden", enabled);
  backgroundSettings.classList.toggle("hidden", !enabled);

  // Show only the panel for the selected effect (registry-driven; one panel per
  // effect, tagged data-background-effect-panel="<id>" + data-background-scope).
  const active = select.value;
  document
    .querySelectorAll<HTMLElement>(`[data-background-scope="${scope}"][data-background-effect-panel]`)
    .forEach((panel) => {
      const isActive = enabled && panel.getAttribute("data-background-effect-panel") === active;
      panel.classList.toggle("hidden", !isActive);
    });
}

export function updateLoginBackgroundSettingsVisibility() {
  updateBackgroundSettingsVisibility("login");
  updateBackgroundSettingsVisibility("panel");
  scheduleLoginPreview();
}

// ── Image-URL list editor (registry "items" controls, e.g. GridMotion) ──────
// Lets the admin add/remove image URLs one by one. The canonical value remains a
// JSON array string in the hidden input (so coerce/render are unchanged); each
// edit re-serializes the rows and dispatches `input` so autosave fires.
export function buildImageListRow(value: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "flex items-center gap-2";
  row.setAttribute("data-image-list-row", "");

  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.placeholder = t("placeholders.imageUrl", "https://…/image.jpg");
  input.className =
    "image-list-input flex-1 h-9 rounded-lg border border-input bg-background px-3 text-xs font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.setAttribute("data-image-list-remove", "");
  remove.className =
    "shrink-0 rounded-lg border border-input p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors";
  remove.innerHTML = '<i class="ti ti-trash text-sm"></i>';

  row.append(input, remove);
  return row;
}

export function renderImageListRows(field: HTMLElement): void {
  const hidden = field.querySelector<HTMLInputElement>('input[type="hidden"]');
  const rows = field.querySelector<HTMLElement>("[data-image-list-rows]");
  if (!hidden || !rows) return;
  let values: string[] = [];
  try {
    const parsed = JSON.parse(hidden.value || "[]");
    if (Array.isArray(parsed)) values = parsed.map((v) => String(v));
  } catch {
    values = [];
  }
  rows.replaceChildren(...values.map((v) => buildImageListRow(v)));
}

export function syncImageListField(field: HTMLElement): void {
  const hidden = field.querySelector<HTMLInputElement>('input[type="hidden"]');
  const rows = field.querySelector<HTMLElement>("[data-image-list-rows]");
  if (!hidden || !rows) return;
  const values = Array.from(rows.querySelectorAll<HTMLInputElement>(".image-list-input"))
    .map((i) => i.value.trim())
    .filter((v) => v.length > 0);
  hidden.value = JSON.stringify(values);
  // Notify the autosave binding attached to the hidden field.
  hidden.dispatchEvent(new Event("input", { bubbles: true }));
}

export function initImageListEditors(): void {
  document.querySelectorAll<HTMLElement>("[data-image-list-field]").forEach((field) => {
    renderImageListRows(field);
    if (field.getAttribute("data-image-list-bound") === "1") return;
    field.setAttribute("data-image-list-bound", "1");

    field.querySelector<HTMLElement>("[data-image-list-add]")?.addEventListener("click", () => {
      const rows = field.querySelector<HTMLElement>("[data-image-list-rows]");
      if (!rows) return;
      const row = buildImageListRow("");
      rows.appendChild(row);
      row.querySelector<HTMLInputElement>(".image-list-input")?.focus();
      syncImageListField(field);
    });

    field.addEventListener("input", (event) => {
      if ((event.target as HTMLElement | null)?.classList.contains("image-list-input")) {
        syncImageListField(field);
      }
    });

    field.addEventListener("click", (event) => {
      const remove = (event.target as HTMLElement | null)?.closest("[data-image-list-remove]");
      if (!remove) return;
      remove.closest("[data-image-list-row]")?.remove();
      syncImageListField(field);
    });
  });
}

/** Raise the specificity of the live-override theme so it wins over the SSR
 *  theme block REGARDLESS of document position. The SSR `<style>` (BrandingRuntime)
 *  is rendered at the top of <body>, while this live override is appended to
 *  <head> — and for equal-specificity `:root` custom properties the LATER block
 *  in document order wins, i.e. the <body> SSR block would beat a plain `:root`
 *  override in <head>. Bumping `:root`→`:root:root:root` and `.dark`→
 *  `:root:root.dark` makes the live rules strictly more specific, so the preview
 *  applies instantly no matter where the SSR block sits. Dark stays ordered after
 *  light (same specificity) so it still overrides light when `.dark` is present. */
export function bumpLiveThemeSpecificity(css: string): string {
  return css
    .replace(/(^|\n)(\s*):root(\s*\{)/g, "$1$2:root:root:root$3")
    .replace(/(^|\n)(\s*)\.dark(\s*\{)/g, "$1$2:root:root.dark$3");
}

/** Replace (or create) the live <style> that re-themes the whole site instantly,
 *  and persist it so the theme survives SPA navigation to other panel pages
 *  (re-applied by the global branding runtime — see branding-runtime.ts). */
// LIVE_CSS_VERSION now lives in the SSOT branding-storage-keys module (imported
// above; bump it there when the layout color/palette logic changes so
// branding-runtime drops any persisted CSS whose `v` doesn't match). Re-exported
// here to preserve this module's public surface.
export { LIVE_CSS_VERSION };

export function injectLivePaletteCss(css: string) {
  // Store the specificity-bumped CSS so BOTH this page and branding-runtime
  // (which injects the persisted CSS verbatim on SPA swaps) get the winning rules.
  const winning = bumpLiveThemeSpecificity(css);
  let style = document.getElementById("lxp-layout-live") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "lxp-layout-live";
  }
  style.textContent = winning;
  // Keep it the last <style> in <head> too (defence in depth alongside specificity).
  document.head.appendChild(style);
  try {
    sessionStorage.setItem(
      LIVE_CSS_KEY,
      JSON.stringify({ v: LIVE_CSS_VERSION, css: winning }),
    );
  } catch {
    /* sessionStorage unavailable — live preview still works on this page. */
  }
}

/** Mirror of injectLivePaletteCss for the LOGOS: build the logo map from the
 *  current inputs, apply it at once to every branded <img> on the page (the
 *  sidebar top logo included — it persists across SPA navs), refresh the
 *  SSR-embedded map and persist the override so branding-runtime keeps the new
 *  logo across SPA navigation (the SSR map is cache-stale right after a save). */
export function reapplyLiveLogos() {
  const read = (id: string) =>
    normalizePanelAssetPath((document.getElementById(id) as HTMLInputElement | null)?.value ?? "");
  // One logo applies to every branded surface (visual slots + browser favicon).
  const logo = read("s-layout-logo");
  const map: Record<string, string> = {
    __scope: resolveTargetScope(),
    primary: logo,
    sidebar: logo,
    login: logo,
    footer: logo,
    favicon: logo,
  };

  const embedded = document.getElementById("lxp-layout-logo-map");
  try {
    const previous = JSON.parse(embedded?.textContent ?? "{}");
    if (typeof previous.__scope === "string") map.__scope = previous.__scope;
  } catch { /* keep the current preview when the SSR payload is unavailable */ }
  if (embedded) embedded.textContent = JSON.stringify(map);
  try {
    sessionStorage.setItem(LIVE_LOGOS_KEY, JSON.stringify(map));
  } catch {
    /* sessionStorage unavailable — live update still works on this page. */
  }

  document.querySelectorAll<HTMLImageElement>("img[data-lxp-logo-role]").forEach((img) => {
    if (!logo) return;
    void applyBrandedAsset(img, logo, map.__scope);
  });

  if (logo) {
    document
      .querySelectorAll("link[rel='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']")
      .forEach((el) => { void applyBrandedAsset(el, logo, map.__scope); });
  }
}

/** Collect every `layout_*` value from the hidden inputs (colors + radius +
 *  shadows + modal), so we can rebuild the full theme CSS client-side. */
export function currentLayoutSettings(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, elId] of Object.entries(FIELDS)) {
    if (!key.startsWith("layout_")) continue;
    const el = document.getElementById(elId) as HTMLInputElement | null;
    if (el) out[key] = el.value;
  }
  return out;
}

/** Rebuild the live theme from the current inputs (same builder the SSR runtime
 *  uses) and apply + persist it. Used by palette picks and radius/shadow edits. */
export function reapplyLiveTheme() {
  injectLivePaletteCss(buildLayoutCss(currentLayoutSettings()));
}

export interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string; // #rrggbb
  alpha: number;
}

/** Compose one layer to `${x}px ${y}px ${blur}px[ ${spread}px] rgba(r, g, b, a)`
 *  (the spread term is omitted when spread===0 so defaults round-trip cleanly). */
export function composeShadowLayer(l: ShadowLayer): string {
  const { r, g, b } = hexToRgb(l.color);
  const a = String(parseFloat(String(l.alpha)) || 0);
  const spreadTerm = l.spread !== 0 ? ` ${l.spread}px` : "";
  return `${l.x}px ${l.y}px ${l.blur}px${spreadTerm} rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Split a CSS string by top-level commas, ignoring commas inside `rgba(...)`. */
export function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of String(s ?? "")) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== "") out.push(cur);
  return out;
}

/** Parse one shadow layer string. Returns null if it does not look like a layer. */
export function parseShadowLayer(part: string): ShadowLayer | null {
  const str = String(part ?? "").trim();
  if (!str) return null;
  const colorMatch = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i.exec(str);
  if (!colorMatch) return null;
  const r = parseFloat(colorMatch[1]);
  const g = parseFloat(colorMatch[2]);
  const b = parseFloat(colorMatch[3]);
  const alpha = colorMatch[4] !== undefined ? parseFloat(colorMatch[4]) : 1;
  // Leading lengths before the color: <x>px <y>px <blur>px [<spread>px].
  const lengths = str
    .slice(0, colorMatch.index)
    .trim()
    .split(/\s+/)
    .map((tok) => parseFloat(tok))
    .filter((n) => !Number.isNaN(n));
  if (lengths.length < 3) return null;
  return {
    x: lengths[0],
    y: lengths[1],
    blur: lengths[2],
    spread: lengths.length >= 4 ? lengths[3] : 0,
    color: rgbToHex(r, g, b),
    alpha: Number.isNaN(alpha) ? 1 : alpha,
  };
}

/** Parse a full shadow canonical string into N layers (top-level comma split). */
export function parseShadowString(value: string): ShadowLayer[] {
  return splitTopLevelCommas(value)
    .map(parseShadowLayer)
    .filter((l): l is ShadowLayer => l !== null);
}

/** Mirror every `[data-range-readout]` value into its sibling `[data-range-output]`. */
export function wireRangeReadouts() {
  document.querySelectorAll<HTMLInputElement>("input[data-range-readout]").forEach((input) => {
    const out = input.closest("div")?.querySelector<HTMLElement>("[data-range-output]");
    if (!out) return;
    const sync = () => {
      out.textContent = input.value;
    };
    sync();
    input.addEventListener("input", sync);
  });
}

/** Bridge the visible radius slider <-> hidden canonical `#s-layout-radius` (`Nrem`). */
export function wireRadiusControl() {
  const hidden = document.getElementById("s-layout-radius") as HTMLInputElement | null;
  const slider = document.querySelector<HTMLInputElement>("input[data-radius-range]");
  const output = document.querySelector<HTMLElement>("[data-radius-output]");
  if (!hidden || !slider) return;
  slider.addEventListener("input", () => {
    hidden.value = `${slider.value}rem`;
    if (output) output.textContent = `${slider.value}rem`;
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Recompose a shadow canonical from its grouped sub-controls and re-dispatch `input`. */
export function recomposeShadowTarget(targetId: string) {
  const hidden = document.getElementById(targetId) as HTMLInputElement | null;
  if (!hidden) return;
  const controls = Array.from(
    document.querySelectorAll<HTMLInputElement>(`[data-shadow-target="${targetId}"]`),
  );
  if (controls.length === 0) return;

  if (targetId === "s-layout-modal-backdrop") {
    // Pure color: rgba(r, g, b, a) — color + alpha only, no offsets.
    const colorEl = controls.find((c) => c.dataset.shadowPart === "color");
    const alphaEl = controls.find((c) => c.dataset.shadowPart === "alpha");
    const { r, g, b } = hexToRgb(colorEl?.value ?? "#000000");
    const a = String(parseFloat(alphaEl?.value ?? "1") || 0);
    hidden.value = `rgba(${r}, ${g}, ${b}, ${a})`;
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  // Group by layer index, then compose each layer in order.
  const byLayer = new Map<number, ShadowLayer>();
  for (const c of controls) {
    const layer = parseInt(c.dataset.shadowLayer ?? "0", 10) || 0;
    const l =
      byLayer.get(layer) ??
      { x: 0, y: 0, blur: 0, spread: 0, color: "#000000", alpha: 1 };
    const part = c.dataset.shadowPart;
    if (part === "color") l.color = c.value;
    else if (part === "x") l.x = parseFloat(c.value) || 0;
    else if (part === "y") l.y = parseFloat(c.value) || 0;
    else if (part === "blur") l.blur = parseFloat(c.value) || 0;
    else if (part === "spread") l.spread = parseFloat(c.value) || 0;
    else if (part === "alpha") l.alpha = parseFloat(c.value) || 0;
    byLayer.set(layer, l);
  }
  const layers = Array.from(byLayer.keys())
    .sort((a, b) => a - b)
    .map((k) => composeShadowLayer(byLayer.get(k)!));
  hidden.value = layers.join(", ");
  hidden.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Wire every `[data-shadow-target]` sub-control to recompose its canonical on input. */
export function wireShadowControls() {
  const targets = new Set<string>();
  document.querySelectorAll<HTMLInputElement>("[data-shadow-target]").forEach((c) => {
    const t = c.dataset.shadowTarget;
    if (!t) return;
    targets.add(t);
    c.addEventListener("input", () => recomposeShadowTarget(t));
  });
  void targets;
}

/** Push one canonical shadow value into its grouped sub-controls (defensive). */
export function syncShadowControlsFromCanonical(targetId: string) {
  const hidden = document.getElementById(targetId) as HTMLInputElement | null;
  if (!hidden) return;
  const controls = Array.from(
    document.querySelectorAll<HTMLInputElement>(`[data-shadow-target="${targetId}"]`),
  );
  if (controls.length === 0) return;

  if (targetId === "s-layout-modal-backdrop") {
    const layer = parseShadowLayer(`0px 0px 0px ${hidden.value}`);
    if (!layer) return;
    for (const c of controls) {
      if (c.dataset.shadowPart === "color") c.value = layer.color;
      else if (c.dataset.shadowPart === "alpha") c.value = String(layer.alpha);
    }
    return;
  }

  const layers = parseShadowString(hidden.value);
  if (layers.length === 0) return;
  for (const c of controls) {
    const layerIdx = parseInt(c.dataset.shadowLayer ?? "0", 10) || 0;
    const l = layers[layerIdx];
    if (!l) continue;
    const part = c.dataset.shadowPart;
    if (part === "color") c.value = l.color;
    else if (part === "x") c.value = String(l.x);
    else if (part === "y") c.value = String(l.y);
    else if (part === "blur") c.value = String(l.blur);
    else if (part === "spread") c.value = String(l.spread);
    else if (part === "alpha") c.value = String(l.alpha);
  }
}

/** Re-sync all visible derived controls from the canonical inputs (load / palette /
 *  factory-reset). Refreshes range readouts too. Never throws on malformed values. */
export function syncDerivedControlsFromCanonical() {
  try {
    // Radius slider + readout from `Nrem`.
    const radius = document.getElementById("s-layout-radius") as HTMLInputElement | null;
    const slider = document.querySelector<HTMLInputElement>("input[data-radius-range]");
    const radiusOut = document.querySelector<HTMLElement>("[data-radius-output]");
    if (radius && slider) {
      const n = parseFloat(radius.value) || 0;
      slider.value = String(n);
      if (radiusOut) radiusOut.textContent = `${n}rem`;
    }

    for (const id of ["s-layout-shadow", "s-layout-modal-shadow", "s-layout-modal-backdrop"]) {
      syncShadowControlsFromCanonical(id);
    }

    // Refresh every range readout (covers Category B sliders + shadow sub-controls).
    document.querySelectorAll<HTMLInputElement>("input[data-range-readout]").forEach((input) => {
      const out = input.closest("div")?.querySelector<HTMLElement>("[data-range-output]");
      if (out) out.textContent = input.value;
    });
  } catch {
    // Defensive: malformed stored values must never break load/palette switch.
  }
}
