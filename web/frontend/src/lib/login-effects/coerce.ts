// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Turns the flat persisted `layout_<scope>_*` settings into a typed props object
// for a given react-bits effect, using its registry schema. Used by AuthLayout
// (login scope) and PanelLayout (panel scope) at SSR before spreading the props
// into the react-bits component. Pure / SSR-safe.
import { parseLayoutBoolean, parseLayoutNumber } from "@/lib/layout-context";
import type { LoginEffect, LoginEffectProp } from "./registry";

// Background scopes that reuse the same react-bits effect registry. The registry
// stores keys as `layout_login_*`; other scopes derive their persisted key by
// swapping the scope segment (e.g. `layout_panel_*`). Single source of truth for
// scope→key derivation, shared by the SSR layouts and the settings client script
// (which mirrors this with a plain string replace).
export type BackgroundScope = "login" | "panel";

export function scopedStorageKey(storageKey: string, scope: BackgroundScope): string {
  return scope === "login" ? storageKey : storageKey.replace(/^layout_login_/, `layout_${scope}_`);
}

export function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec((hex || "").trim());
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

function coerceOne(p: LoginEffectProp, raw: string | undefined): unknown {
  const has = raw !== undefined && raw !== null && raw !== "";
  switch (p.control) {
    case "range":
    case "number":
      return parseLayoutNumber(has ? String(raw) : undefined, Number(p.default));
    case "checkbox":
      return parseLayoutBoolean(has ? String(raw) : undefined, Boolean(p.default));
    case "rgb01":
      return hexToRgb01(has ? String(raw) : String(p.default));
    case "json":
    case "items":
      try {
        return JSON.parse(has ? String(raw) : String(p.default));
      } catch {
        return [];
      }
    default: // color, text, select
      return has ? String(raw) : String(p.default);
  }
}

/**
 * Build `{ [propKey]: value }` for an effect from the persisted settings map.
 * `scope` selects which persisted key family to read (`login` → `layout_login_*`,
 * `panel` → `layout_panel_*`); defaults to `login` for backward compatibility.
 */
export function coerceEffectProps(
  effect: LoginEffect,
  settings: Record<string, string>,
  scope: BackgroundScope = "login",
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of effect.props) out[p.key] = coerceOne(p, settings[scopedStorageKey(p.storageKey, scope)]);
  return out;
}
