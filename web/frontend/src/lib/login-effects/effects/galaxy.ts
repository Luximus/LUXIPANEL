// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const galaxyEffect: LoginEffect = {
  "id": "galaxy",
  "name": "Galaxy",
  "label": "Galaxy",
  "storagePrefix": "galaxy",
  "props": [
    {
      "key": "density",
      "storageKey": "layout_login_galaxy_density",
      "control": "range",
      "label": "Density",
      "min": 0.1,
      "max": 3,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "glowIntensity",
      "storageKey": "layout_login_galaxy_glow_intensity",
      "control": "range",
      "label": "Glow Intensity",
      "min": 0,
      "max": 1,
      "step": 0.1,
      "default": 0.3
    },
    {
      "key": "saturation",
      "storageKey": "layout_login_galaxy_saturation",
      "control": "range",
      "label": "Saturation",
      "min": 0,
      "max": 1,
      "step": 0.1,
      "default": 0
    },
    {
      "key": "hueShift",
      "storageKey": "layout_login_galaxy_hue_shift",
      "control": "range",
      "label": "Hue Shift",
      "min": 0,
      "max": 360,
      "step": 10,
      "default": 140
    },
    {
      "key": "twinkleIntensity",
      "storageKey": "layout_login_galaxy_twinkle_intensity",
      "control": "range",
      "label": "Twinkle Intensity",
      "min": 0,
      "max": 1,
      "step": 0.1,
      "default": 0.3
    },
    {
      "key": "rotationSpeed",
      "storageKey": "layout_login_galaxy_rotation_speed",
      "control": "range",
      "label": "Rotation Speed",
      "min": 0,
      "max": 0.5,
      "step": 0.05,
      "default": 0.1
    },
    {
      "key": "repulsionStrength",
      "storageKey": "layout_login_galaxy_repulsion_strength",
      "control": "range",
      "label": "Repulsion Strength",
      "min": 0,
      "max": 10,
      "step": 0.5,
      "default": 2
    },
    {
      "key": "autoCenterRepulsion",
      "storageKey": "layout_login_galaxy_auto_center_repulsion",
      "control": "range",
      "label": "Auto Center Repulsion",
      "min": 0,
      "max": 20,
      "step": 1,
      "default": 0
    },
    {
      "key": "starSpeed",
      "storageKey": "layout_login_galaxy_star_speed",
      "control": "range",
      "label": "Star Speed",
      "min": 0.1,
      "max": 2,
      "step": 0.1,
      "default": 0.5
    },
    {
      "key": "speed",
      "storageKey": "layout_login_galaxy_speed",
      "control": "range",
      "label": "Animation Speed",
      "min": 0.1,
      "max": 3,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "mouseRepulsion",
      "storageKey": "layout_login_galaxy_mouse_repulsion",
      "control": "checkbox",
      "label": "Mouse Repulsion",
      "default": true
    },
    {
      "key": "mouseInteraction",
      "storageKey": "layout_login_galaxy_mouse_interaction",
      "control": "checkbox",
      "label": "Mouse Interaction",
      "default": true
    }
  ]
};
