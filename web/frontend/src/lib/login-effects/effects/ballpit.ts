// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const ballpitEffect: LoginEffect = {
  "id": "ballpit",
  "name": "Ballpit",
  "label": "Ballpit",
  "storagePrefix": "ballpit",
  "props": [
    {
      "key": "count",
      "storageKey": "layout_login_ballpit_count",
      "control": "range",
      "label": "Ball Count",
      "min": 50,
      "max": 500,
      "step": 10,
      "default": 100
    },
    {
      "key": "gravity",
      "storageKey": "layout_login_ballpit_gravity",
      "control": "range",
      "label": "Gravity",
      "min": 0,
      "max": 1,
      "step": 0.1,
      "default": 0.01
    },
    {
      "key": "friction",
      "storageKey": "layout_login_ballpit_friction",
      "control": "range",
      "label": "Friction",
      "min": 0.9,
      "max": 1,
      "step": 0.001,
      "default": 0.9975
    },
    {
      "key": "wallBounce",
      "storageKey": "layout_login_ballpit_wall_bounce",
      "control": "range",
      "label": "Wall Bounce",
      "min": 0.5,
      "max": 1,
      "step": 0.05,
      "default": 0.95
    },
    {
      "key": "followCursor",
      "storageKey": "layout_login_ballpit_follow_cursor",
      "control": "checkbox",
      "label": "Display Cursor",
      "default": false
    }
  ]
};
