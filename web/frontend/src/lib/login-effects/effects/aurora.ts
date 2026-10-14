// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const auroraEffect: LoginEffect = {
  "id": "aurora",
  "name": "Aurora",
  "label": "Aurora",
  "storagePrefix": "aurora",
  "props": [
    {
      "key": "color1",
      "storageKey": "layout_login_aurora_color1",
      "control": "color",
      "label": "Color 1",
      "default": "#7cff67"
    },
    {
      "key": "color2",
      "storageKey": "layout_login_aurora_color2",
      "control": "color",
      "label": "Color 2",
      "default": "#B497CF"
    },
    {
      "key": "color3",
      "storageKey": "layout_login_aurora_color3",
      "control": "color",
      "label": "Color 3",
      "default": "#5227FF"
    },
    {
      "key": "speed",
      "storageKey": "layout_login_aurora_speed",
      "control": "range",
      "label": "Speed",
      "min": 0,
      "max": 2,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "blend",
      "storageKey": "layout_login_aurora_blend",
      "control": "range",
      "label": "Blend",
      "min": 0,
      "max": 1,
      "step": 0.01,
      "default": 0.5
    }
  ]
};
