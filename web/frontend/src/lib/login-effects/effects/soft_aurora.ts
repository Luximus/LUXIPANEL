// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const softAuroraEffect: LoginEffect = {
  "id": "soft_aurora",
  "name": "SoftAurora",
  "label": "Soft Aurora",
  "storagePrefix": "soft_aurora",
  "props": [
    {
      "key": "speed",
      "storageKey": "layout_login_soft_aurora_speed",
      "control": "range",
      "label": "Speed",
      "min": 0.1,
      "max": 5,
      "step": 0.1,
      "default": 0.6
    },
    {
      "key": "scale",
      "storageKey": "layout_login_soft_aurora_scale",
      "control": "range",
      "label": "Scale",
      "min": 0.1,
      "max": 3,
      "step": 0.1,
      "default": 1.5
    },
    {
      "key": "brightness",
      "storageKey": "layout_login_soft_aurora_brightness",
      "control": "range",
      "label": "Brightness",
      "min": 0.1,
      "max": 3,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "color1",
      "storageKey": "layout_login_soft_aurora_color1",
      "control": "color",
      "label": "Color 1",
      "default": "#f7f7f7"
    },
    {
      "key": "color2",
      "storageKey": "layout_login_soft_aurora_color2",
      "control": "color",
      "label": "Color 2",
      "default": "#e100ff"
    },
    {
      "key": "noiseFrequency",
      "storageKey": "layout_login_soft_aurora_noise_frequency",
      "control": "range",
      "label": "Noise Frequency",
      "min": 0.5,
      "max": 10,
      "step": 0.5,
      "default": 2.5
    },
    {
      "key": "noiseAmplitude",
      "storageKey": "layout_login_soft_aurora_noise_amplitude",
      "control": "range",
      "label": "Noise Amplitude",
      "min": 0.5,
      "max": 10,
      "step": 0.5,
      "default": 1
    },
    {
      "key": "bandHeight",
      "storageKey": "layout_login_soft_aurora_band_height",
      "control": "range",
      "label": "Band Height",
      "min": 0,
      "max": 1,
      "step": 0.05,
      "default": 0.5
    },
    {
      "key": "bandSpread",
      "storageKey": "layout_login_soft_aurora_band_spread",
      "control": "range",
      "label": "Band Spread",
      "min": 0.1,
      "max": 3,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "octaveDecay",
      "storageKey": "layout_login_soft_aurora_octave_decay",
      "control": "range",
      "label": "Octave Decay",
      "min": 0.01,
      "max": 0.5,
      "step": 0.01,
      "default": 0.1
    },
    {
      "key": "layerOffset",
      "storageKey": "layout_login_soft_aurora_layer_offset",
      "control": "range",
      "label": "Layer Offset",
      "min": 0,
      "max": 1,
      "step": 0.05,
      "default": 0
    },
    {
      "key": "colorSpeed",
      "storageKey": "layout_login_soft_aurora_color_speed",
      "control": "range",
      "label": "Color Speed",
      "min": 0.1,
      "max": 5,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "enableMouseInteraction",
      "storageKey": "layout_login_soft_aurora_enable_mouse_interaction",
      "control": "checkbox",
      "label": "Mouse Interaction",
      "default": true
    },
    {
      "key": "mouseInfluence",
      "storageKey": "layout_login_soft_aurora_mouse_influence",
      "control": "range",
      "label": "Mouse Influence",
      "min": 0.1,
      "max": 1,
      "step": 0.05,
      "default": 0.25
    }
  ]
};
