// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const letterGlitchEffect: LoginEffect = {
  "id": "letter_glitch",
  "name": "LetterGlitch",
  "label": "Letter Glitch",
  "storagePrefix": "letter_glitch",
  "props": [
    {
      "key": "color1",
      "storageKey": "layout_login_letter_glitch_color1",
      "control": "color",
      "label": "Color 1",
      "default": "#1c96e9"
    },
    {
      "key": "color2",
      "storageKey": "layout_login_letter_glitch_color2",
      "control": "color",
      "label": "Color 2",
      "default": "#8011dd"
    },
    {
      "key": "color3",
      "storageKey": "layout_login_letter_glitch_color3",
      "control": "color",
      "label": "Color 3",
      "default": "#11dc2d"
    },
    {
      "key": "glitchSpeed",
      "storageKey": "layout_login_letter_glitch_speed",
      "control": "range",
      "label": "Speed (ms)",
      "default": 50,
      "min": 10,
      "max": 200,
      "step": 1
    },
    {
      "key": "centerVignette",
      "storageKey": "layout_login_letter_glitch_center_vignette",
      "control": "checkbox",
      "label": "Center vignette",
      "default": false
    },
    {
      "key": "outerVignette",
      "storageKey": "layout_login_letter_glitch_outer_vignette",
      "control": "checkbox",
      "label": "Outer vignette",
      "default": true
    },
    {
      "key": "smooth",
      "storageKey": "layout_login_letter_glitch_smooth",
      "control": "checkbox",
      "label": "Smooth transitions",
      "default": true
    },
    {
      "key": "characters",
      "storageKey": "layout_login_letter_glitch_characters",
      "control": "text",
      "label": "Characters",
      "default": "ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789"
    }
  ]
};
