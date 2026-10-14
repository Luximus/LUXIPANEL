import type { ViewStyle } from "react-native";

/**
 * Shadow presets for React Native views.
 *
 * iOS uses `shadowColor/Opacity/Radius/Offset`; Android uses `elevation`.
 * Each preset sets both so a single spread covers both platforms, matching the
 * patterns already in the codebase (cards: r10/op0.14/h4/e3; floating/overlay:
 * r12/op0.3/h6/e8). The color stays "#000" — tint via `shadowColor` override
 * (e.g. tokens.brandGlow) when a branded glow is needed.
 */

export type ShadowPreset = Pick<
  ViewStyle,
  "shadowColor" | "shadowOpacity" | "shadowRadius" | "shadowOffset" | "elevation"
>;

export const shadows = {
  none: {
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  sm: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  md: {
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  lg: {
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
} as const satisfies Record<string, ShadowPreset>;

export type ShadowKey = keyof typeof shadows;
