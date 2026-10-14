// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const floatingLinesEffect: LoginEffect = {
  "id": "floating_lines",
  "name": "FloatingLines",
  "label": "Floating Lines",
  "storagePrefix": "floating_lines",
  "props": [
    {
      "key": "enabledWaves",
      "storageKey": "layout_login_floating_lines_enabled_waves",
      "control": "json",
      "label": "Enabled Waves",
      "default": "[\"top\",\"middle\",\"bottom\"]"
    },
    {
      "key": "lineCount",
      "storageKey": "layout_login_floating_lines_line_count",
      "control": "range",
      "label": "Line Count",
      "min": 1,
      "max": 20,
      "step": 1,
      "default": 8
    },
    {
      "key": "lineDistance",
      "storageKey": "layout_login_floating_lines_line_distance",
      "control": "range",
      "label": "Line Distance",
      "min": 1,
      "max": 100,
      "step": 0.5,
      "default": 8
    },
    {
      "key": "animationSpeed",
      "storageKey": "layout_login_floating_lines_animation_speed",
      "control": "range",
      "label": "Animation Speed",
      "min": 0.1,
      "max": 5,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "interactive",
      "storageKey": "layout_login_floating_lines_interactive",
      "control": "checkbox",
      "label": "Interactive",
      "default": true
    },
    {
      "key": "bendRadius",
      "storageKey": "layout_login_floating_lines_bend_radius",
      "control": "range",
      "label": "Bend Radius",
      "min": 1,
      "max": 30,
      "step": 0.5,
      "default": 8
    },
    {
      "key": "bendStrength",
      "storageKey": "layout_login_floating_lines_bend_strength",
      "control": "range",
      "label": "Bend Strength",
      "min": -15,
      "max": 15,
      "step": 0.5,
      "default": -2
    },
    {
      "key": "gradientStart",
      "storageKey": "layout_login_floating_lines_gradient_start",
      "control": "color",
      "label": "Gradient Start",
      "default": "#e945f5"
    },
    {
      "key": "gradientMid",
      "storageKey": "layout_login_floating_lines_gradient_mid",
      "control": "color",
      "label": "Gradient Mid",
      "default": "#6f6f6f"
    },
    {
      "key": "gradientEnd",
      "storageKey": "layout_login_floating_lines_gradient_end",
      "control": "color",
      "label": "Gradient End",
      "default": "#6a6a6a"
    }
  ]
};
