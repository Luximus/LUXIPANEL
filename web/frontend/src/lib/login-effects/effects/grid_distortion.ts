// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const gridDistortionEffect: LoginEffect = {
  "id": "grid_distortion",
  "name": "GridDistortion",
  "label": "Grid Distortion",
  "storagePrefix": "grid_distortion",
  "props": [
    {
      "key": "grid",
      "storageKey": "layout_login_grid_distortion_grid",
      "control": "range",
      "label": "Grid Size",
      "min": 6,
      "max": 200,
      "step": 1,
      "default": 10
    },
    {
      "key": "mouse",
      "storageKey": "layout_login_grid_distortion_mouse",
      "control": "range",
      "label": "Mouse Size",
      "min": 0.1,
      "max": 0.5,
      "step": 0.01,
      "default": 0.25
    }
  ]
};
