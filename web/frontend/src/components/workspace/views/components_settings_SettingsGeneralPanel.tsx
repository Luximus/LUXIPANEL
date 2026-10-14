// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/settings/SettingsGeneralPanel.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";
import { TOGGLE_SWITCH } from "@/lib/ui-classes";
export default function components_settings_SettingsGeneralPanel(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;

  const { t } = Astro.props;

  return (
    <Fragment>
      <div id="panel-general" className="tab-panel">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-5 grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t.settings.general.labelPanelName}
              </label>
              <input
                id="s-panel-name"
                type="text"
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t.settings.general.labelTimezone}
              </label>
              <select
                id="s-timezone"
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/Denver">America/Denver</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="America/Mexico_City">America/Mexico_City</option>
                <option value="America/Bogota">America/Bogota</option>
                <option value="America/Lima">America/Lima</option>
                <option value="America/Santiago">America/Santiago</option>
                <option value="America/Buenos_Aires">
                  America/Buenos_Aires
                </option>
                <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                <option value="Europe/Madrid">Europe/Madrid</option>
                <option value="Europe/London">Europe/London</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t.settings.general.labelLanguage}
              </label>
              <select
                id="s-language"
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                defaultValue="en"
              >
                <option value="en">
                  {t.settings.general.languageOptions.en}
                </option>
                <option value="es">
                  {t.settings.general.languageOptions.es}
                </option>
              </select>
            </div>

            {/** Sesión / bloqueo / 2FA / auditoría — antes en "Seguridad", ahora en "General" */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t.settings.general.labelSessionTtl}
              </label>
              <input
                id="s-session-ttl"
                type="number"
                min="1"
                max="720"
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t.settings.general.labelMaxLoginAttempts}
              </label>
              <input
                id="s-max-login-attempts"
                type="number"
                min="3"
                max="20"
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="relative inline-flex cursor-pointer">
                <input
                  type="checkbox"
                  id="s-require-2fa"
                  className="peer sr-only"
                />
                <div className={TOGGLE_SWITCH}></div>
              </label>
              <span className="text-sm">
                {t.settings.general.labelRequire2fa}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <label className="relative mt-0.5 inline-flex shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  id="s-hcaptcha-enabled"
                  className="peer sr-only"
                />
                <div className={TOGGLE_SWITCH}></div>
              </label>
              <div className="min-w-0">
                <span className="text-sm">
                  {t.settings.general.hcaptchaEnabled}
                </span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.settings.general.hcaptchaEnabledHint}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="relative inline-flex cursor-pointer">
                <input
                  type="checkbox"
                  id="s-audit-log"
                  className="peer sr-only"
                />
                <div className={TOGGLE_SWITCH}></div>
              </label>
              <button
                id="btn-open-audit-log"
                type="button"
                className="hidden inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              >
                <i className="ti ti-history text-sm"></i>
                {t.settings.general.btnViewLog}
              </button>
              <span className="text-sm">
                {t.settings.general.labelAuditLog}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="relative inline-flex cursor-pointer">
                <input
                  type="checkbox"
                  id="s-switch-new-tab"
                  className="peer sr-only"
                />
                <div className={TOGGLE_SWITCH}></div>
              </label>
              <span className="text-sm">
                {t.settings.general.labelSwitchNewTab}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
