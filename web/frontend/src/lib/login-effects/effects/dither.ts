// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const ditherEffect: LoginEffect = {
  "id": "dither",
  "name": "Dither",
  "label": "Dither",
  "storagePrefix": "dither",
  "props": [
    {
      "key": "waveColor",
      "storageKey": "layout_login_dither_wave_color",
      "control": "rgb01",
      "label": "Wave Color",
      "default": "#808080"
    },
    {
      "key": "mouseRadius",
      "storageKey": "layout_login_dither_mouse_radius",
      "control": "range",
      "label": "Mouse Radius",
      "min": 0,
      "max": 2,
      "step": 0.1,
      "default": 0.3
    },
    {
      "key": "colorNum",
      "storageKey": "layout_login_dither_color_num",
      "control": "range",
      "label": "Color Intensity",
      "min": 2.5,
      "max": 40,
      "step": 0.1,
      "default": 4
    },
    {
      "key": "waveAmplitude",
      "storageKey": "layout_login_dither_wave_amplitude",
      "control": "range",
      "label": "Wave Amplitude",
      "min": 0,
      "max": 1,
      "step": 0.01,
      "default": 0.3
    },
    {
      "key": "waveFrequency",
      "storageKey": "layout_login_dither_wave_frequency",
      "control": "range",
      "label": "Wave Frequency",
      "min": 0,
      "max": 10,
      "step": 0.1,
      "default": 3
    },
    {
      "key": "waveSpeed",
      "storageKey": "layout_login_dither_wave_speed",
      "control": "range",
      "label": "Wave Speed",
      "min": 0,
      "max": 0.1,
      "step": 0.01,
      "default": 0.05
    },
    {
      "key": "enableMouseInteraction",
      "storageKey": "layout_login_dither_enable_mouse_interaction",
      "control": "checkbox",
      "label": "Mouse Interaction",
      "default": true
    },
    {
      "key": "disableAnimation",
      "storageKey": "layout_login_dither_disable_animation",
      "control": "checkbox",
      "label": "Disable Animation",
      "default": false
    }
  ]
};
