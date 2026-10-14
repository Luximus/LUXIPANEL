// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const lineWavesEffect: LoginEffect = {
  "id": "line_waves",
  "name": "LineWaves",
  "label": "Line Waves",
  "storagePrefix": "linewaves",
  "props": [
    {
      "key": "speed",
      "storageKey": "layout_login_linewaves_speed",
      "control": "range",
      "label": "Speed",
      "min": 0.1,
      "max": 3,
      "step": 0.1,
      "default": 0.3
    },
    {
      "key": "innerLineCount",
      "storageKey": "layout_login_linewaves_inner_line_count",
      "control": "range",
      "label": "Inner Line Count",
      "min": 2,
      "max": 120,
      "step": 1,
      "default": 40
    },
    {
      "key": "outerLineCount",
      "storageKey": "layout_login_linewaves_outer_line_count",
      "control": "range",
      "label": "Outer Line Count",
      "min": 2,
      "max": 120,
      "step": 1,
      "default": 36
    },
    {
      "key": "warpIntensity",
      "storageKey": "layout_login_linewaves_warp_intensity",
      "control": "range",
      "label": "Warp Intensity",
      "min": 0.1,
      "max": 3,
      "step": 0.1,
      "default": 1.3
    },
    {
      "key": "rotation",
      "storageKey": "layout_login_linewaves_rotation",
      "control": "range",
      "label": "Rotation",
      "min": -180,
      "max": 180,
      "step": 1,
      "default": -19
    },
    {
      "key": "edgeFadeWidth",
      "storageKey": "layout_login_linewaves_edge_fade_width",
      "control": "range",
      "label": "Edge Fade Width",
      "min": 0,
      "max": 1,
      "step": 0.05,
      "default": 0.15
    },
    {
      "key": "colorCycleSpeed",
      "storageKey": "layout_login_linewaves_color_cycle_speed",
      "control": "range",
      "label": "Color Cycle Speed",
      "min": 0.1,
      "max": 5,
      "step": 0.1,
      "default": 0.9
    },
    {
      "key": "brightness",
      "storageKey": "layout_login_linewaves_brightness",
      "control": "range",
      "label": "Brightness",
      "min": 0.1,
      "max": 3,
      "step": 0.1,
      "default": 0.4
    },
    {
      "key": "color1",
      "storageKey": "layout_login_linewaves_color1",
      "control": "color",
      "label": "Color 1",
      "default": "#1c96e9"
    },
    {
      "key": "color2",
      "storageKey": "layout_login_linewaves_color2",
      "control": "color",
      "label": "Color 2",
      "default": "#8011dd"
    },
    {
      "key": "color3",
      "storageKey": "layout_login_linewaves_color3",
      "control": "color",
      "label": "Color 3",
      "default": "#11dc2d"
    },
    {
      "key": "enableMouseInteraction",
      "storageKey": "layout_login_linewaves_enable_mouse_interaction",
      "control": "checkbox",
      "label": "Mouse Interaction",
      "default": true
    },
    {
      "key": "mouseInfluence",
      "storageKey": "layout_login_linewaves_mouse_influence",
      "control": "range",
      "label": "Mouse Influence",
      "min": 0.1,
      "max": 2,
      "step": 0.1,
      "default": 2
    }
  ]
};
