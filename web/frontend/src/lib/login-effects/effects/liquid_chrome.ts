// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const liquidChromeEffect: LoginEffect = {
  "id": "liquid_chrome",
  "name": "LiquidChrome",
  "label": "Liquid Chrome",
  "storagePrefix": "liquid_chrome",
  "props": [
    {
      "key": "speed",
      "storageKey": "layout_login_liquid_chrome_speed",
      "control": "range",
      "label": "Speed",
      "min": 0,
      "max": 5,
      "step": 0.01,
      "default": 0.3
    },
    {
      "key": "baseColor",
      "storageKey": "layout_login_liquid_chrome_base_color",
      "control": "rgb01",
      "label": "Base Color",
      "default": "#1a1a1a"
    },
    {
      "key": "interactive",
      "storageKey": "layout_login_liquid_chrome_interactive",
      "control": "checkbox",
      "label": "Enable Interaction",
      "default": true
    },
    {
      "key": "amplitude",
      "storageKey": "layout_login_liquid_chrome_amplitude",
      "control": "range",
      "label": "Amplitude",
      "min": 0.1,
      "max": 1,
      "step": 0.01,
      "default": 0.3
    }
  ]
};
