// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

/** Only compensate for the part of this surface still covered by the keyboard.
 * A resized Android window already excludes the IME; fixed session surfaces and
 * iOS windows may still extend behind it. Both frames use screen coordinates. */
export function terminalKeyboardOverlap(surface: { y: number; height: number }, keyboardTop: number | null): number {
  if (keyboardTop === null || surface.height <= 0) return 0;
  return Math.max(0, Math.min(surface.height, surface.y + surface.height - keyboardTop));
}
