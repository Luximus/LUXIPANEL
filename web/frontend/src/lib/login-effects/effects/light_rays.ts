// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const lightRaysEffect: LoginEffect = {
  "id": "light_rays",
  "name": "LightRays",
  "label": "Light Rays",
  "storagePrefix": "light_rays",
  "props": [
    {
      "key": "raysOrigin",
      "storageKey": "layout_login_light_rays_rays_origin",
      "control": "select",
      "label": "Rays Origin",
      "options": [],
      "default": "top-center"
    },
    {
      "key": "raysColor",
      "storageKey": "layout_login_light_rays_rays_color",
      "control": "color",
      "label": "Rays Color",
      "default": "#ffffff"
    },
    {
      "key": "raysSpeed",
      "storageKey": "layout_login_light_rays_rays_speed",
      "control": "range",
      "label": "Rays Speed",
      "min": 0.1,
      "max": 3,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "lightSpread",
      "storageKey": "layout_login_light_rays_light_spread",
      "control": "range",
      "label": "Light Spread",
      "min": 0.1,
      "max": 2,
      "step": 0.1,
      "default": 0.5
    },
    {
      "key": "rayLength",
      "storageKey": "layout_login_light_rays_ray_length",
      "control": "range",
      "label": "Ray Length",
      "min": 0.5,
      "max": 3,
      "step": 0.1,
      "default": 3
    },
    {
      "key": "pulsating",
      "storageKey": "layout_login_light_rays_pulsating",
      "control": "checkbox",
      "label": "Pulsating",
      "default": false
    },
    {
      "key": "fadeDistance",
      "storageKey": "layout_login_light_rays_fade_distance",
      "control": "range",
      "label": "Fade Distance",
      "min": 0.5,
      "max": 2,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "saturation",
      "storageKey": "layout_login_light_rays_saturation",
      "control": "range",
      "label": "Saturation",
      "min": 0,
      "max": 2,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "mouseInfluence",
      "storageKey": "layout_login_light_rays_mouse_influence",
      "control": "range",
      "label": "Mouse Influence",
      "min": 0,
      "max": 1,
      "step": 0.1,
      "default": 0.1
    },
    {
      "key": "noiseAmount",
      "storageKey": "layout_login_light_rays_noise_amount",
      "control": "range",
      "label": "Noise Amount",
      "min": 0,
      "max": 0.5,
      "step": 0.01,
      "default": 0
    },
    {
      "key": "distortion",
      "storageKey": "layout_login_light_rays_distortion",
      "control": "range",
      "label": "Distortion",
      "min": 0,
      "max": 1,
      "step": 0.1,
      "default": 0
    }
  ]
};
