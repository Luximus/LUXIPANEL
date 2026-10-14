// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const hyperspeedEffect: LoginEffect = {
  "id": "hyperspeed",
  "name": "Hyperspeed",
  "label": "Hyperspeed",
  "storagePrefix": "hyperspeed",
  "props": [
    {
      "key": "activePreset",
      "storageKey": "layout_login_hyperspeed_active_preset",
      "control": "select",
      "label": "Preset",
      "default": "one",
      "options": [
        {
          "value": "one",
          "label": "One"
        },
        {
          "value": "two",
          "label": "Two"
        },
        {
          "value": "three",
          "label": "Three"
        },
        {
          "value": "four",
          "label": "Four"
        },
        {
          "value": "five",
          "label": "Five"
        },
        {
          "value": "six",
          "label": "Six"
        }
      ]
    }
  ]
};
