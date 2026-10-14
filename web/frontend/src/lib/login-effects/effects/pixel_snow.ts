// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const pixelSnowEffect: LoginEffect = {
  "id": "pixel_snow",
  "name": "PixelSnow",
  "label": "Pixel Snow",
  "storagePrefix": "pixel_snow",
  "props": [
    {
      "key": "color",
      "storageKey": "layout_login_pixel_snow_color",
      "control": "color",
      "label": "Color",
      "default": "#ffffff"
    },
    {
      "key": "flakeSize",
      "storageKey": "layout_login_pixel_snow_flake_size",
      "control": "range",
      "label": "Flake Size",
      "min": 0.001,
      "max": 0.05,
      "step": 0.001,
      "default": 0.01
    },
    {
      "key": "minFlakeSize",
      "storageKey": "layout_login_pixel_snow_min_flake_size",
      "control": "number",
      "label": "Min Flake Size",
      "default": 1.25
    },
    {
      "key": "pixelResolution",
      "storageKey": "layout_login_pixel_snow_pixel_resolution",
      "control": "range",
      "label": "Pixel Resolution",
      "min": 50,
      "max": 500,
      "step": 10,
      "default": 200
    },
    {
      "key": "speed",
      "storageKey": "layout_login_pixel_snow_speed",
      "control": "range",
      "label": "Speed",
      "min": 0,
      "max": 5,
      "step": 0.1,
      "default": 1.25
    },
    {
      "key": "depthFade",
      "storageKey": "layout_login_pixel_snow_depth_fade",
      "control": "range",
      "label": "Depth Fade",
      "min": 1,
      "max": 20,
      "step": 0.5,
      "default": 8
    },
    {
      "key": "farPlane",
      "storageKey": "layout_login_pixel_snow_far_plane",
      "control": "range",
      "label": "Far Plane",
      "min": 5,
      "max": 50,
      "step": 1,
      "default": 20
    },
    {
      "key": "brightness",
      "storageKey": "layout_login_pixel_snow_brightness",
      "control": "range",
      "label": "Brightness",
      "min": 0.1,
      "max": 3,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "gamma",
      "storageKey": "layout_login_pixel_snow_gamma",
      "control": "number",
      "label": "Gamma",
      "default": 0.4545
    },
    {
      "key": "density",
      "storageKey": "layout_login_pixel_snow_density",
      "control": "range",
      "label": "Density",
      "min": 0.1,
      "max": 1,
      "step": 0.05,
      "default": 0.3
    },
    {
      "key": "variant",
      "storageKey": "layout_login_pixel_snow_variant",
      "control": "select",
      "label": "Variant",
      "options": [],
      "default": "square"
    },
    {
      "key": "direction",
      "storageKey": "layout_login_pixel_snow_direction",
      "control": "range",
      "label": "Direction",
      "min": 0,
      "max": 360,
      "step": 5,
      "default": 125
    }
  ]
};
