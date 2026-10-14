// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const silkEffect: LoginEffect = {
  "id": "silk",
  "name": "Silk",
  "label": "Silk",
  "storagePrefix": "silk",
  "props": [
    {
      "key": "speed",
      "storageKey": "layout_login_silk_speed",
      "control": "range",
      "label": "Speed",
      "min": 0.1,
      "max": 20,
      "step": 0.1,
      "default": 5
    },
    {
      "key": "scale",
      "storageKey": "layout_login_silk_scale",
      "control": "range",
      "label": "Scale",
      "min": 0.1,
      "max": 5,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "color",
      "storageKey": "layout_login_silk_color",
      "control": "color",
      "label": "Color",
      "default": "#5227FF"
    },
    {
      "key": "noiseIntensity",
      "storageKey": "layout_login_silk_noise_intensity",
      "control": "range",
      "label": "Noise Intensity",
      "min": 0,
      "max": 10,
      "step": 0.1,
      "default": 1.5
    },
    {
      "key": "rotation",
      "storageKey": "layout_login_silk_rotation",
      "control": "range",
      "label": "Rotation",
      "min": 0,
      "max": 6.2832,
      "step": 0.01,
      "default": 0
    }
  ]
};
