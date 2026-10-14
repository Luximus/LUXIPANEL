// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const radarEffect: LoginEffect = {
  "id": "radar",
  "name": "Radar",
  "label": "Radar",
  "storagePrefix": "radar",
  "props": [
    {
      "key": "speed",
      "storageKey": "layout_login_radar_speed",
      "control": "range",
      "label": "Speed",
      "min": 0.1,
      "max": 5,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "scale",
      "storageKey": "layout_login_radar_scale",
      "control": "range",
      "label": "Scale",
      "min": 0.1,
      "max": 3,
      "step": 0.1,
      "default": 0.5
    },
    {
      "key": "ringCount",
      "storageKey": "layout_login_radar_ring_count",
      "control": "range",
      "label": "Ring Count",
      "min": 1,
      "max": 30,
      "step": 1,
      "default": 10
    },
    {
      "key": "spokeCount",
      "storageKey": "layout_login_radar_spoke_count",
      "control": "range",
      "label": "Spoke Count",
      "min": 1,
      "max": 36,
      "step": 1,
      "default": 10
    },
    {
      "key": "ringThickness",
      "storageKey": "layout_login_radar_ring_thickness",
      "control": "range",
      "label": "Ring Thickness",
      "min": 0.01,
      "max": 0.3,
      "step": 0.01,
      "default": 0.05
    },
    {
      "key": "spokeThickness",
      "storageKey": "layout_login_radar_spoke_thickness",
      "control": "range",
      "label": "Spoke Thickness",
      "min": 0.01,
      "max": 0.2,
      "step": 0.01,
      "default": 0.01
    },
    {
      "key": "sweepSpeed",
      "storageKey": "layout_login_radar_sweep_speed",
      "control": "range",
      "label": "Sweep Speed",
      "min": 0.1,
      "max": 5,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "sweepWidth",
      "storageKey": "layout_login_radar_sweep_width",
      "control": "range",
      "label": "Sweep Width",
      "min": 1,
      "max": 20,
      "step": 1,
      "default": 2
    },
    {
      "key": "sweepLobes",
      "storageKey": "layout_login_radar_sweep_lobes",
      "control": "range",
      "label": "Sweep Lobes",
      "min": 1,
      "max": 6,
      "step": 1,
      "default": 1
    },
    {
      "key": "color",
      "storageKey": "layout_login_radar_color",
      "control": "color",
      "label": "Color",
      "default": "#9f29ff"
    },
    {
      "key": "backgroundColor",
      "storageKey": "layout_login_radar_background_color",
      "control": "color",
      "label": "Background",
      "default": "#000000"
    },
    {
      "key": "falloff",
      "storageKey": "layout_login_radar_falloff",
      "control": "range",
      "label": "Falloff",
      "min": 0.1,
      "max": 3,
      "step": 0.1,
      "default": 2
    },
    {
      "key": "brightness",
      "storageKey": "layout_login_radar_brightness",
      "control": "range",
      "label": "Brightness",
      "min": 0.1,
      "max": 3,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "enableMouseInteraction",
      "storageKey": "layout_login_radar_enable_mouse_interaction",
      "control": "checkbox",
      "label": "Mouse Interaction",
      "default": true
    },
    {
      "key": "mouseInfluence",
      "storageKey": "layout_login_radar_mouse_influence",
      "control": "range",
      "label": "Mouse Influence",
      "min": 0.1,
      "max": 1,
      "step": 0.05,
      "default": 0.1
    }
  ]
};
