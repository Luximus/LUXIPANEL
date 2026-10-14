// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Full-controls schema types for every react-bits login background effect.
// Shared by AuthLayout (SSR render), the settings page (SSR controls) and the
// settings client script (defaults / element ids / show-hide). Pure types only.

export type LoginEffectControl =
  | "range" | "number" | "color" | "rgb01" | "checkbox" | "text" | "select" | "json" | "items";

export interface LoginEffectProp {
  /** Component prop name (camelCase). */
  key: string;
  /** Persisted settings key: layout_login_<prefix>_<snake(key)>. */
  storageKey: string;
  control: LoginEffectControl;
  label: string;
  default: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

export interface LoginEffect {
  id: string;
  /** react-bits component name (PascalCase). */
  name: string;
  /** Display label (proper noun, not translated). */
  label: string;
  /** Storage key prefix (usually === id). */
  storagePrefix: string;
  /** Uses WebGPU; the runtime falls back to the default effect if unavailable. */
  requiresWebGpu?: boolean;
  props: LoginEffectProp[];
}
