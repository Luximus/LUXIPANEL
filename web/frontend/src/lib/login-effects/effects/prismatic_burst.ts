// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const prismaticBurstEffect: LoginEffect = {
  "id": "prismatic_burst",
  "name": "PrismaticBurst",
  "label": "Prismatic Burst",
  "storagePrefix": "prismatic_burst",
  "props": [
    {
      "key": "animationType",
      "storageKey": "layout_login_prismatic_burst_animation_type",
      "control": "select",
      "label": "Animation Type",
      "options": [
        {
          "value": "rotate",
          "label": "Rotate"
        },
        {
          "value": "rotate3d",
          "label": "Rotate 3D"
        },
        {
          "value": "hover",
          "label": "Hover"
        }
      ],
      "default": "rotate3d"
    },
    {
      "key": "intensity",
      "storageKey": "layout_login_prismatic_burst_intensity",
      "control": "range",
      "label": "Intensity",
      "min": 0.1,
      "max": 5,
      "step": 0.1,
      "default": 2
    },
    {
      "key": "speed",
      "storageKey": "layout_login_prismatic_burst_speed",
      "control": "range",
      "label": "Speed",
      "min": 0,
      "max": 2,
      "step": 0.05,
      "default": 0.5
    },
    {
      "key": "distort",
      "storageKey": "layout_login_prismatic_burst_distort",
      "control": "range",
      "label": "Distort",
      "min": 0,
      "max": 10,
      "step": 0.1,
      "default": 0
    },
    {
      "key": "hoverDampness",
      "storageKey": "layout_login_prismatic_burst_hover_dampness",
      "control": "range",
      "label": "Hover Dampness",
      "min": 0,
      "max": 1,
      "step": 0.01,
      "default": 0.25
    },
    {
      "key": "rayCount",
      "storageKey": "layout_login_prismatic_burst_ray_count",
      "control": "range",
      "label": "Ray Count",
      "min": 0,
      "max": 64,
      "step": 1,
      "default": 0
    },
    {
      "key": "color0",
      "storageKey": "layout_login_prismatic_burst_color0",
      "control": "color",
      "label": "Color 1",
      "default": "#A855F7"
    },
    {
      "key": "color1",
      "storageKey": "layout_login_prismatic_burst_color1",
      "control": "color",
      "label": "Color 2",
      "default": "#7C3AED"
    },
    {
      "key": "color2",
      "storageKey": "layout_login_prismatic_burst_color2",
      "control": "color",
      "label": "Color 3",
      "default": "#6366F1"
    }
  ]
};
