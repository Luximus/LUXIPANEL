// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/settings/SettingsLayoutPanel.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

import LoginEffectsConfig from "./components_settings_LoginEffectsConfig";
import {
  LAYOUT_COLOR_KEYS,
  DEFAULT_CUSTOM_LAYOUT_COLOR,
  DEFAULT_LAYOUT_PALETTE_ID,
} from "@/lib/layout-palettes";
export default function components_settings_SettingsLayoutPanel(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const { t, panelBgCopy, paletteCards, customPalettePreview, paletteJson } =
    Astro.props;

  return (
    <Fragment>
      <div id="panel-layout" className="tab-panel hidden space-y-5">
        <div className="grid gap-4" data-lxp-collapse-group>
          {/** Branding logos (sección colapsable; cabecera con toggle + acciones hermanas) */}
          <div
            className="rounded-xl border border-border bg-card overflow-hidden"
            data-lxp-collapse
          >
            <div className="group flex items-center gap-x-4 px-5 py-4 transition-colors hover:bg-muted/40">
              <button
                type="button"
                data-lxp-collapse-toggle
                aria-expanded="false"
                className="peer flex min-w-0 flex-1 items-center gap-x-4 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500/30"
              >
                <span className="flex size-11 flex-none items-center justify-center rounded-lg bg-muted/60 transition-colors group-hover:bg-muted">
                  <i className="ti ti-photo text-lg text-muted-foreground transition-colors group-hover:text-foreground"></i>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {t.settings.layout.branding.groupTitle}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t.settings.layout.branding.groupDesc}
                  </span>
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  id="btn-reset-layout"
                  type="button"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-fuchsia-500/40 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500/30"
                >
                  <i className="ti ti-rotate-2 text-sm"></i>
                  <span>{t.settings.layout.resetButton}</span>
                </button>
                <button
                  id="btn-restore-logos"
                  type="button"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-fuchsia-500/40 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500/30"
                >
                  <i className="ti ti-photo-cog text-sm"></i>
                  <span>{t.settings.layout.branding.restoreLogos}</span>
                </button>
              </div>
              {/** Chevron como último hermano (borde derecho, tras los botones). El
         script rota vía `trigger.querySelector` sólo cuando el chevron va
         dentro del toggle; aquí va fuera, así que la rotación la conduce
         Tailwind `peer-aria-expanded` reaccionando al aria-expanded que el
         script fija en el botón (marcado `peer`). Script sin tocar. */}
              <i
                className="ti ti-chevron-down shrink-0 text-base text-muted-foreground transition-transform duration-200 peer-aria-expanded:rotate-180"
                data-lxp-collapse-chevron
              ></i>
            </div>

            {/** Single logo applied to all surfaces (primary, sidebar, login, footer) and favicon */}
            <div className="m-4 overflow-hidden rounded-xl bg-muted/30 p-4">
              <div className="grid gap-4">
                <div className="logo-card rounded-xl border border-border bg-background/40 p-4 space-y-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t.settings.layout.branding.labelLogoUrl}
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-border bg-card overflow-hidden">
                      <img
                        id="preview-layout-logo"
                        alt=""
                        className="logo-preview h-full w-full object-contain"
                      />
                      <i className="logo-preview-fallback ti ti-photo text-muted-foreground/40 text-xl"></i>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <input
                        id="s-layout-logo"
                        type="text"
                        placeholder={t.settings.placeholders.logoUrl}
                        className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          data-upload-target="s-layout-logo"
                          className="btn-logo-upload inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors"
                        >
                          <i className="ti ti-upload text-sm"></i>
                          {t.settings.layout.branding.btnUpload}
                        </button>
                        <button
                          type="button"
                          data-pick-target="s-layout-logo"
                          className="btn-logo-pick inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors"
                        >
                          <i className="ti ti-photo text-sm"></i>
                          {t.settings.layout.branding.btnPick}
                        </button>
                        <button
                          type="button"
                          data-clear-target="s-layout-logo"
                          data-default="/panel/logo_300.webp"
                          className="btn-logo-default inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors text-muted-foreground"
                        >
                          <i className="ti ti-rotate text-sm"></i>
                          {t.settings.layout.branding.btnDefault}
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t.settings.layout.branding.logoUrlHelp}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/** Login background effects */}
          <div
            className="rounded-xl border border-border bg-card overflow-hidden"
            data-lxp-collapse
          >
            <button
              type="button"
              data-lxp-collapse-toggle
              aria-expanded="false"
              className="group flex w-full cursor-pointer select-none items-center gap-x-4 px-5 py-4 text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
            >
              <span className="flex size-11 flex-none items-center justify-center rounded-lg bg-muted/60 transition-colors group-hover:bg-muted">
                <i className="ti ti-photo-scan text-lg text-muted-foreground transition-colors group-hover:text-foreground"></i>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {t.settings.layout.loginBg.groupTitle}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t.settings.layout.loginBg.groupDesc}
                </span>
              </span>
              <i
                className="ti ti-chevron-down shrink-0 text-base text-muted-foreground transition-transform duration-200"
                data-lxp-collapse-chevron
              ></i>
            </button>
            <div className="m-4 overflow-hidden rounded-xl bg-muted/30 p-4 space-y-4">
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  id="s-layout-login-background-enabled"
                  type="checkbox"
                  className="layout-login-bg-field h-4 w-4 accent-primary"
                />
                {t.settings.layout.loginBg.enableLabel}
              </label>

              <div
                id="layout-login-fallback-color-settings"
                className="hidden space-y-1.5"
              >
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t.settings.layout.loginBg.labelFallbackColor}
                </label>
                <input
                  id="s-layout-login-background-fallback-color"
                  type="color"
                  className="layout-login-bg-field h-9 w-full cursor-pointer rounded-lg border border-input bg-background p-1"
                />
              </div>

              <div id="layout-login-background-settings" className="space-y-4">
                <LoginEffectsConfig
                  scope="login"
                  activeEffectLabel={
                    t.settings.layout.loginBg.labelActiveEffect
                  }
                />
              </div>

              <div className="space-y-2 border-t border-border/70 pt-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <i
                    className="ti ti-eye text-base text-primary"
                    aria-hidden="true"
                  ></i>
                  <span>
                    {t.settings.layout.loginBg.previewTitle ??
                      "Vista previa del acceso"}
                  </span>
                </div>
                <div className="aspect-[16/9] min-h-56 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                  <iframe
                    id="layout-login-preview"
                    title={
                      t.settings.layout.loginBg.previewTitle ??
                      "Vista previa del acceso"
                    }
                    src="/settings/login-preview"
                    loading="lazy"
                    className="h-full w-full border-0"
                  ></iframe>
                </div>
              </div>
            </div>
          </div>

          {/** Panel (app) background effects */}
          <div
            className="rounded-xl border border-border bg-card overflow-hidden"
            data-lxp-collapse
          >
            <button
              type="button"
              data-lxp-collapse-toggle
              aria-expanded="false"
              className="group flex w-full cursor-pointer select-none items-center gap-x-4 px-5 py-4 text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
            >
              <span className="flex size-11 flex-none items-center justify-center rounded-lg bg-muted/60 transition-colors group-hover:bg-muted">
                <i className="ti ti-wallpaper text-lg text-muted-foreground transition-colors group-hover:text-foreground"></i>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {panelBgCopy.groupTitle}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t.settings.layout.panelBg?.groupDesc ??
                    t.settings.layout.loginBg.groupDesc}
                </span>
              </span>
              <i
                className="ti ti-chevron-down shrink-0 text-base text-muted-foreground transition-transform duration-200"
                data-lxp-collapse-chevron
              ></i>
            </button>
            <div className="m-4 overflow-hidden rounded-xl bg-muted/30 p-4 space-y-4">
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  id="s-layout-panel-background-enabled"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                />
                {panelBgCopy.enableLabel}
              </label>

              <div
                id="layout-panel-fallback-color-settings"
                className="space-y-1.5"
              >
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {panelBgCopy.labelFallbackColor}
                </label>
                <input
                  id="s-layout-panel-background-fallback-color"
                  type="color"
                  className="h-9 w-full cursor-pointer rounded-lg border border-input bg-background p-1"
                />
              </div>

              <div
                id="layout-panel-background-settings"
                className="hidden space-y-4"
              >
                <LoginEffectsConfig
                  scope="panel"
                  activeEffectLabel={panelBgCopy.labelActiveEffect}
                />
              </div>
            </div>
          </div>

          {/** Forma y sombras */}
          <div
            className="rounded-xl border border-border bg-card overflow-hidden"
            data-lxp-collapse
          >
            <button
              type="button"
              data-lxp-collapse-toggle
              aria-expanded="false"
              className="group flex w-full cursor-pointer select-none items-center gap-x-4 px-5 py-4 text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
            >
              <span className="flex size-11 flex-none items-center justify-center rounded-lg bg-muted/60 transition-colors group-hover:bg-muted">
                <i className="ti ti-box-padding text-lg text-muted-foreground transition-colors group-hover:text-foreground"></i>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {t.settings.layout.shape.groupTitle}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t.settings.layout.shape.groupDesc}
                </span>
              </span>
              <i
                className="ti ti-chevron-down shrink-0 text-base text-muted-foreground transition-transform duration-200"
                data-lxp-collapse-chevron
              ></i>
            </button>
            <div className="m-4 overflow-hidden rounded-xl bg-muted/30 p-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t.settings.layout.shape.labelRadius}{" "}
                    <output
                      className="text-[11px] text-muted-foreground tabular-nums"
                      data-radius-output
                    ></output>
                  </label>
                  <input id="s-layout-radius" type="hidden" />
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    data-radius-range
                    className="w-full accent-primary"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t.settings.layout.shape.radiusHelp}
                  </p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t.settings.layout.shape.labelShadow}
                  </label>
                  <input id="s-layout-shadow" type="hidden" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border p-3 space-y-2">
                      <p className="text-xs font-medium text-foreground/90">
                        {t.settings.layout.shape.layer1}
                      </p>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          X{" "}
                          <output
                            className="text-[11px] text-muted-foreground tabular-nums"
                            data-range-output
                          ></output>
                        </label>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          step="1"
                          data-range-readout
                          data-shadow-target="s-layout-shadow"
                          data-shadow-layer="0"
                          data-shadow-part="x"
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Y{" "}
                          <output
                            className="text-[11px] text-muted-foreground tabular-nums"
                            data-range-output
                          ></output>
                        </label>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          step="1"
                          data-range-readout
                          data-shadow-target="s-layout-shadow"
                          data-shadow-layer="0"
                          data-shadow-part="y"
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Blur{" "}
                          <output
                            className="text-[11px] text-muted-foreground tabular-nums"
                            data-range-output
                          ></output>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          data-range-readout
                          data-shadow-target="s-layout-shadow"
                          data-shadow-layer="0"
                          data-shadow-part="blur"
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Spread{" "}
                          <output
                            className="text-[11px] text-muted-foreground tabular-nums"
                            data-range-output
                          ></output>
                        </label>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          step="1"
                          data-range-readout
                          data-shadow-target="s-layout-shadow"
                          data-shadow-layer="0"
                          data-shadow-part="spread"
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          {t.settings.layout.shape.labelColor}
                        </label>
                        <input
                          type="color"
                          data-shadow-target="s-layout-shadow"
                          data-shadow-layer="0"
                          data-shadow-part="color"
                          className="h-9 w-full cursor-pointer rounded-lg border border-input bg-background p-1"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Alpha{" "}
                          <output
                            className="text-[11px] text-muted-foreground tabular-nums"
                            data-range-output
                          ></output>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          data-range-readout
                          data-shadow-target="s-layout-shadow"
                          data-shadow-layer="0"
                          data-shadow-part="alpha"
                          className="w-full accent-primary"
                        />
                      </div>
                    </div>
                    <div className="rounded-lg border border-border p-3 space-y-2">
                      <p className="text-xs font-medium text-foreground/90">
                        {t.settings.layout.shape.layer2}
                      </p>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          X{" "}
                          <output
                            className="text-[11px] text-muted-foreground tabular-nums"
                            data-range-output
                          ></output>
                        </label>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          step="1"
                          data-range-readout
                          data-shadow-target="s-layout-shadow"
                          data-shadow-layer="1"
                          data-shadow-part="x"
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Y{" "}
                          <output
                            className="text-[11px] text-muted-foreground tabular-nums"
                            data-range-output
                          ></output>
                        </label>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          step="1"
                          data-range-readout
                          data-shadow-target="s-layout-shadow"
                          data-shadow-layer="1"
                          data-shadow-part="y"
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Blur{" "}
                          <output
                            className="text-[11px] text-muted-foreground tabular-nums"
                            data-range-output
                          ></output>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          data-range-readout
                          data-shadow-target="s-layout-shadow"
                          data-shadow-layer="1"
                          data-shadow-part="blur"
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Spread{" "}
                          <output
                            className="text-[11px] text-muted-foreground tabular-nums"
                            data-range-output
                          ></output>
                        </label>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          step="1"
                          data-range-readout
                          data-shadow-target="s-layout-shadow"
                          data-shadow-layer="1"
                          data-shadow-part="spread"
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          {t.settings.layout.shape.labelColor}
                        </label>
                        <input
                          type="color"
                          data-shadow-target="s-layout-shadow"
                          data-shadow-layer="1"
                          data-shadow-part="color"
                          className="h-9 w-full cursor-pointer rounded-lg border border-input bg-background p-1"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Alpha{" "}
                          <output
                            className="text-[11px] text-muted-foreground tabular-nums"
                            data-range-output
                          ></output>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          data-range-readout
                          data-shadow-target="s-layout-shadow"
                          data-shadow-layer="1"
                          data-shadow-part="alpha"
                          className="w-full accent-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t.settings.layout.shape.labelModalShadow}
                  </label>
                  <input id="s-layout-modal-shadow" type="hidden" />
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-xs font-medium text-foreground/90">
                      {t.settings.layout.shape.labelShadowSingle}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          X{" "}
                          <output
                            className="text-[11px] text-muted-foreground tabular-nums"
                            data-range-output
                          ></output>
                        </label>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          step="1"
                          data-range-readout
                          data-shadow-target="s-layout-modal-shadow"
                          data-shadow-layer="0"
                          data-shadow-part="x"
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Y{" "}
                          <output
                            className="text-[11px] text-muted-foreground tabular-nums"
                            data-range-output
                          ></output>
                        </label>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          step="1"
                          data-range-readout
                          data-shadow-target="s-layout-modal-shadow"
                          data-shadow-layer="0"
                          data-shadow-part="y"
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Blur{" "}
                          <output
                            className="text-[11px] text-muted-foreground tabular-nums"
                            data-range-output
                          ></output>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          data-range-readout
                          data-shadow-target="s-layout-modal-shadow"
                          data-shadow-layer="0"
                          data-shadow-part="blur"
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Spread{" "}
                          <output
                            className="text-[11px] text-muted-foreground tabular-nums"
                            data-range-output
                          ></output>
                        </label>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          step="1"
                          data-range-readout
                          data-shadow-target="s-layout-modal-shadow"
                          data-shadow-layer="0"
                          data-shadow-part="spread"
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          {t.settings.layout.shape.labelColor}
                        </label>
                        <input
                          type="color"
                          data-shadow-target="s-layout-modal-shadow"
                          data-shadow-layer="0"
                          data-shadow-part="color"
                          className="h-9 w-full cursor-pointer rounded-lg border border-input bg-background p-1"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Alpha{" "}
                          <output
                            className="text-[11px] text-muted-foreground tabular-nums"
                            data-range-output
                          ></output>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          data-range-readout
                          data-shadow-target="s-layout-modal-shadow"
                          data-shadow-layer="0"
                          data-shadow-part="alpha"
                          className="w-full accent-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {t.settings.layout.shape.labelModalBackdrop}
                  </label>
                  <input id="s-layout-modal-backdrop" type="hidden" />
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-xs font-medium text-foreground/90">
                      {t.settings.layout.shape.labelColor}
                    </p>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        {t.settings.layout.shape.labelColor}
                      </label>
                      <input
                        type="color"
                        data-shadow-target="s-layout-modal-backdrop"
                        data-shadow-part="color"
                        className="h-9 w-full cursor-pointer rounded-lg border border-input bg-background p-1"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Alpha{" "}
                        <output
                          className="text-[11px] text-muted-foreground tabular-nums"
                          data-range-output
                        ></output>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        data-range-readout
                        data-shadow-target="s-layout-modal-backdrop"
                        data-shadow-part="alpha"
                        className="w-full accent-primary"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t.settings.layout.shape.backdropHelp}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/** Color palettes (predefined layouts: pick one → re-themes the whole site) */}
          <div
            className="rounded-xl border border-border bg-card overflow-hidden"
            data-lxp-collapse
          >
            <button
              type="button"
              data-lxp-collapse-toggle
              aria-expanded="false"
              className="group flex w-full cursor-pointer select-none items-center gap-x-4 px-5 py-4 text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
            >
              <span className="flex size-11 flex-none items-center justify-center rounded-lg bg-muted/60 transition-colors group-hover:bg-muted">
                <i className="ti ti-palette text-lg text-muted-foreground transition-colors group-hover:text-foreground"></i>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {t.settings.layout.palettes.title}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t.settings.layout.palettes.subtitle}
                </span>
              </span>
              <i
                className="ti ti-chevron-down shrink-0 text-base text-muted-foreground transition-transform duration-200"
                data-lxp-collapse-chevron
              ></i>
            </button>

            <div className="m-4 overflow-hidden rounded-xl bg-muted/30 p-4">
              <div
                id="layout-palette-grid"
                className="grid gap-4 lg:grid-cols-2"
              >
                {paletteCards.map((p: any) => (
                  <Fragment>
                    <div className="layout-palette-item flex flex-col gap-2">
                      <div
                        data-palette-id={p.id}
                        tabIndex={0}
                        role="button"
                        aria-pressed="false"
                        className="layout-palette-card group relative flex h-full flex-col gap-3 rounded-xl border-2 border-border bg-background/60 p-3 text-left transition-all hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        <span className="palette-check absolute right-2.5 top-2.5 hidden h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <i className="ti ti-check text-[12px]"></i>
                        </span>
                        <div className="flex items-start gap-2 pr-6">
                          <span
                            className="h-4 w-4 shrink-0 rounded-full ring-2 ring-black/5 dark:ring-white/10"
                            style={cssStyle(
                              `background:${p.preview.light.primary}`,
                            )}
                          ></span>
                          <div className="min-w-0 flex-1">
                            <div className="min-w-0">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold leading-tight truncate">
                                  {p.name}
                                </p>
                                <p className="text-[11px] text-muted-foreground leading-tight truncate">
                                  {p.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-lg border border-border bg-background/55 p-3">
                          <div className="flex flex-col gap-3">
                            {p.id === "custom" && (
                              <Fragment>
                                <div className="space-y-2">
                                  <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    {t.settings.palettes.custom.baseColor}
                                  </label>
                                  <div className="flex items-center gap-1 rounded-md border border-border bg-background/70 px-1.5 py-1">
                                    <input
                                      id="s-layout-palette-custom-color-picker"
                                      type="color"
                                      defaultValue={
                                        customPalettePreview.light.primary
                                      }
                                      aria-label={
                                        t.settings.palettes.custom.baseColorAria
                                      }
                                      className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                                    />
                                    <input
                                      id="s-layout-palette-custom-color-text"
                                      type="text"
                                      defaultValue={
                                        customPalettePreview.light.primary
                                      }
                                      inputMode="text"
                                      spellCheck="false"
                                      aria-label={
                                        t.settings.palettes.custom.hexAria
                                      }
                                      className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-[10px] uppercase focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                  </div>
                                </div>
                              </Fragment>
                            )}
                            {p.id === "prisma" && (
                              <Fragment>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                      {t.settings.palettes.prisma.colors}
                                    </span>
                                    <label
                                      htmlFor="s-layout-palette-tornasol-color-picker"
                                      className="relative inline-flex h-7 cursor-pointer items-center justify-center gap-1 rounded-md border border-border px-2 text-[11px] font-semibold text-foreground transition hover:border-primary/50 hover:text-primary"
                                      aria-label={
                                        t.settings.palettes.prisma.addColorAria
                                      }
                                    >
                                      <i
                                        className="ti ti-plus text-[12px]"
                                        aria-hidden="true"
                                      ></i>
                                      <span>
                                        {
                                          t.settings.palettes.prisma
                                            .addColorButton
                                        }
                                      </span>
                                      <input
                                        id="s-layout-palette-tornasol-color-picker"
                                        type="color"
                                        defaultValue={
                                          DEFAULT_CUSTOM_LAYOUT_COLOR
                                        }
                                        aria-label={
                                          t.settings.palettes.prisma
                                            .addColorInputAria
                                        }
                                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                      />
                                    </label>
                                  </div>
                                  <div
                                    id="s-layout-palette-tornasol-colors"
                                    className="flex min-h-20 flex-col gap-1.5 rounded-lg border border-dashed border-border/80 bg-background/40 p-2"
                                  ></div>
                                  <p className="text-[10px] leading-tight text-muted-foreground">
                                    {t.settings.palettes.prisma.helpText}
                                  </p>
                                </div>
                              </Fragment>
                            )}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                {t.settings.layout.palettes.intensity}
                              </label>
                              <div className="flex items-center gap-1.5">
                                <i
                                  className="ti ti-sun text-[12px] text-muted-foreground/70"
                                  aria-hidden="true"
                                ></i>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="1"
                                  defaultValue="50"
                                  data-palette-intensity
                                  data-palette-id={p.id}
                                  aria-label={
                                    t.settings.layout.palettes.intensity
                                  }
                                  className="layout-palette-intensity h-1.5 flex-1 cursor-pointer accent-primary"
                                />
                                <i
                                  className="ti ti-moon text-[12px] text-muted-foreground/70"
                                  aria-hidden="true"
                                ></i>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>

            {/* Hidden inputs hold the per-color values so save/load stays unchanged. */}
            <div className="hidden" aria-hidden="true">
              <input
                type="hidden"
                id="s-layout-palette-id"
                defaultValue={DEFAULT_LAYOUT_PALETTE_ID}
              />
              <input
                type="hidden"
                id="s-layout-palette-custom-color"
                defaultValue={DEFAULT_CUSTOM_LAYOUT_COLOR}
              />
              <input
                type="hidden"
                id="s-layout-tornasol-color"
                defaultValue={DEFAULT_CUSTOM_LAYOUT_COLOR}
              />
              <input
                type="hidden"
                id="s-layout-tornasol-colors"
                defaultValue='["#7c3aed","#06b6d4","#f59e0b"]'
              />
              <input
                type="hidden"
                id="s-layout-tornasol-intensity"
                defaultValue="50"
              />
              {(["light", "dark"] as const).map((mode: any) =>
                LAYOUT_COLOR_KEYS.map((key: any) => (
                  <Fragment>
                    <input
                      type="hidden"
                      id={`s-layout-${mode}-${key.replace(/_/g, "-")}`}
                    />
                  </Fragment>
                )),
              )}
            </div>

            <script
              id="lxp-layout-palettes"
              type="application/json"
              dangerouslySetInnerHTML={{ __html: paletteJson }}
            ></script>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
