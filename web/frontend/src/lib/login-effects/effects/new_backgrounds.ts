// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Settings schemas for the React Bits backgrounds added in the 2026 catalog.
// Keep only useful, safe controls: Grid Scan never enables its webcam here.
import type { LoginEffect, LoginEffectProp } from "../types";

type Spec = Omit<LoginEffectProp, "storageKey">;
const color = (key: string, label: string, value: string): Spec => ({ key, label, control: "color", default: value });
const range = (key: string, label: string, value: number, min: number, max: number, step = 0.1): Spec =>
  ({ key, label, control: "range", default: value, min, max, step });
const toggle = (key: string, label: string, value: boolean): Spec => ({ key, label, control: "checkbox", default: value });
const select = (key: string, label: string, value: string, values: string[]): Spec => ({
  key, label, control: "select", default: value,
  options: values.map((v) => ({ value: v, label: v.replace(/(^|-)([a-z])/g, (_, dash: string, letter: string) => `${dash ? " " : ""}${letter.toUpperCase()}`) })),
});
function effect(id: string, name: string, props: Spec[]): LoginEffect {
  return {
    id, name, label: name, storagePrefix: id,
    requiresWebGpu: id === "aero_shards" || id === "shape_waves",
    props: props.map((p) => ({ ...p, storageKey: `layout_login_${id}_${p.key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}` })),
  };
}

export const NEW_LOGIN_EFFECTS: LoginEffect[] = [
  effect("acid_squares", "Acid Squares", [
    color("color1", "Color 1", "#5227FF"), color("color2", "Color 2", "#A855F7"), color("color3", "Color 3", "#FFFFFF"),
    select("detail", "Detail", "medium", ["low", "medium", "high"]), range("speed", "Speed", 0.7, 0, 2),
    range("zoom", "Zoom", 1.3, 0.5, 3), range("glow", "Glow", 1, 0, 3), toggle("mouseInteraction", "Respond to pointer", true),
  ]),
  effect("aero_shards", "Aero Shards", [
    color("backgroundColor", "Background", "#120F17"), color("shardColor", "Shards", "#896ABD"), color("accentColor", "Accent", "#A855F7"),
    select("placement", "Placement", "full", ["left", "center", "right", "full"]),
    select("flow", "Flow", "stream", ["stream", "vortex", "ribbon"]),
    select("material", "Material", "pearl", ["pearl", "chrome", "satin"]),
    range("speed", "Speed", 1, 0, 2), range("density", "Density", 1.5, 0.2, 3), range("bloom", "Bloom", 0.5, 0, 2),
  ]),
  effect("crt_warp", "CRT Warp", [
    color("color", "Glow color", "#c755f7"), color("backgroundColor", "Background", "#05010a"),
    range("speed", "Speed", 0.5, 0, 2), range("curvature", "Curvature", 0.25, 0, 1, 0.01),
    range("scanlineStrength", "Scanlines", 0.25, 0, 1, 0.01), range("bloom", "Bloom", 1.5, 0, 3),
    range("pixelation", "Pixelation", 1, 1, 8, 1), toggle("mouseReact", "Respond to pointer", true),
  ]),
  effect("ferrofluid", "Ferrofluid", [
    color("color1", "Color 1", "#FFFFFF"), color("color2", "Color 2", "#FFFFFF"), color("color3", "Color 3", "#FFFFFF"),
    range("speed", "Speed", 0.5, 0, 2), range("scale", "Scale", 1.6, 0.5, 4),
    range("turbulence", "Turbulence", 1, 0, 3), range("glow", "Glow", 2, 0, 4), toggle("mouseInteraction", "Respond to pointer", true),
  ]),
  effect("ghost_fibers", "Ghost Fibers", [
    color("lineColor", "Fibers", "#140E35"), color("glowColor", "Glow", "#3437A0"),
    range("speed", "Speed", 0.2, 0, 2), range("scale", "Scale", 2, 0.5, 4),
    range("layers", "Layers", 4, 1, 8, 1), range("glowIntensity", "Glow intensity", 1.6, 0, 4),
  ]),
  effect("gradient_waves", "Gradient Waves", [
    color("horizonColor", "Horizon", "#5227FF"), color("waveColor", "Waves", "#FF9FFC"), color("crestColor", "Crests", "#FFFFFF"),
    range("speed", "Speed", 0.4, 0, 2), range("amplitude", "Height", 2.5, 0.2, 5),
    range("waveScale", "Scale", 0.6, 0.2, 2), toggle("mouseInteraction", "Respond to pointer", true),
  ]),
  effect("grid_scan", "Grid Scan", [
    color("linesColor", "Grid", "#2F293A"), color("scanColor", "Scan", "#FF9FFC"),
    range("scanOpacity", "Scan opacity", 0.4, 0, 1, 0.01), range("gridScale", "Grid scale", 0.1, 0.02, 0.5, 0.01),
    select("scanDirection", "Direction", "pingpong", ["forward", "backward", "pingpong"]),
    range("scanDuration", "Duration", 2, 0.5, 8), toggle("scanOnClick", "Scan on click", false),
  ]),
  effect("light_tunnel", "Light Tunnel", [
    color("cableColor", "Cables", "#A855F7"), color("pulseColor", "Pulse", "#A855F7"), color("tunnelColor", "Tunnel", "#5227FF"),
    range("speed", "Speed", 0.1, 0, 2), range("cableCount", "Cables", 20, 4, 48, 1),
    range("glow", "Glow", 1, 0, 3), select("flowDirection", "Flow", "outward", ["inward", "outward"]),
  ]),
  effect("lightfall", "Lightfall", [
    color("color1", "Color 1", "#A6C8FF"), color("color2", "Color 2", "#5227FF"), color("color3", "Color 3", "#FF9FFC"),
    color("backgroundColor", "Background", "#0A29FF"), range("speed", "Speed", 0.5, 0, 2),
    range("streakCount", "Streaks", 2, 1, 8, 1), range("glow", "Glow", 1, 0, 3),
  ]),
  effect("molten_metal", "Molten Metal", [
    color("color1", "Color 1", "#5227FF"), color("color2", "Color 2", "#FF9FFC"), color("color3", "Color 3", "#FFFFFF"),
    select("colorMode", "Palette", "molten", ["molten", "ember", "frost"]),
    range("speed", "Speed", 0.35, 0, 2), range("scale", "Scale", 4, 1, 8), range("glow", "Glow", 1.6, 0, 4),
  ]),
  effect("scanner", "Scanner", [
    color("color1", "Color 1", "#5227FF"), color("color2", "Color 2", "#FF9FFC"), color("color3", "Color 3", "#FFFFFF"),
    range("speed", "Speed", 0.5, 0, 2), range("sweepSpeed", "Sweep", 0.25, 0, 2),
    select("scanDirection", "Direction", "vertical", ["vertical", "horizontal", "diagonal"]), toggle("scanline", "Scanlines", true),
  ]),
  effect("shape_waves", "Shape Waves", [
    color("color", "Shapes", "#929292"), color("hoverColor", "Pointer color", "#FFFFFF"), color("backgroundColor", "Background", "#000000"),
    select("shapes", "Shapes", "mixed", ["mixed", "circles", "squares", "triangles"]),
    range("speed", "Speed", 1, 0, 2), range("cellSize", "Cell size", 10, 4, 24, 1),
    range("brightness", "Brightness", 0.4, 0, 2), toggle("interactive", "Respond to pointer", true),
  ]),
  effect("side_rays", "Side Rays", [
    color("rayColor1", "Ray 1", "#EAB308"), color("rayColor2", "Ray 2", "#96c8ff"),
    select("origin", "Origin", "top-right", ["top-left", "top-right", "bottom-left", "bottom-right"]),
    range("speed", "Speed", 2.5, 0, 5), range("intensity", "Intensity", 2, 0, 4),
    range("spread", "Spread", 2, 0.5, 4), range("opacity", "Opacity", 1, 0, 1, 0.01),
  ]),
  effect("sliced_waves", "Sliced Waves", [
    color("color1", "Color 1", "#FF9FFC"), color("color2", "Color 2", "#5227FF"), color("color3", "Color 3", "#B497CF"),
    range("columns", "Columns", 14, 4, 32, 1), range("rows", "Rows", 8, 2, 20, 1),
    range("speed", "Speed", 0.35, 0, 2), select("orientation", "Orientation", "horizontal", ["horizontal", "vertical"]),
    toggle("alternate", "Alternate slices", false),
  ]),
  effect("topography", "Topography", [
    color("lowColor", "Low", "#5227FF"), color("midColor", "Mid", "#FF9FFC"), color("highColor", "High", "#FFFFFF"),
    range("speed", "Speed", 0.35, 0, 2), range("bands", "Bands", 2, 0.5, 8),
    range("thickness", "Line thickness", 0.01, 0.001, 0.08, 0.001),
    select("colorMode", "Palette", "elevation", ["elevation", "uniform", "alternating"]), toggle("fillBands", "Fill bands", false),
  ]),
  effect("web_threads", "Web Threads", [
    color("color1", "Color 1", "#5227FF"), color("color2", "Color 2", "#FF9FFC"), color("color3", "Color 3", "#FFFFFF"),
    range("speed", "Speed", 0.2, 0, 2), range("threadCount", "Threads", 6, 2, 20, 1),
    select("fanMode", "Layout", "center", ["center", "left", "right"]), toggle("mirror", "Mirror", true),
    toggle("shimmer", "Shimmer", false),
  ]),
];
