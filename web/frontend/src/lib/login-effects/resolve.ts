// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Server-only. AuthLayout (login scope) y PanelLayout (panel scope) corrían la
// misma secuencia de 5 pasos para resolver el efecto react-bits seleccionado:
// id persistido (+ default) → registry → coerce de props → adapter → aplicar.
// Se centraliza aquí para no duplicarla; el `scope` selecciona la familia de
// claves persistidas (`layout_login_*` vs `layout_panel_*`).
import { LOGIN_EFFECTS_BY_ID, DEFAULT_LOGIN_EFFECT_ID, type LoginEffect } from "./registry";
import { coerceEffectProps, type BackgroundScope } from "./coerce";
import { LOGIN_EFFECT_PROP_ADAPTERS } from "@/components/login-effects/prop-adapters";

export interface ResolvedLoginEffect {
  effect: LoginEffect | undefined;
  props: Record<string, unknown>;
}

export function resolveLoginEffect(
  settings: Record<string, string>,
  scope: BackgroundScope = "login",
): ResolvedLoginEffect {
  const requestedId = settings[`layout_${scope}_background_type`] || DEFAULT_LOGIN_EFFECT_ID;
  const effect = LOGIN_EFFECTS_BY_ID[requestedId] || LOGIN_EFFECTS_BY_ID[DEFAULT_LOGIN_EFFECT_ID];
  let props: Record<string, unknown> = effect ? coerceEffectProps(effect, settings, scope) : {};
  const adapter = effect ? LOGIN_EFFECT_PROP_ADAPTERS[effect.id] : undefined;
  if (adapter) props = adapter(props);
  return { effect, props };
}
