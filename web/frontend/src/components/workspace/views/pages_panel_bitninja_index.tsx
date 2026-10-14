// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/bitninja/index.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * BitNinja — /panel/bitninja
 *
 * Server-security agent management. BitNinja is commercial: the install needs
 * the CLIENT's own license key (entered below). All privileged actions reuse
 * the session passphrase (LP one-passphrase sudo model); if sudo refuses, the
 * UI prompts for it via the "Contraseña sudo" field.
 */
import PanelLayout from "../module-frame";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import SettingsSectionLayout from "./components_ui_SettingsSectionLayout";
import { getPageMessages } from "../view-context";
export default function pages_panel_bitninja_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["bitninja"]);

  return (
    <Fragment>
      <PanelLayout title="BitNinja" activeModule="bitninja">
        <div slot="title-actions">
          <ViewSettingsModal
            id="bitninja-settings-modal"
            title={t.bitninja.settingsUi.settingsTitle}
            buttonLabel={t.bitninja.settingsUi.settingsButton}
            description={t.bitninja.settingsUi.settingsDescription}
            variant="drawer"
            hideFooter={true}
          >
            <SettingsSectionLayout
              id="bitninja-settings"
              label={t.bitninja.settingsUi.settingsSections}
              sections={[
                {
                  id: "diagnostics",
                  label: t.bitninja.settingsUi.diagnostics,
                  icon: "ti-activity-heartbeat",
                },
                {
                  id: "related",
                  label: t.bitninja.settingsUi.related,
                  icon: "ti-apps",
                },
              ]}
            >
              <section
                id="bitninja-settings-panel-diagnostics"
                data-lxp-settings-panel="diagnostics"
                role="tabpanel"
                aria-labelledby="bitninja-settings-tab-diagnostics"
                className="space-y-4 text-sm"
              >
                <h2 className="font-semibold">
                  {t.bitninja.settingsUi.diagnostics}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t.bitninja.settingsUi.logSource}
                </p>
                <label className="flex items-center gap-3">
                  <input
                    id="bn-auto-refresh"
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                  />
                  {t.bitninja.settingsUi.autoRefresh}
                </label>
                <label className="flex items-center gap-3">
                  {t.bitninja.settingsUi.logLines}
                  <select
                    id="bn-log-lines"
                    className="rounded-md border border-border bg-background px-2 py-1"
                  >
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                  </select>
                </label>
              </section>
              <section
                id="bitninja-settings-panel-related"
                data-lxp-settings-panel="related"
                role="tabpanel"
                aria-labelledby="bitninja-settings-tab-related"
                className="hidden space-y-4 text-sm"
              >
                <h2 className="font-semibold">
                  {t.bitninja.settingsUi.relatedModules}
                </h2>
                <div className="flex flex-col gap-2">
                  <a
                    href="/panel/firewall"
                    className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                  >
                    <i className="ti ti-shield mr-2"></i>
                    {t.bitninja.settingsUi.firewallAudit}
                  </a>
                  <a
                    href="/panel/settings#cred-bitninja"
                    className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                  >
                    <i className="ti ti-key mr-2"></i>
                    {t.bitninja.settingsUi.credentials}
                  </a>
                </div>
              </section>
            </SettingsSectionLayout>
          </ViewSettingsModal>
        </div>
        <div id="bitninja-root" className="space-y-6">
          {/** Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <i className="ti ti-shield-check text-primary"></i>BitNinja
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t.bitninja.header.description}
              </p>
            </div>
            <div
              id="bn-status-badge"
              className="shrink-0 rounded-full border px-3 py-1 text-xs font-medium border-border text-muted-foreground"
            >
              {t.bitninja.header.statusChecking}
            </div>
          </div>

          {/** Sudo passphrase (shared by privileged actions) */}
          <div className="rounded-xl border border-border bg-card p-4">
            <label
              className="block text-xs font-medium text-muted-foreground mb-1"
              htmlFor="bn-sudo"
            >
              {t.bitninja.sudo.label}
            </label>
            <input
              id="bn-sudo"
              type="password"
              autoComplete="off"
              placeholder={t.bitninja.sudo.placeholder}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {t.bitninja.sudo.hint}
            </p>
          </div>

          {/** Install card (shown when NOT installed) */}
          <div
            id="bn-install-card"
            className="hidden rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5"
          >
            <p className="font-semibold flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <i className="ti ti-download"></i>
              {t.bitninja.installCard.title}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t.bitninja.installCard.description}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <a href="/panel/settings#cred-bitninja" className="text-sm text-primary hover:underline">{t.bitninja.settingsUi.credentials}</a>
              <button
                id="btn-bn-install"
                className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <i className="ti ti-download text-sm"></i>
                {t.bitninja.installCard.installButton}
              </button>
            </div>
          </div>

          {/** Status + controls (shown when installed) */}
          <div id="bn-manage" className="hidden space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">
                  {t.bitninja.stats.service}
                </p>
                <p id="bn-running" className="text-lg font-bold">
                  —
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">
                  {t.bitninja.stats.license}
                </p>
                <p id="bn-license-state" className="text-lg font-bold">
                  —
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">
                  {t.bitninja.stats.version}
                </p>
                <p id="bn-version" className="text-lg font-bold">
                  —
                </p>
              </div>
            </div>

            {/** Service controls */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium mb-3">
                {t.bitninja.serviceControl.title}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  data-bn-service="start"
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20"
                >
                  <i className="ti ti-player-play text-sm"></i>
                  {t.bitninja.serviceControl.start}
                </button>
                <button
                  data-bn-service="restart"
                  className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                >
                  <i className="ti ti-refresh text-sm"></i>
                  {t.bitninja.serviceControl.restart}
                </button>
                <button
                  data-bn-service="stop"
                  className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
                >
                  <i className="ti ti-player-stop text-sm"></i>
                  {t.bitninja.serviceControl.stop}
                </button>
              </div>
            </div>

            {/** Components */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium mb-3">
                {t.bitninja.components.title}
              </p>
              <div id="bn-components" className="grid gap-2 sm:grid-cols-2">
                <p className="text-xs text-muted-foreground">
                  {t.bitninja.components.checking}
                </p>
              </div>
            </div>

            {/** Update license */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium mb-3">
                {t.bitninja.updateLicense.title}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <a href="/panel/settings#cred-bitninja" className="text-sm text-primary hover:underline">{t.bitninja.settingsUi.credentials}</a>
                <button
                  id="btn-bn-license"
                  className="inline-flex items-center justify-center gap-1 rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20"
                >
                  <i className="ti ti-key text-sm"></i>
                  {t.bitninja.updateLicense.applyButton}
                </button>
              </div>
            </div>
          </div>

          {/** Command output */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">
                  {t.bitninja.logsUi.logsTitle}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t.bitninja.logsUi.logsDescription}
                </p>
              </div>
              <button
                id="bn-load-logs"
                type="button"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                {t.bitninja.logsUi.refreshLogs}
              </button>
            </div>
            <pre
              id="bn-logs"
              className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground"
            >
              {t.bitninja.logsUi.logsHint}
            </pre>
          </div>
          <pre
            id="bn-output"
            className="hidden max-h-64 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 text-[11px] font-mono whitespace-pre-wrap"
          ></pre>
        </div>

        {/** Toast */}
        <div
          id="toast"
          className="hidden fixed bottom-4 right-4 z-50 max-w-xs rounded-xl border px-4 py-3 shadow-lg text-sm font-medium"
        >
          <span id="toast-msg"></span>
        </div>
      </PanelLayout>

      <script
        id="bitninja-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["bitninja"]) }}
      ></script>
    </Fragment>
  );
}
