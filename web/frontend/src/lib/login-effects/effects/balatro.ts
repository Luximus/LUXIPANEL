// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const balatroEffect: LoginEffect = {
  "id": "balatro",
  "name": "Balatro",
  "label": "Balatro",
  "storagePrefix": "balatro",
  "props": [
    {
      "key": "color1",
      "storageKey": "layout_login_balatro_color1",
      "control": "color",
      "label": "Color 1",
      "default": "#DE443B"
    },
    {
      "key": "color2",
      "storageKey": "layout_login_balatro_color2",
      "control": "color",
      "label": "Color 2",
      "default": "#006BB4"
    },
    {
      "key": "color3",
      "storageKey": "layout_login_balatro_color3",
      "control": "color",
      "label": "Color 3",
      "default": "#162325"
    },
    {
      "key": "isRotate",
      "storageKey": "layout_login_balatro_is_rotate",
      "control": "checkbox",
      "label": "Rotate",
      "default": false
    },
    {
      "key": "mouseInteraction",
      "storageKey": "layout_login_balatro_mouse_interaction",
      "control": "checkbox",
      "label": "Enable Mouse Interaction",
      "default": true
    },
    {
      "key": "pixelFilter",
      "storageKey": "layout_login_balatro_pixel_filter",
      "control": "range",
      "label": "Pixelation",
      "min": 0,
      "max": 2000,
      "step": 10,
      "default": 745
    }
  ]
};
