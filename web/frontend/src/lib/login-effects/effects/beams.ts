// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const beamsEffect: LoginEffect = {
  "id": "beams",
  "name": "Beams",
  "label": "Beams",
  "storagePrefix": "beams",
  "props": [
    {
      "key": "beamWidth",
      "storageKey": "layout_login_beams_beam_width",
      "control": "range",
      "label": "Beam Width",
      "min": 0.1,
      "max": 10,
      "step": 0.1,
      "default": 3
    },
    {
      "key": "beamHeight",
      "storageKey": "layout_login_beams_beam_height",
      "control": "range",
      "label": "Beam Height",
      "min": 1,
      "max": 25,
      "step": 1,
      "default": 30
    },
    {
      "key": "beamNumber",
      "storageKey": "layout_login_beams_beam_number",
      "control": "range",
      "label": "Beam Count",
      "min": 1,
      "max": 50,
      "step": 1,
      "default": 20
    },
    {
      "key": "lightColor",
      "storageKey": "layout_login_beams_light_color",
      "control": "color",
      "label": "Color",
      "default": "#ffffff"
    },
    {
      "key": "speed",
      "storageKey": "layout_login_beams_speed",
      "control": "range",
      "label": "Speed",
      "min": 0.1,
      "max": 10,
      "step": 0.1,
      "default": 2
    },
    {
      "key": "noiseIntensity",
      "storageKey": "layout_login_beams_noise_intensity",
      "control": "range",
      "label": "Noise Intensity",
      "min": 0,
      "max": 5,
      "step": 0.05,
      "default": 1.75
    },
    {
      "key": "scale",
      "storageKey": "layout_login_beams_scale",
      "control": "range",
      "label": "Noise Scale",
      "min": 0.01,
      "max": 1,
      "step": 0.01,
      "default": 0.2
    },
    {
      "key": "rotation",
      "storageKey": "layout_login_beams_rotation",
      "control": "range",
      "label": "Rotation",
      "min": 0,
      "max": 360,
      "step": 1,
      "default": 30
    }
  ]
};
