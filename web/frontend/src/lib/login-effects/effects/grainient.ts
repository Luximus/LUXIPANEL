// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const grainientEffect: LoginEffect = {
  "id": "grainient",
  "name": "Grainient",
  "label": "Grainient",
  "storagePrefix": "grainient",
  "props": [
    {
      "key": "color1",
      "storageKey": "layout_login_grainient_color1",
      "control": "color",
      "label": "Color1",
      "default": "#FF9FFC"
    },
    {
      "key": "color2",
      "storageKey": "layout_login_grainient_color2",
      "control": "color",
      "label": "Color2",
      "default": "#5227FF"
    },
    {
      "key": "color3",
      "storageKey": "layout_login_grainient_color3",
      "control": "color",
      "label": "Color3",
      "default": "#B497CF"
    },
    {
      "key": "timeSpeed",
      "storageKey": "layout_login_grainient_time_speed",
      "control": "number",
      "label": "Time Speed",
      "default": 0.25
    },
    {
      "key": "colorBalance",
      "storageKey": "layout_login_grainient_color_balance",
      "control": "number",
      "label": "Color Balance",
      "default": 0
    },
    {
      "key": "warpStrength",
      "storageKey": "layout_login_grainient_warp_strength",
      "control": "number",
      "label": "Warp Strength",
      "default": 1
    },
    {
      "key": "warpFrequency",
      "storageKey": "layout_login_grainient_warp_frequency",
      "control": "number",
      "label": "Warp Frequency",
      "default": 5
    },
    {
      "key": "warpSpeed",
      "storageKey": "layout_login_grainient_warp_speed",
      "control": "number",
      "label": "Warp Speed",
      "default": 2
    },
    {
      "key": "warpAmplitude",
      "storageKey": "layout_login_grainient_warp_amplitude",
      "control": "number",
      "label": "Warp Amplitude",
      "default": 50
    },
    {
      "key": "blendAngle",
      "storageKey": "layout_login_grainient_blend_angle",
      "control": "number",
      "label": "Blend Angle",
      "default": 0
    },
    {
      "key": "blendSoftness",
      "storageKey": "layout_login_grainient_blend_softness",
      "control": "number",
      "label": "Blend Softness",
      "default": 0.05
    },
    {
      "key": "rotationAmount",
      "storageKey": "layout_login_grainient_rotation_amount",
      "control": "number",
      "label": "Rotation Amount",
      "default": 500
    },
    {
      "key": "noiseScale",
      "storageKey": "layout_login_grainient_noise_scale",
      "control": "number",
      "label": "Noise Scale",
      "default": 2
    },
    {
      "key": "grainAmount",
      "storageKey": "layout_login_grainient_grain_amount",
      "control": "number",
      "label": "Grain Amount",
      "default": 0.1
    },
    {
      "key": "grainScale",
      "storageKey": "layout_login_grainient_grain_scale",
      "control": "number",
      "label": "Grain Scale",
      "default": 2
    },
    {
      "key": "grainAnimated",
      "storageKey": "layout_login_grainient_grain_animated",
      "control": "checkbox",
      "label": "Grain Animated",
      "default": false
    },
    {
      "key": "contrast",
      "storageKey": "layout_login_grainient_contrast",
      "control": "number",
      "label": "Contrast",
      "default": 1.5
    },
    {
      "key": "gamma",
      "storageKey": "layout_login_grainient_gamma",
      "control": "number",
      "label": "Gamma",
      "default": 1
    },
    {
      "key": "saturation",
      "storageKey": "layout_login_grainient_saturation",
      "control": "number",
      "label": "Saturation",
      "default": 1
    },
    {
      "key": "centerX",
      "storageKey": "layout_login_grainient_center_x",
      "control": "number",
      "label": "Center X",
      "default": 0
    },
    {
      "key": "centerY",
      "storageKey": "layout_login_grainient_center_y",
      "control": "number",
      "label": "Center Y",
      "default": 0
    },
    {
      "key": "zoom",
      "storageKey": "layout_login_grainient_zoom",
      "control": "number",
      "label": "Zoom",
      "default": 0.9
    }
  ]
};
