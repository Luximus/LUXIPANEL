// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const prismEffect: LoginEffect = {
  "id": "prism",
  "name": "Prism",
  "label": "Prism",
  "storagePrefix": "prism",
  "props": [
    {
      "key": "animationType",
      "storageKey": "layout_login_prism_animation_type",
      "control": "select",
      "label": "Animation Type",
      "options": [
        {
          "value": "rotate",
          "label": "Rotate"
        },
        {
          "value": "hover",
          "label": "Hover"
        },
        {
          "value": "3drotate",
          "label": "3D Rotate"
        }
      ],
      "default": "rotate"
    },
    {
      "key": "timeScale",
      "storageKey": "layout_login_prism_time_scale",
      "control": "range",
      "label": "Time Scale",
      "min": 0.1,
      "max": 2,
      "step": 0.1,
      "default": 0.5
    },
    {
      "key": "scale",
      "storageKey": "layout_login_prism_scale",
      "control": "range",
      "label": "Scale",
      "min": 1,
      "max": 5,
      "step": 0.1,
      "default": 3.6
    },
    {
      "key": "noise",
      "storageKey": "layout_login_prism_noise",
      "control": "range",
      "label": "Noise",
      "min": 0,
      "max": 1,
      "step": 0.05,
      "default": 0
    },
    {
      "key": "glow",
      "storageKey": "layout_login_prism_glow",
      "control": "range",
      "label": "Glow",
      "min": 0,
      "max": 3,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "height",
      "storageKey": "layout_login_prism_height",
      "control": "range",
      "label": "Height",
      "min": 1,
      "max": 8,
      "step": 0.1,
      "default": 3.5
    },
    {
      "key": "baseWidth",
      "storageKey": "layout_login_prism_base_width",
      "control": "range",
      "label": "Base Width",
      "min": 1,
      "max": 10,
      "step": 0.1,
      "default": 5.5
    },
    {
      "key": "hueShift",
      "storageKey": "layout_login_prism_hue_shift",
      "control": "range",
      "label": "Hue Shift",
      "min": -3.1416,
      "max": 3.1416,
      "step": 0.1,
      "default": 0
    },
    {
      "key": "colorFrequency",
      "storageKey": "layout_login_prism_color_frequency",
      "control": "range",
      "label": "Color Frequency",
      "min": 0.25,
      "max": 4,
      "step": 0.05,
      "default": 1
    }
  ]
};
