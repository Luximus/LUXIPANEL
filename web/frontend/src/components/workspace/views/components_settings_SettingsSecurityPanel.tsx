// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/settings/SettingsSecurityPanel.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

export default function components_settings_SettingsSecurityPanel(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;

  const { t } = Astro.props;

  return (
    <Fragment>
      <div id="panel-security" className="tab-panel hidden">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-5 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {t.settings.security.loginMethodsTitle}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {t.settings.security.loginMethodsDesc}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {/** Passkey */}
                <label className="login-method-card flex items-start gap-3 rounded-xl border-2 border-border p-4 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-all">
                  <input
                    type="checkbox"
                    id="s-login-allow-passkey"
                    className="login-method-check mt-0.5 h-4 w-4 accent-primary"
                    defaultChecked
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <i className="ti ti-fingerprint text-sm text-blue-500"></i>
                      <p className="text-sm font-medium">
                        {t.settings.security.passkey.name}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.settings.security.passkey.desc}
                    </p>
                    <span
                      id="passkey-status-badge"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-muted-foreground"
                    >
                      <i className="ti ti-info-circle text-xs"></i>{" "}
                      <span id="passkey-status-text">
                        {t.settings.security.passkey.verifying}
                      </span>
                    </span>
                    <div className="mt-3">
                      <button
                        id="btn-manage-passkeys"
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                      >
                        <i className="ti ti-settings text-sm"></i>
                        {t.settings.security.passkey.btnManage}
                      </button>
                    </div>
                  </div>
                </label>
                {/** Contraseña */}
                <label className="login-method-card flex items-start gap-3 rounded-xl border-2 border-border p-4 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-all">
                  <input
                    type="checkbox"
                    id="s-login-allow-password"
                    className="login-method-check mt-0.5 h-4 w-4 accent-primary"
                    defaultChecked
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <i className="ti ti-lock text-sm text-primary"></i>
                      <p className="text-sm font-medium">
                        {t.settings.security.password.name}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.settings.security.password.desc}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                      <i className="ti ti-circle-check text-xs"></i>{" "}
                      {t.settings.security.password.configured}
                    </span>
                  </div>
                </label>
                {/** Recuperación */}
                <label className="login-method-card flex items-start gap-3 rounded-xl border-2 border-border p-4 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-all">
                  <input
                    type="checkbox"
                    id="s-login-allow-recovery"
                    className="login-method-check mt-0.5 h-4 w-4 accent-primary"
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <i className="ti ti-shield-check text-sm text-amber-500"></i>
                      <p className="text-sm font-medium">
                        {t.settings.security.recovery.name}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.settings.security.recovery.desc}
                    </p>
                    <span
                      id="recovery-status-badge"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-muted-foreground"
                    >
                      <i className="ti ti-info-circle text-xs"></i>{" "}
                      <span id="recovery-status-text">
                        {t.settings.security.recovery.verifying}
                      </span>
                    </span>
                    <div className="mt-3">
                      <button
                        id="btn-manage-recovery"
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                      >
                        <i className="ti ti-settings text-sm"></i>
                        {t.settings.security.recovery.btnManage}
                      </button>
                    </div>
                  </div>
                </label>
              </div>
              {/** Aviso de mínimo 1 activo */}
              <p
                id="login-methods-warning"
                className="hidden mt-3 text-xs text-destructive"
              >
                <i className="ti ti-alert-triangle mr-1"></i>
                {t.settings.security.loginMethodsWarning}
              </p>
            </div>
            <div className="sm:col-span-2 border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {t.settings.security.twoFaStatus.groupTitle}
              </p>
              <div className="rounded-xl border border-border bg-background p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <span
                    id="s-self-2fa-badge"
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-muted text-muted-foreground"
                  >
                    <i className="ti ti-circle-x text-sm"></i>
                    {t.settings.security.twoFaStatus.badgeDisabled}
                  </span>
                  <p
                    id="s-self-2fa-text"
                    className="text-xs text-muted-foreground mt-2"
                  >
                    {t.settings.security.twoFaStatus.promptText}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    id="btn-setup-2fa-settings"
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <i className="ti ti-plus text-sm"></i>
                    {t.settings.security.twoFaStatus.btnSetup}
                  </button>
                  <button
                    id="btn-disable-2fa-settings"
                    type="button"
                    className="hidden inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors"
                  >
                    <i className="ti ti-trash text-sm"></i>
                    {t.settings.security.twoFaStatus.btnDelete}
                  </button>
                  <button
                    id="btn-deactivate-2fa-settings"
                    type="button"
                    className="hidden inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    <i className="ti ti-power text-sm"></i>
                    {t.settings.security.twoFaStatus.btnDisable}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
