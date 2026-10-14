// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const lightPillarEffect: LoginEffect = {
  "id": "light_pillar",
  "name": "LightPillar",
  "label": "Light Pillar",
  "storagePrefix": "light_pillar",
  "props": [
    {
      "key": "topColor",
      "storageKey": "layout_login_light_pillar_top_color",
      "control": "color",
      "label": "Top Color",
      "default": "#5227FF"
    },
    {
      "key": "bottomColor",
      "storageKey": "layout_login_light_pillar_bottom_color",
      "control": "color",
      "label": "Bottom Color",
      "default": "#FF9FFC"
    },
    {
      "key": "intensity",
      "storageKey": "layout_login_light_pillar_intensity",
      "control": "number",
      "label": "Intensity",
      "default": 1
    },
    {
      "key": "rotationSpeed",
      "storageKey": "layout_login_light_pillar_rotation_speed",
      "control": "number",
      "label": "Rotation Speed",
      "default": 0.3
    },
    {
      "key": "interactive",
      "storageKey": "layout_login_light_pillar_interactive",
      "control": "checkbox",
      "label": "Interactive",
      "default": false
    },
    {
      "key": "glowAmount",
      "storageKey": "layout_login_light_pillar_glow_amount",
      "control": "number",
      "label": "Glow Amount",
      "default": 0.002
    },
    {
      "key": "pillarWidth",
      "storageKey": "layout_login_light_pillar_pillar_width",
      "control": "number",
      "label": "Pillar Width",
      "default": 3
    },
    {
      "key": "pillarHeight",
      "storageKey": "layout_login_light_pillar_pillar_height",
      "control": "number",
      "label": "Pillar Height",
      "default": 0.4
    },
    {
      "key": "noiseIntensity",
      "storageKey": "layout_login_light_pillar_noise_intensity",
      "control": "number",
      "label": "Noise Intensity",
      "default": 0.5
    },
    {
      "key": "mixBlendMode",
      "storageKey": "layout_login_light_pillar_mix_blend_mode",
      "control": "text",
      "label": "Mix Blend Mode",
      "default": "screen"
    },
    {
      "key": "pillarRotation",
      "storageKey": "layout_login_light_pillar_pillar_rotation",
      "control": "number",
      "label": "Pillar Rotation",
      "default": 25
    },
    {
      "key": "quality",
      "storageKey": "layout_login_light_pillar_quality",
      "control": "text",
      "label": "Quality",
      "default": "high"
    }
  ]
};
