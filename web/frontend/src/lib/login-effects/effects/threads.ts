// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const threadsEffect: LoginEffect = {
  "id": "threads",
  "name": "Threads",
  "label": "Threads",
  "storagePrefix": "threads",
  "props": [
    {
      "key": "amplitude",
      "storageKey": "layout_login_threads_amplitude",
      "control": "number",
      "label": "Amplitude",
      "default": 1
    },
    {
      "key": "distance",
      "storageKey": "layout_login_threads_distance",
      "control": "number",
      "label": "Distance",
      "default": 0
    },
    {
      "key": "enableMouseInteraction",
      "storageKey": "layout_login_threads_enable_mouse_interaction",
      "control": "checkbox",
      "label": "Enable Mouse Interaction",
      "default": true
    }
  ]
};
