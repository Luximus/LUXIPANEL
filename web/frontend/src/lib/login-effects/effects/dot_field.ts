// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const dotFieldEffect: LoginEffect = {
  "id": "dot_field",
  "name": "DotField",
  "label": "Dot Field",
  "storagePrefix": "dot_field",
  "props": [
    {
      "key": "dotRadius",
      "storageKey": "layout_login_dot_field_dot_radius",
      "control": "number",
      "label": "Dot Radius",
      "default": 1.5
    },
    {
      "key": "dotSpacing",
      "storageKey": "layout_login_dot_field_dot_spacing",
      "control": "number",
      "label": "Dot Spacing",
      "default": 14
    },
    {
      "key": "cursorRadius",
      "storageKey": "layout_login_dot_field_cursor_radius",
      "control": "number",
      "label": "Cursor Radius",
      "default": 500
    },
    {
      "key": "cursorForce",
      "storageKey": "layout_login_dot_field_cursor_force",
      "control": "number",
      "label": "Cursor Force",
      "default": 0.1
    },
    {
      "key": "bulgeOnly",
      "storageKey": "layout_login_dot_field_bulge_only",
      "control": "checkbox",
      "label": "Bulge Only",
      "default": true
    },
    {
      "key": "bulgeStrength",
      "storageKey": "layout_login_dot_field_bulge_strength",
      "control": "number",
      "label": "Bulge Strength",
      "default": 67
    },
    {
      "key": "glowRadius",
      "storageKey": "layout_login_dot_field_glow_radius",
      "control": "number",
      "label": "Glow Radius",
      "default": 160
    },
    {
      "key": "sparkle",
      "storageKey": "layout_login_dot_field_sparkle",
      "control": "checkbox",
      "label": "Sparkle",
      "default": false
    },
    {
      "key": "waveAmplitude",
      "storageKey": "layout_login_dot_field_wave_amplitude",
      "control": "number",
      "label": "Wave Amplitude",
      "default": 0
    },
    {
      "key": "gradientFrom",
      "storageKey": "layout_login_dot_field_gradient_from",
      "control": "color",
      "label": "Gradient From",
      "default": "#A855F7"
    },
    {
      "key": "gradientTo",
      "storageKey": "layout_login_dot_field_gradient_to",
      "control": "color",
      "label": "Gradient To",
      "default": "#B497CF"
    },
    {
      "key": "glowColor",
      "storageKey": "layout_login_dot_field_glow_color",
      "control": "color",
      "label": "Glow Color",
      "default": "#120F17"
    }
  ]
};
