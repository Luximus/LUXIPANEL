// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** TeamTemplatesModal palette + wizard constants — extracted verbatim. */
import type { ApplySlotOverrides } from "../assistant-api";

// Re-declared locally to keep this modal self-contained; mirrors
// COLOR_PRESETS in AgentsTab so cards look identical. Slot avatars are
// Avataaars generated locally from `avatarConfig` (see ./agent-avataaars).
export const COLOR_TINT: Record<string, string> = {
  violet: "bg-violet-500/15",
  blue: "bg-blue-500/15",
  emerald: "bg-emerald-500/15",
  amber: "bg-amber-500/15",
  red: "bg-red-500/15",
  rose: "bg-rose-500/15",
  slate: "bg-slate-500/15",
  cyan: "bg-cyan-500/15",
  pink: "bg-pink-500/15",
  teal: "bg-teal-500/15",
  green: "bg-green-500/15",
  orange: "bg-orange-500/15",
};
export const COLOR_TEXT: Record<string, string> = {
  violet: "text-violet-500",
  blue: "text-blue-500",
  emerald: "text-emerald-500",
  amber: "text-amber-500",
  red: "text-red-500",
  rose: "text-rose-500",
  slate: "text-slate-500",
  cyan: "text-cyan-500",
  pink: "text-pink-500",
  teal: "text-teal-500",
  green: "text-green-500",
  orange: "text-orange-500",
};

export const STEP_TOTAL = 5;

export type SlotOverrides = Record<string, ApplySlotOverrides>;
