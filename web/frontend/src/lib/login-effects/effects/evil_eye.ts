// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const evilEyeEffect: LoginEffect = {
  "id": "evil_eye",
  "name": "EvilEye",
  "label": "Evil Eye",
  "storagePrefix": "evil_eye",
  "props": [
    {
      "key": "eyeColor",
      "storageKey": "layout_login_evil_eye_eye_color",
      "control": "color",
      "label": "Eye Color",
      "default": "#FF6F37"
    },
    {
      "key": "intensity",
      "storageKey": "layout_login_evil_eye_intensity",
      "control": "range",
      "label": "Intensity",
      "min": 0.5,
      "max": 5,
      "step": 0.1,
      "default": 1.5
    },
    {
      "key": "pupilSize",
      "storageKey": "layout_login_evil_eye_pupil_size",
      "control": "range",
      "label": "Pupil Size",
      "min": 0.1,
      "max": 2,
      "step": 0.05,
      "default": 0.6
    },
    {
      "key": "irisWidth",
      "storageKey": "layout_login_evil_eye_iris_width",
      "control": "range",
      "label": "Iris Width",
      "min": 0.1,
      "max": 0.8,
      "step": 0.05,
      "default": 0.25
    },
    {
      "key": "glowIntensity",
      "storageKey": "layout_login_evil_eye_glow_intensity",
      "control": "range",
      "label": "Glow Intensity",
      "min": 0,
      "max": 1.5,
      "step": 0.05,
      "default": 0.35
    },
    {
      "key": "scale",
      "storageKey": "layout_login_evil_eye_scale",
      "control": "range",
      "label": "Scale",
      "min": 0.2,
      "max": 3,
      "step": 0.1,
      "default": 0.8
    },
    {
      "key": "noiseScale",
      "storageKey": "layout_login_evil_eye_noise_scale",
      "control": "range",
      "label": "Noise Scale",
      "min": 0.1,
      "max": 3,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "pupilFollow",
      "storageKey": "layout_login_evil_eye_pupil_follow",
      "control": "range",
      "label": "Pupil Follow",
      "min": 0,
      "max": 2,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "flameSpeed",
      "storageKey": "layout_login_evil_eye_flame_speed",
      "control": "range",
      "label": "Flame Speed",
      "min": 0.1,
      "max": 5,
      "step": 0.1,
      "default": 1
    },
    {
      "key": "backgroundColor",
      "storageKey": "layout_login_evil_eye_background_color",
      "control": "color",
      "label": "Background",
      "default": "#120F17"
    }
  ]
};
