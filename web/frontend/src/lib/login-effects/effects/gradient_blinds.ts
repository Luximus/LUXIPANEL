// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const gradientBlindsEffect: LoginEffect = {
  "id": "gradient_blinds",
  "name": "GradientBlinds",
  "label": "Gradient Blinds",
  "storagePrefix": "gradient_blinds",
  "props": [
    {
      "key": "color1",
      "storageKey": "layout_login_gradient_blinds_color1",
      "control": "color",
      "label": "Color 1",
      "default": "#FF9FFC"
    },
    {
      "key": "color2",
      "storageKey": "layout_login_gradient_blinds_color2",
      "control": "color",
      "label": "Color 2",
      "default": "#5227FF"
    },
    {
      "key": "angle",
      "storageKey": "layout_login_gradient_blinds_angle",
      "control": "range",
      "label": "Blinds Angle",
      "min": 0,
      "max": 360,
      "step": 1,
      "default": 20
    },
    {
      "key": "noise",
      "storageKey": "layout_login_gradient_blinds_noise",
      "control": "range",
      "label": "Noise Amount",
      "min": 0,
      "max": 1,
      "step": 0.01,
      "default": 0.5
    },
    {
      "key": "blindCount",
      "storageKey": "layout_login_gradient_blinds_blind_count",
      "control": "range",
      "label": "Blinds Count",
      "min": 1,
      "max": 64,
      "step": 1,
      "default": 16
    },
    {
      "key": "blindMinWidth",
      "storageKey": "layout_login_gradient_blinds_blind_min_width",
      "control": "range",
      "label": "Min Blind W",
      "min": 10,
      "max": 200,
      "step": 5,
      "default": 60
    },
    {
      "key": "spotlightRadius",
      "storageKey": "layout_login_gradient_blinds_spotlight_radius",
      "control": "range",
      "label": "Spot Radius",
      "min": 0.05,
      "max": 1,
      "step": 0.05,
      "default": 0.5
    },
    {
      "key": "distortAmount",
      "storageKey": "layout_login_gradient_blinds_distort_amount",
      "control": "range",
      "label": "Distort",
      "min": 0,
      "max": 100,
      "step": 1,
      "default": 0
    },
    {
      "key": "mouseDampening",
      "storageKey": "layout_login_gradient_blinds_mouse_dampening",
      "control": "range",
      "label": "Mouse Damp",
      "min": 0,
      "max": 1,
      "step": 0.01,
      "default": 0.15
    },
    {
      "key": "shineDirection",
      "storageKey": "layout_login_gradient_blinds_shine_direction",
      "control": "select",
      "label": "Light Direction",
      "options": [],
      "default": "left"
    }
  ]
};
