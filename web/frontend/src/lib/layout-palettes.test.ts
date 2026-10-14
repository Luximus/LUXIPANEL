// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import {
  buildCustomLayoutPalette,
  DEFAULT_CUSTOM_LAYOUT_COLOR,
  LAYOUT_COLOR_KEYS,
  LAYOUT_PALETTES,
  paletteToSettings,
} from "./layout-palettes";

function rgbFromHex(hex: string) {
  const value = parseInt(hex.slice(1), 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

describe("LAYOUT_PALETTES", () => {
  it("every palette has a complete light & dark color map", () => {
    for (const p of LAYOUT_PALETTES) {
      for (const k of LAYOUT_COLOR_KEYS) {
        expect(p.light[k], `${p.id} light.${k}`).toMatch(/^#[0-9a-f]{6}$/i);
        expect(p.dark[k], `${p.id} dark.${k}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("palette ids are unique", () => {
    const ids = LAYOUT_PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("paletteToSettings", () => {
  it("flattens into layout_{light,dark}_<key> keys", () => {
    const palette = LAYOUT_PALETTES.find((p) => p.id === "custom")!;
    const flat = paletteToSettings(palette);
    // 2 modes * number of color keys
    expect(Object.keys(flat).length).toBe(LAYOUT_COLOR_KEYS.length * 2);
    expect(flat.layout_light_primary).toBe(palette.light.primary);
    expect(flat.layout_dark_primary).toBe(palette.dark.primary);
  });
});

describe("buildCustomLayoutPalette", () => {
  it("builds a customizable palette from a provided base color", () => {
    const custom = buildCustomLayoutPalette("#ff6600");
    expect(custom.id).toBe("custom");
    expect(custom.customizable).toBe(true);
    expect(custom.light.primary).toBe("#ff6600");
    expect(custom.dark.primary).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("falls back to the default custom color for malformed input", () => {
    const custom = buildCustomLayoutPalette("bad-color");
    expect(custom.light.primary).toBe(DEFAULT_CUSTOM_LAYOUT_COLOR);
  });

  it("keeps light surfaces mostly neutral so the theme does not flood whites", () => {
    const custom = buildCustomLayoutPalette("#22c55e");
    const background = rgbFromHex(custom.light.background);
    const muted = rgbFromHex(custom.light.muted);
    const card = rgbFromHex(custom.light.card);
    expect(background.r).toBeGreaterThanOrEqual(240);
    expect(background.g).toBeGreaterThanOrEqual(245);
    expect(background.b).toBeGreaterThanOrEqual(245);
    expect(muted.r).toBeGreaterThanOrEqual(232);
    expect(muted.g).toBeGreaterThanOrEqual(238);
    expect(muted.b).toBeGreaterThanOrEqual(238);
    expect(card).toEqual({ r: 255, g: 255, b: 255 });
  });
});
