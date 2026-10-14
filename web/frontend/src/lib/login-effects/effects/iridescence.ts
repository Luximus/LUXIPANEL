// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const iridescenceEffect: LoginEffect = {
  "id": "iridescence",
  "name": "Iridescence",
  "label": "Iridescence",
  "storagePrefix": "iridescence",
  "props": [
    {
      "key": "color",
      "storageKey": "layout_login_iridescence_color",
      "control": "rgb01",
      "label": "Color",
      "default": "#8099cc"
    },
    {
      "key": "speed",
      "storageKey": "layout_login_iridescence_speed",
      "control": "number",
      "label": "Speed",
      "default": 1
    },
    {
      "key": "mouseReact",
      "storageKey": "layout_login_iridescence_mouse_react",
      "control": "checkbox",
      "label": "Mouse React",
      "default": true
    }
  ]
};
