// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const darkVeilEffect: LoginEffect = {
  "id": "dark_veil",
  "name": "DarkVeil",
  "label": "Dark Veil",
  "storagePrefix": "dark_veil",
  "props": [
    {
      "key": "hueShift",
      "storageKey": "layout_login_dark_veil_hue_shift",
      "control": "range",
      "label": "Hue Shift",
      "min": 0,
      "max": 360,
      "step": 1,
      "default": 0
    },
    {
      "key": "noiseIntensity",
      "storageKey": "layout_login_dark_veil_noise_intensity",
      "control": "range",
      "label": "Noise Intensity",
      "min": 0,
      "max": 0.2,
      "step": 0.01,
      "default": 0
    },
    {
      "key": "scanlineIntensity",
      "storageKey": "layout_login_dark_veil_scanline_intensity",
      "control": "range",
      "label": "Scanline Intensity",
      "min": 0,
      "max": 1,
      "step": 0.01,
      "default": 0
    },
    {
      "key": "speed",
      "storageKey": "layout_login_dark_veil_speed",
      "control": "range",
      "label": "Speed",
      "min": 0,
      "max": 3,
      "step": 0.1,
      "default": 0.5
    },
    {
      "key": "scanlineFrequency",
      "storageKey": "layout_login_dark_veil_scanline_frequency",
      "control": "range",
      "label": "Scanline Frequency",
      "min": 0.5,
      "max": 5,
      "step": 0.1,
      "default": 0
    },
    {
      "key": "warpAmount",
      "storageKey": "layout_login_dark_veil_warp_amount",
      "control": "range",
      "label": "Warp Amount",
      "min": 0,
      "max": 5,
      "step": 0.1,
      "default": 0
    }
  ]
};
