// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const rippleGridEffect: LoginEffect = {
  "id": "ripple_grid",
  "name": "RippleGrid",
  "label": "Ripple Grid",
  "storagePrefix": "ripple_grid",
  "props": [
    {
      "key": "enableRainbow",
      "storageKey": "layout_login_ripple_grid_enable_rainbow",
      "control": "checkbox",
      "label": "Enable Rainbow",
      "default": false
    },
    {
      "key": "gridColor",
      "storageKey": "layout_login_ripple_grid_grid_color",
      "control": "color",
      "label": "Grid Color",
      "default": "#5227FF"
    },
    {
      "key": "rippleIntensity",
      "storageKey": "layout_login_ripple_grid_ripple_intensity",
      "control": "range",
      "label": "Ripple Intensity",
      "min": 0,
      "max": 0.3,
      "step": 0.01,
      "default": 0.05
    },
    {
      "key": "gridSize",
      "storageKey": "layout_login_ripple_grid_grid_size",
      "control": "range",
      "label": "Grid Size",
      "min": 5,
      "max": 30,
      "step": 1,
      "default": 10
    },
    {
      "key": "gridThickness",
      "storageKey": "layout_login_ripple_grid_grid_thickness",
      "control": "range",
      "label": "Grid Thickness",
      "min": 5,
      "max": 50,
      "step": 1,
      "default": 15
    },
    {
      "key": "fadeDistance",
      "storageKey": "layout_login_ripple_grid_fade_distance",
      "control": "range",
      "label": "Fade Distance",
      "min": 0.5,
      "max": 3,
      "step": 0.1,
      "default": 1.5
    },
    {
      "key": "vignetteStrength",
      "storageKey": "layout_login_ripple_grid_vignette_strength",
      "control": "range",
      "label": "Vignette Strength",
      "min": 0.5,
      "max": 5,
      "step": 0.1,
      "default": 2
    },
    {
      "key": "glowIntensity",
      "storageKey": "layout_login_ripple_grid_glow_intensity",
      "control": "range",
      "label": "Glow Intensity",
      "min": 0,
      "max": 1,
      "step": 0.05,
      "default": 0.1
    },
    {
      "key": "opacity",
      "storageKey": "layout_login_ripple_grid_opacity",
      "control": "range",
      "label": "Opacity",
      "min": 0,
      "max": 1,
      "step": 0.05,
      "default": 1
    },
    {
      "key": "gridRotation",
      "storageKey": "layout_login_ripple_grid_grid_rotation",
      "control": "range",
      "label": "Grid Rotation",
      "min": 0,
      "max": 360,
      "step": 1,
      "default": 0
    },
    {
      "key": "mouseInteraction",
      "storageKey": "layout_login_ripple_grid_mouse_interaction",
      "control": "checkbox",
      "label": "Mouse Interaction",
      "default": true
    },
    {
      "key": "mouseInteractionRadius",
      "storageKey": "layout_login_ripple_grid_mouse_interaction_radius",
      "control": "range",
      "label": "Mouse Interaction Radius",
      "min": 0.2,
      "max": 2,
      "step": 0.1,
      "default": 0.8
    }
  ]
};
