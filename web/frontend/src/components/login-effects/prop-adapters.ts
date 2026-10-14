// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Server-only. A few react-bits backgrounds don't take a flat 1:1 prop list,
// so after AuthLayout coerces the registry props into `{ [key]: value }` it
// runs the matching adapter (if any) to reshape them into the component's real
// props. Effects without an adapter get the coerced object spread as-is.
import { hyperspeedPresets } from "./HyperSpeedPresets.js";

export type LoginEffectAdapter = (v: Record<string, any>) => Record<string, any>;

export const LOGIN_EFFECT_PROP_ADAPTERS: Record<string, LoginEffectAdapter> = {
  aurora: ({ color1, color2, color3, ...rest }) => ({ ...rest, colorStops: [color1, color2, color3] }),
  gradient_blinds: ({ color1, color2, ...rest }) => ({ ...rest, gradientColors: [color1, color2] }),
  plasma_wave: ({ color1, color2, ...rest }) => ({ ...rest, colors: [color1, color2] }),
  liquid_ether: ({ color0, color1, color2, ...rest }) => ({ ...rest, colors: [color0, color1, color2] }),
  prismatic_burst: ({ color0, color1, color2, ...rest }) => ({ ...rest, colors: [color0, color1, color2] }),
  floating_lines: ({ gradientStart, gradientMid, gradientEnd, ...rest }) => ({
    ...rest, linesGradient: [gradientStart, gradientMid, gradientEnd],
  }),
  shape_grid: ({ size, hoverColor, ...rest }) => ({ ...rest, squareSize: size, hoverFillColor: hoverColor }),
  // 3 individual color settings -> the component's `glitchColors` array.
  letter_glitch: (v) => ({
    glitchColors: [v.color1, v.color2, v.color3],
    glitchSpeed: v.glitchSpeed,
    centerVignette: v.centerVignette,
    outerVignette: v.outerVignette,
    smooth: v.smooth,
    characters: v.characters,
  }),
  // preset name -> the component's large nested `effectOptions` object.
  hyperspeed: (v) => ({
    effectOptions: hyperspeedPresets[v.activePreset as keyof typeof hyperspeedPresets] ?? hyperspeedPresets.one,
  }),
  ferrofluid: ({ color1, color2, color3, ...rest }) => ({ ...rest, colors: [color1, color2, color3] }),
  lightfall: ({ color1, color2, color3, ...rest }) => ({ ...rest, colors: [color1, color2, color3] }),
};
