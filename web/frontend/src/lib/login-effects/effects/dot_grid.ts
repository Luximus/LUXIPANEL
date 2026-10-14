// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const dotGridEffect: LoginEffect = {
  "id": "dot_grid",
  "name": "DotGrid",
  "label": "Dot Grid",
  "storagePrefix": "dot_grid",
  "props": [
    {
      "key": "dotSize",
      "storageKey": "layout_login_dot_grid_dot_size",
      "control": "range",
      "label": "Dot Size",
      "min": 2,
      "max": 50,
      "step": 1,
      "default": 5
    },
    {
      "key": "gap",
      "storageKey": "layout_login_dot_grid_gap",
      "control": "range",
      "label": "Gap",
      "min": 5,
      "max": 100,
      "step": 1,
      "default": 15
    },
    {
      "key": "baseColor",
      "storageKey": "layout_login_dot_grid_base_color",
      "control": "color",
      "label": "Base Color",
      "default": "#2F293A"
    },
    {
      "key": "activeColor",
      "storageKey": "layout_login_dot_grid_active_color",
      "control": "color",
      "label": "Active Color",
      "default": "#5227FF"
    },
    {
      "key": "proximity",
      "storageKey": "layout_login_dot_grid_proximity",
      "control": "range",
      "label": "Proximity",
      "min": 50,
      "max": 500,
      "step": 10,
      "default": 120
    },
    {
      "key": "shockRadius",
      "storageKey": "layout_login_dot_grid_shock_radius",
      "control": "range",
      "label": "Shock Radius",
      "min": 50,
      "max": 500,
      "step": 10,
      "default": 250
    },
    {
      "key": "shockStrength",
      "storageKey": "layout_login_dot_grid_shock_strength",
      "control": "range",
      "label": "Shock Strength",
      "min": 1,
      "max": 20,
      "step": 1,
      "default": 5
    },
    {
      "key": "resistance",
      "storageKey": "layout_login_dot_grid_resistance",
      "control": "range",
      "label": "Resistance (Inertia)",
      "min": 100,
      "max": 2000,
      "step": 50,
      "default": 750
    },
    {
      "key": "returnDuration",
      "storageKey": "layout_login_dot_grid_return_duration",
      "control": "range",
      "label": "Return Duration (Inertia)",
      "min": 0.1,
      "max": 5,
      "step": 0.1,
      "default": 1.5
    }
  ]
};
