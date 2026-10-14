// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/settings/LoginEffectsConfig.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Registry-driven react-bits effect selector + per-effect control panels.
// One panel per effect; the active one is toggled by the settings script
// (updateBackgroundSettingsVisibility) via the `data-<scope>-effect-panel`
// attribute matching the select value. `scope` selects the persisted key family
// (login → layout_login_*, panel → layout_panel_*) so the same component drives
// both the login background and the panel background, each independently.
import {
  LOGIN_EFFECTS,
  DEFAULT_LOGIN_EFFECT_ID,
} from "@/lib/login-effects/registry";
import type { BackgroundScope } from "@/lib/login-effects/coerce";
import { getMessages } from "../view-context";
import { localeFromRequest } from "../view-context";
import LoginEffectControl from "./components_settings_LoginEffectControl";
export default function components_settings_LoginEffectsConfig(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  interface Props {
    activeEffectLabel: string;
    scope?: BackgroundScope;
  }
  const { activeEffectLabel, scope = "login" } = Astro.props;
  const selectId = `s-layout-${scope}-background-type`;
  const locale = localeFromRequest(Astro.request);
  const t = getMessages(locale, ["components"]);
  const defaultSuffix = t.components.loginEffects.defaultSuffix;

  return (
    <Fragment>
      <div className="space-y-1.5">
        <label
          className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
          htmlFor={selectId}
        >
          {activeEffectLabel}
        </label>
        <select
          id={selectId}
          className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {LOGIN_EFFECTS.map((e: any) => (
            <Fragment>
              <option value={e.id}>
                {e.label}
                {e.id === DEFAULT_LOGIN_EFFECT_ID ? defaultSuffix : ""}
              </option>
            </Fragment>
          ))}
        </select>
      </div>

      {LOGIN_EFFECTS.map((e: any) => (
        <Fragment>
          <div
            id={`layout-${scope}-effect-${e.id}-settings`}
            data-background-effect-panel={e.id}
            data-background-scope={scope}
            className="hidden space-y-3 rounded-lg border border-border/60 p-3"
          >
            <p className="text-xs font-medium text-foreground/90">{e.label}</p>
            {e.requiresWebGpu && (
              <Fragment>
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <i
                    className="ti ti-device-desktop-analytics mt-0.5 shrink-0"
                    aria-hidden="true"
                  ></i>
                  {t.components.loginEffects.webGpuHint}
                </p>
              </Fragment>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {e.props.map((prop: any) => (
                <Fragment>
                  <LoginEffectControl prop={prop} scope={scope} />
                </Fragment>
              ))}
            </div>
          </div>
        </Fragment>
      ))}
    </Fragment>
  );
}
