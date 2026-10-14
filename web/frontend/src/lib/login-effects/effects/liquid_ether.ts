// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const liquidEtherEffect: LoginEffect = {
  "id": "liquid_ether",
  "name": "LiquidEther",
  "label": "Liquid Ether",
  "storagePrefix": "liquid_ether",
  "props": [
    {
      "key": "color0",
      "storageKey": "layout_login_liquid_ether_color0",
      "control": "color",
      "label": "Color0",
      "default": "#5227FF"
    },
    {
      "key": "color1",
      "storageKey": "layout_login_liquid_ether_color1",
      "control": "color",
      "label": "Color1",
      "default": "#FF9FFC"
    },
    {
      "key": "color2",
      "storageKey": "layout_login_liquid_ether_color2",
      "control": "color",
      "label": "Color2",
      "default": "#B497CF"
    },
    {
      "key": "mouseForce",
      "storageKey": "layout_login_liquid_ether_mouse_force",
      "control": "number",
      "label": "Mouse Force",
      "default": 20
    },
    {
      "key": "cursorSize",
      "storageKey": "layout_login_liquid_ether_cursor_size",
      "control": "number",
      "label": "Cursor Size",
      "default": 100
    },
    {
      "key": "resolution",
      "storageKey": "layout_login_liquid_ether_resolution",
      "control": "number",
      "label": "Resolution",
      "default": 0.5
    },
    {
      "key": "isViscous",
      "storageKey": "layout_login_liquid_ether_is_viscous",
      "control": "checkbox",
      "label": "Is Viscous",
      "default": true
    },
    {
      "key": "viscous",
      "storageKey": "layout_login_liquid_ether_viscous",
      "control": "number",
      "label": "Viscous",
      "default": 30
    },
    {
      "key": "iterationsViscous",
      "storageKey": "layout_login_liquid_ether_iterations_viscous",
      "control": "number",
      "label": "Iterations Viscous",
      "default": 32
    },
    {
      "key": "iterationsPoisson",
      "storageKey": "layout_login_liquid_ether_iterations_poisson",
      "control": "number",
      "label": "Iterations Poisson",
      "default": 32
    },
    {
      "key": "isBounce",
      "storageKey": "layout_login_liquid_ether_is_bounce",
      "control": "checkbox",
      "label": "Is Bounce",
      "default": false
    },
    {
      "key": "autoDemo",
      "storageKey": "layout_login_liquid_ether_auto_demo",
      "control": "checkbox",
      "label": "Auto Demo",
      "default": true
    },
    {
      "key": "autoSpeed",
      "storageKey": "layout_login_liquid_ether_auto_speed",
      "control": "number",
      "label": "Auto Speed",
      "default": 0.5
    },
    {
      "key": "autoIntensity",
      "storageKey": "layout_login_liquid_ether_auto_intensity",
      "control": "number",
      "label": "Auto Intensity",
      "default": 2.2
    }
  ]
};
