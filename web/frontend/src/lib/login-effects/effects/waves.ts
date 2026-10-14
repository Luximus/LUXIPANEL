// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const wavesEffect: LoginEffect = {
  "id": "waves",
  "name": "Waves",
  "label": "Waves",
  "storagePrefix": "waves",
  "props": [
    {
      "key": "lineColor",
      "storageKey": "layout_login_waves_line_color",
      "control": "color",
      "label": "Line Color",
      "default": "#ffffff"
    },
    {
      "key": "waveSpeedX",
      "storageKey": "layout_login_waves_wave_speed_x",
      "control": "number",
      "label": "Wave Speed X",
      "default": 0.0125
    }
  ]
};
