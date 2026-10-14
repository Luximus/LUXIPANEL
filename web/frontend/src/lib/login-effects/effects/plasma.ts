// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const plasmaEffect: LoginEffect = {
  "id": "plasma",
  "name": "Plasma",
  "label": "Plasma",
  "storagePrefix": "plasma",
  "props": [
    {
      "key": "color",
      "storageKey": "layout_login_plasma_color",
      "control": "color",
      "label": "Color",
      "default": "#B497CF"
    },
    {
      "key": "speed",
      "storageKey": "layout_login_plasma_speed",
      "control": "range",
      "label": "Speed",
      "min": 0.1,
      "max": 3,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "direction",
      "storageKey": "layout_login_plasma_direction",
      "control": "select",
      "label": "Direction",
      "options": [
        {
          "value": "forward",
          "label": "Forward"
        },
        {
          "value": "reverse",
          "label": "Reverse"
        },
        {
          "value": "pingpong",
          "label": "Ping Pong"
        }
      ],
      "default": "forward"
    },
    {
      "key": "scale",
      "storageKey": "layout_login_plasma_scale",
      "control": "range",
      "label": "Scale",
      "min": 0.5,
      "max": 3,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "opacity",
      "storageKey": "layout_login_plasma_opacity",
      "control": "range",
      "label": "Opacity",
      "min": 0.1,
      "max": 1,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "mouseInteractive",
      "storageKey": "layout_login_plasma_mouse_interactive",
      "control": "checkbox",
      "label": "Mouse Interactive",
      "default": false
    }
  ]
};
