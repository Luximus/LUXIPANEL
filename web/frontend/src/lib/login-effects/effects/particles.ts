// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const particlesEffect: LoginEffect = {
  "id": "particles",
  "name": "Particles",
  "label": "Particles",
  "storagePrefix": "particles",
  "props": [
    {
      "key": "colors",
      "storageKey": "layout_login_particles_colors",
      "control": "color",
      "label": "Color",
      "default": "#ffffff"
    },
    {
      "key": "particleCount",
      "storageKey": "layout_login_particles_particle_count",
      "control": "range",
      "label": "Count",
      "min": 100,
      "max": 1000,
      "step": 100,
      "default": 200
    },
    {
      "key": "particleSpread",
      "storageKey": "layout_login_particles_particle_spread",
      "control": "range",
      "label": "Spread",
      "min": 10,
      "max": 100,
      "step": 10,
      "default": 10
    },
    {
      "key": "speed",
      "storageKey": "layout_login_particles_speed",
      "control": "range",
      "label": "Speed",
      "min": 0,
      "max": 2,
      "step": 0.1,
      "default": 0.1
    },
    {
      "key": "particleBaseSize",
      "storageKey": "layout_login_particles_particle_base_size",
      "control": "range",
      "label": "Base Size",
      "min": 100,
      "max": 1000,
      "step": 100,
      "default": 100
    },
    {
      "key": "moveParticlesOnHover",
      "storageKey": "layout_login_particles_move_particles_on_hover",
      "control": "checkbox",
      "label": "Mouse Interaction",
      "default": true
    },
    {
      "key": "alphaParticles",
      "storageKey": "layout_login_particles_alpha_particles",
      "control": "checkbox",
      "label": "Particle Transparency",
      "default": false
    },
    {
      "key": "disableRotation",
      "storageKey": "layout_login_particles_disable_rotation",
      "control": "checkbox",
      "label": "Disable Rotation",
      "default": false
    },
    {
      "key": "pixelRatio",
      "storageKey": "layout_login_particles_pixel_ratio",
      "control": "text",
      "label": "Pixel Ratio",
      "default": 1
    }
  ]
};
