// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const orbEffect: LoginEffect = {
  "id": "orb",
  "name": "Orb",
  "label": "Orb",
  "storagePrefix": "orb",
  "props": [
    {
      "key": "hue",
      "storageKey": "layout_login_orb_hue",
      "control": "range",
      "label": "Hue Shift",
      "min": 0,
      "max": 360,
      "step": 1,
      "default": 0
    },
    {
      "key": "hoverIntensity",
      "storageKey": "layout_login_orb_hover_intensity",
      "control": "range",
      "label": "Hover Intensity",
      "min": 0,
      "max": 5,
      "step": 0.01,
      "default": 2
    },
    {
      "key": "rotateOnHover",
      "storageKey": "layout_login_orb_rotate_on_hover",
      "control": "checkbox",
      "label": "Rotate On Hover",
      "default": true
    },
    {
      "key": "forceHoverState",
      "storageKey": "layout_login_orb_force_hover_state",
      "control": "checkbox",
      "label": "Force Hover State",
      "default": false
    },
    {
      "key": "backgroundColor",
      "storageKey": "layout_login_orb_background_color",
      "control": "color",
      "label": "Orb Background Color",
      "default": "#000000"
    }
  ]
};
