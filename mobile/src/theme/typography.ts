import type { TextStyle } from "react-native";

/**
 * Typographic scale (numeric font sizes in dp).
 *
 * Derived from the app's actual `fontSize` usage: 11/12/13/14 are the body
 * range workhorses (13 is the most common), with larger steps for headings.
 */
export const fontSize = {
  xs: 11,
  sm: 12,
  base: 13,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  display: 28,
} as const;

export type FontSizeKey = keyof typeof fontSize;

/**
 * Font weights as React Native `TextStyle["fontWeight"]` string literals.
 * Mirrors the observed weights (500..900); 700/800 dominate the codebase.
 */
export const fontWeight = {
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
  black: "900",
} as const satisfies Record<string, TextStyle["fontWeight"]>;

export type FontWeightKey = keyof typeof fontWeight;

/**
 * Line heights (absolute dp, RN-style) paired with the common font sizes.
 * Values reflect the real `lineHeight` usage in the app.
 */
export const lineHeight = {
  xs: 15,
  sm: 16,
  base: 18,
  md: 20,
  lg: 22,
  xl: 32,
  display: 38,
} as const;

export type LineHeightKey = keyof typeof lineHeight;
