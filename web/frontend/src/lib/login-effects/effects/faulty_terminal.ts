// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const faultyTerminalEffect: LoginEffect = {
  "id": "faulty_terminal",
  "name": "FaultyTerminal",
  "label": "Faulty Terminal",
  "storagePrefix": "faulty_terminal",
  "props": [
    {
      "key": "scale",
      "storageKey": "layout_login_faulty_terminal_scale",
      "control": "number",
      "label": "Scale",
      "default": 1.5
    },
    {
      "key": "digitSize",
      "storageKey": "layout_login_faulty_terminal_digit_size",
      "control": "number",
      "label": "Digit Size",
      "default": 1.2
    },
    {
      "key": "timeScale",
      "storageKey": "layout_login_faulty_terminal_time_scale",
      "control": "number",
      "label": "Time Scale",
      "default": 0.5
    },
    {
      "key": "scanlineIntensity",
      "storageKey": "layout_login_faulty_terminal_scanline_intensity",
      "control": "number",
      "label": "Scanline Intensity",
      "default": 0.5
    },
    {
      "key": "curvature",
      "storageKey": "layout_login_faulty_terminal_curvature",
      "control": "number",
      "label": "Curvature",
      "default": 0.1
    },
    {
      "key": "tint",
      "storageKey": "layout_login_faulty_terminal_tint",
      "control": "color",
      "label": "Tint",
      "default": "#A7EF9E"
    },
    {
      "key": "mouseReact",
      "storageKey": "layout_login_faulty_terminal_mouse_react",
      "control": "checkbox",
      "label": "Mouse React",
      "default": true
    },
    {
      "key": "mouseStrength",
      "storageKey": "layout_login_faulty_terminal_mouse_strength",
      "control": "number",
      "label": "Mouse Strength",
      "default": 0.5
    },
    {
      "key": "pageLoadAnimation",
      "storageKey": "layout_login_faulty_terminal_page_load_animation",
      "control": "checkbox",
      "label": "Page Load Animation",
      "default": true
    },
    {
      "key": "noiseAmp",
      "storageKey": "layout_login_faulty_terminal_noise_amp",
      "control": "number",
      "label": "Noise Amp",
      "default": 1
    },
    {
      "key": "brightness",
      "storageKey": "layout_login_faulty_terminal_brightness",
      "control": "number",
      "label": "Brightness",
      "default": 0.6
    }
  ]
};
