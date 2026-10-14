// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LoginEffect } from "../types";

export const shapeGridEffect: LoginEffect = {
  "id": "shape_grid",
  "name": "ShapeGrid",
  "label": "Shape Grid",
  "storagePrefix": "shape_grid",
  "props": [
    {
      "key": "direction",
      "storageKey": "layout_login_shape_grid_direction",
      "control": "select",
      "label": "Direction",
      "options": [
        {
          "value": "diagonal",
          "label": "Diagonal"
        },
        {
          "value": "up",
          "label": "Up"
        },
        {
          "value": "right",
          "label": "Right"
        },
        {
          "value": "down",
          "label": "Down"
        },
        {
          "value": "left",
          "label": "Left"
        }
      ],
      "default": "diagonal"
    },
    {
      "key": "borderColor",
      "storageKey": "layout_login_shape_grid_border_color",
      "control": "color",
      "label": "Border Color",
      "default": "#2F293A"
    },
    {
      "key": "hoverColor",
      "storageKey": "layout_login_shape_grid_hover_color",
      "control": "color",
      "label": "Hover Color",
      "default": "#222222"
    },
    {
      "key": "size",
      "storageKey": "layout_login_shape_grid_size",
      "control": "range",
      "label": "Shape Size",
      "min": 10,
      "max": 100,
      "step": 1,
      "default": 40
    },
    {
      "key": "speed",
      "storageKey": "layout_login_shape_grid_speed",
      "control": "range",
      "label": "Animation Speed",
      "min": 0.1,
      "max": 2,
      "step": 0.01,
      "default": 0.5
    },
    {
      "key": "shape",
      "storageKey": "layout_login_shape_grid_shape",
      "control": "select",
      "label": "Shape",
      "options": [
        {
          "value": "square",
          "label": "Square"
        },
        {
          "value": "hexagon",
          "label": "Hexagon"
        },
        {
          "value": "circle",
          "label": "Circle"
        },
        {
          "value": "triangle",
          "label": "Triangle"
        }
      ],
      "default": "square"
    },
    {
      "key": "hoverTrailAmount",
      "storageKey": "layout_login_shape_grid_hover_trail_amount",
      "control": "range",
      "label": "Hover Trail",
      "min": 0,
      "max": 20,
      "step": 1,
      "default": 0
    }
  ]
};
