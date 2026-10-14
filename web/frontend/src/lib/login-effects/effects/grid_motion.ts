// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const gridMotionEffect: LoginEffect = {
  "id": "grid_motion",
  "name": "GridMotion",
  "label": "Grid Motion",
  "storagePrefix": "grid_motion",
  "props": [
    {
      "key": "items",
      "storageKey": "layout_login_grid_motion_items",
      "control": "items",
      "label": "Items",
      "default": "[]"
    },
    {
      "key": "gradientColor",
      "storageKey": "layout_login_grid_motion_gradient_color",
      "control": "color",
      "label": "Gradient Color",
      "default": "#000000"
    }
  ]
};
