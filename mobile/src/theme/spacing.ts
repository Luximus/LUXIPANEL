/**
 * Spacing scale (numeric, in density-independent pixels).
 *
 * Derived from the most frequent padding/margin/gap values across the app's
 * StyleSheet definitions: 4, 6, 8, 10, 12, 16, 24, 32 dominate the usage.
 * Use these instead of hard-coded numbers to keep rhythm consistent.
 */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export type SpacingKey = keyof typeof spacing;

/**
 * Gap presets for flex/grid containers. Mirrors the dominant `gap` values
 * observed in layouts (6/8/10/12).
 */
export const gap = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
} as const;

export type GapKey = keyof typeof gap;

/**
 * Border-radius scale. `pill` (999) is the app's pattern for fully rounded
 * chips/avatars/buttons; sm..lg cover the common card/input rounding.
 */
export const radius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 16,
  pill: 999,
} as const;

export type RadiusKey = keyof typeof radius;
