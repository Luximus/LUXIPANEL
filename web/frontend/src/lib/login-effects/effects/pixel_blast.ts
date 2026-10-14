// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const pixelBlastEffect: LoginEffect = {
  "id": "pixel_blast",
  "name": "PixelBlast",
  "label": "Pixel Blast",
  "storagePrefix": "pixel_blast",
  "props": [
    {
      "key": "variant",
      "storageKey": "layout_login_pixel_blast_variant",
      "control": "text",
      "label": "Variant",
      "default": "square"
    },
    {
      "key": "pixelSize",
      "storageKey": "layout_login_pixel_blast_pixel_size",
      "control": "number",
      "label": "Pixel Size",
      "default": 4
    },
    {
      "key": "patternScale",
      "storageKey": "layout_login_pixel_blast_pattern_scale",
      "control": "number",
      "label": "Pattern Scale",
      "default": 2
    },
    {
      "key": "patternDensity",
      "storageKey": "layout_login_pixel_blast_pattern_density",
      "control": "number",
      "label": "Pattern Density",
      "default": 1
    },
    {
      "key": "pixelSizeJitter",
      "storageKey": "layout_login_pixel_blast_pixel_size_jitter",
      "control": "number",
      "label": "Pixel Size Jitter",
      "default": 0
    },
    {
      "key": "enableRipples",
      "storageKey": "layout_login_pixel_blast_enable_ripples",
      "control": "checkbox",
      "label": "Enable Ripples",
      "default": true
    },
    {
      "key": "liquid",
      "storageKey": "layout_login_pixel_blast_liquid",
      "control": "checkbox",
      "label": "Liquid",
      "default": false
    },
    {
      "key": "speed",
      "storageKey": "layout_login_pixel_blast_speed",
      "control": "number",
      "label": "Speed",
      "default": 0.5
    },
    {
      "key": "edgeFade",
      "storageKey": "layout_login_pixel_blast_edge_fade",
      "control": "number",
      "label": "Edge Fade",
      "default": 0.25
    },
    {
      "key": "color",
      "storageKey": "layout_login_pixel_blast_color",
      "control": "color",
      "label": "Color",
      "default": "#B497CF"
    }
  ]
};
