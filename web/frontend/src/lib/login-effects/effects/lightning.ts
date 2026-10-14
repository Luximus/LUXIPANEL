// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const lightningEffect: LoginEffect = {
  "id": "lightning",
  "name": "Lightning",
  "label": "Lightning",
  "storagePrefix": "lightning",
  "props": [
    {
      "key": "hue",
      "storageKey": "layout_login_lightning_hue",
      "control": "range",
      "label": "Hue",
      "min": 0,
      "max": 360,
      "step": 1,
      "default": 260
    },
    {
      "key": "xOffset",
      "storageKey": "layout_login_lightning_x_offset",
      "control": "range",
      "label": "X Offset",
      "min": -2,
      "max": 2,
      "step": 0.1,
      "default": 0
    },
    {
      "key": "speed",
      "storageKey": "layout_login_lightning_speed",
      "control": "range",
      "label": "Speed",
      "min": 0.5,
      "max": 2,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "intensity",
      "storageKey": "layout_login_lightning_intensity",
      "control": "range",
      "label": "Intensity",
      "min": 0.1,
      "max": 2,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "size",
      "storageKey": "layout_login_lightning_size",
      "control": "range",
      "label": "Size",
      "min": 0.1,
      "max": 3,
      "step": 0.1,
      "default": 1
    }
  ]
};
