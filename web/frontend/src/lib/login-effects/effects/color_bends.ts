// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const colorBendsEffect: LoginEffect = {
  "id": "color_bends",
  "name": "ColorBends",
  "label": "Color Bends",
  "storagePrefix": "color_bends",
  "props": [
    {
      "key": "rotation",
      "storageKey": "layout_login_color_bends_rotation",
      "control": "range",
      "label": "Rotation (deg)",
      "min": -180,
      "max": 180,
      "step": 1,
      "default": 90
    },
    {
      "key": "autoRotate",
      "storageKey": "layout_login_color_bends_auto_rotate",
      "control": "range",
      "label": "Auto Rotate (deg/s)",
      "min": -5,
      "max": 5,
      "step": 1,
      "default": 0
    },
    {
      "key": "speed",
      "storageKey": "layout_login_color_bends_speed",
      "control": "range",
      "label": "Speed",
      "min": 0,
      "max": 1,
      "step": 0.01,
      "default": 0.2
    },
    {
      "key": "scale",
      "storageKey": "layout_login_color_bends_scale",
      "control": "range",
      "label": "Scale",
      "min": 0.2,
      "max": 5,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "frequency",
      "storageKey": "layout_login_color_bends_frequency",
      "control": "range",
      "label": "Frequency",
      "min": 0,
      "max": 5,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "warpStrength",
      "storageKey": "layout_login_color_bends_warp_strength",
      "control": "range",
      "label": "Warp Strength",
      "min": 0.9,
      "max": 1,
      "step": 0.005,
      "default": 1
    },
    {
      "key": "mouseInfluence",
      "storageKey": "layout_login_color_bends_mouse_influence",
      "control": "range",
      "label": "Mouse Influence",
      "min": 0,
      "max": 2,
      "step": 0.05,
      "default": 1
    },
    {
      "key": "parallax",
      "storageKey": "layout_login_color_bends_parallax",
      "control": "range",
      "label": "Parallax",
      "min": 0,
      "max": 2,
      "step": 0.05,
      "default": 0.5
    },
    {
      "key": "noise",
      "storageKey": "layout_login_color_bends_noise",
      "control": "range",
      "label": "Noise",
      "min": 0,
      "max": 1,
      "step": 0.01,
      "default": 0.15
    },
    {
      "key": "iterations",
      "storageKey": "layout_login_color_bends_iterations",
      "control": "range",
      "label": "Iterations",
      "min": 1,
      "max": 5,
      "step": 1,
      "default": 1
    },
    {
      "key": "intensity",
      "storageKey": "layout_login_color_bends_intensity",
      "control": "range",
      "label": "Intensity",
      "min": 0.1,
      "max": 2,
      "step": 0.1,
      "default": 1.5
    },
    {
      "key": "bandWidth",
      "storageKey": "layout_login_color_bends_band_width",
      "control": "range",
      "label": "Band Width",
      "min": 1,
      "max": 20,
      "step": 0.5,
      "default": 6
    },
    {
      "key": "color",
      "storageKey": "layout_login_color_bends_color",
      "control": "color",
      "label": "Color",
      "default": "#A855F7"
    }
  ]
};
