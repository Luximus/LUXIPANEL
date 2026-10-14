// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Central registry of every react-bits login background effect.
// The full-controls schema per effect lives in ./effects/<id>.ts (grouped in
// the effects/ folder) and is assembled here into the public catalog. Shared by
// AuthLayout (SSR render), the settings page (SSR controls) and the settings
// client script (defaults / element ids / show-hide). Pure data only.

import type { LoginEffect } from "./types";
import { ALL_LOGIN_EFFECTS } from "./effects";

export type { LoginEffectControl, LoginEffectProp, LoginEffect } from "./types";

export const LOGIN_EFFECTS: LoginEffect[] = ALL_LOGIN_EFFECTS;

export const LOGIN_EFFECTS_BY_ID: Record<string, LoginEffect> = Object.fromEntries(
  LOGIN_EFFECTS.map((e) => [e.id, e]),
);

/** Default active effect (matches the pre-existing install default). */
export const DEFAULT_LOGIN_EFFECT_ID = "letter_glitch";
