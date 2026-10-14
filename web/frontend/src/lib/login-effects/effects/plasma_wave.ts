// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const plasmaWaveEffect: LoginEffect = {
  "id": "plasma_wave",
  "name": "PlasmaWave",
  "label": "Plasma Wave",
  "storagePrefix": "plasma_wave",
  "props": [
    {
      "key": "color1",
      "storageKey": "layout_login_plasma_wave_color1",
      "control": "color",
      "label": "Color 1",
      "default": "#A855F7"
    },
    {
      "key": "color2",
      "storageKey": "layout_login_plasma_wave_color2",
      "control": "color",
      "label": "Color 2",
      "default": "#06B6D4"
    },
    {
      "key": "speed1",
      "storageKey": "layout_login_plasma_wave_speed1",
      "control": "range",
      "label": "Speed 1",
      "min": 0,
      "max": 0.2,
      "step": 0.005,
      "default": 0.05
    },
    {
      "key": "speed2",
      "storageKey": "layout_login_plasma_wave_speed2",
      "control": "range",
      "label": "Speed 2",
      "min": 0,
      "max": 0.2,
      "step": 0.005,
      "default": 0.05
    },
    {
      "key": "focalLength",
      "storageKey": "layout_login_plasma_wave_focal_length",
      "control": "range",
      "label": "Focal Length",
      "min": 0.1,
      "max": 2,
      "step": 0.05,
      "default": 0.8
    },
    {
      "key": "bend1",
      "storageKey": "layout_login_plasma_wave_bend1",
      "control": "range",
      "label": "Bend 1",
      "min": 0,
      "max": 3,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "bend2",
      "storageKey": "layout_login_plasma_wave_bend2",
      "control": "range",
      "label": "Bend 2",
      "min": 0,
      "max": 3,
      "step": 0.1,
      "default": 0.5
    },
    {
      "key": "dir2",
      "storageKey": "layout_login_plasma_wave_dir2",
      "control": "range",
      "label": "Direction 2",
      "min": -1,
      "max": 1,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "rotationDeg",
      "storageKey": "layout_login_plasma_wave_rotation_deg",
      "control": "range",
      "label": "Rotation",
      "min": 0,
      "max": 360,
      "step": 1,
      "default": 0
    }
  ]
};
