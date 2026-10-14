// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/firewall/index.astro.
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
 * Firewall Manager — /panel/firewall
 */
import PanelLayout from "../module-frame";
import ModalNavbar from "./components_ui_ModalNavbar";
import InstallModal from "./components_InstallModal";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import SettingsSectionLayout from "./components_ui_SettingsSectionLayout";
import { hasAction } from "../view-context";
import { getPageMessages } from "../view-context";
export default function pages_panel_firewall_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["firewall"]);
  const user = Astro.locals.user;
  const userModules = new Set(user?.modules ?? []);
  const canUseSecurityAudit =
    user?.kind === "admin" || userModules.has("security-audit");
  const canManageFirewall = !!user && hasAction(user, "firewall.manage");
  const fws = t.firewall.settingsUi;
  const firewallSettingsSections = [
    { id: "rules", label: fws.rulesView, icon: "ti-adjustments-horizontal" },
    ...(canManageFirewall
      ? [{ id: "logging", label: fws.ufwLog, icon: "ti-file-text" }]
      : []),
    { id: "related", label: fws.related, icon: "ti-apps" },
  ];
  const firewallView = Astro.url.searchParams.get("workspaceView");
  const isolatedFirewallView =
    Astro.url.searchParams.get("embed") === "1" &&
    !Astro.url.searchParams.has("settingsOverlay") &&
    ["audit", "rules", "fail2ban"].includes(firewallView ?? "");
  const showFirewallView = (view: string) =>
    !isolatedFirewallView || firewallView === view;

  return (
    <Fragment>
      <PanelLayout title={t.firewall.pageTitle} activeModule="firewall">
        <div slot="title-actions">
          <ViewSettingsModal
            id="firewall-settings-modal"
            title={fws.title}
            description={fws.description}
            variant="drawer"
            hideFooter={true}
          >
            <SettingsSectionLayout
              id="firewall-settings"
              label={fws.sectionsLabel}
              sections={firewallSettingsSections}
            >
              <section
                id="firewall-settings-panel-rules"
                data-lxp-settings-panel="rules"
                role="tabpanel"
                aria-labelledby="firewall-settings-tab-rules"
                className="space-y-4 text-sm"
              >
                <h2 className="font-semibold">{fws.rulesView}</h2>
                <label className="block">
                  {fws.showActions}
                  <select
                    id="fw-filter-action"
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <option value="">{fws.all}</option>
                    <option value="ALLOW">
                      {t.firewall.ruleDialog.optionAllow}
                    </option>
                    <option value="DENY">
                      {t.firewall.ruleDialog.optionDeny}
                    </option>
                    <option value="REJECT">
                      {t.firewall.ruleDialog.optionReject}
                    </option>
                    <option value="LIMIT">{fws.limit}</option>
                  </select>
                </label>
              </section>
              {canManageFirewall && (
                <Fragment>
                  <section
                    id="firewall-settings-panel-logging"
                    data-lxp-settings-panel="logging"
                    role="tabpanel"
                    aria-labelledby="firewall-settings-tab-logging"
                    className="hidden space-y-4 text-sm"
                  >
                    <h2 className="font-semibold">{fws.ufwLog}</h2>
                    <p className="text-xs text-muted-foreground">
                      {fws.serverSettingHint}
                    </p>
                    <label className="block">
                      {fws.logLevel}
                      <select
                        id="fw-log-level"
                        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2"
                      >
                        <option value="off">{fws.off}</option>
                        <option value="low">{fws.low}</option>
                        <option value="medium">{fws.medium}</option>
                        <option value="high">{fws.high}</option>
                        <option value="full">{fws.full}</option>
                      </select>
                    </label>
                    <button
                      id="fw-save-logging"
                      type="button"
                      className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                    >
                      {fws.saveLevel}
                    </button>
                  </section>
                </Fragment>
              )}
              <section
                id="firewall-settings-panel-related"
                data-lxp-settings-panel="related"
                role="tabpanel"
                aria-labelledby="firewall-settings-tab-related"
                className="hidden space-y-4 text-sm"
              >
                <h2 className="font-semibold">{fws.relatedModules}</h2>
                <div className="flex flex-col gap-2 text-xs">
                  <a
                    href="/panel/bitninja"
                    className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                  >
                    BitNinja
                  </a>
                  <a
                    href="/panel/cloudflare"
                    className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                  >
                    Cloudflare
                  </a>
                </div>
              </section>
            </SettingsSectionLayout>
          </ViewSettingsModal>
        </div>

        {/** Install warning (hidden when UFW/Fail2ban are detected) */}
        <div
          id="fw-not-installed"
          className="hidden mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-400"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold flex items-center gap-2">
                <i className="ti ti-alert-triangle"></i>
                <span id="fw-not-installed-title">
                  {t.firewall.installWarning.title}
                </span>
              </p>
              <p className="mt-1" id="fw-not-installed-desc">
                {t.firewall.installWarning.description}
              </p>
            </div>
            <button
              id="btn-install-firewall"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <i className="ti ti-download"></i>
              <span>{t.firewall.installWarning.btnInstall}</span>
            </button>
          </div>
        </div>

        {/** Status card */}
        <div
          id="fw-status-card"
          className="mb-6 flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-4 flex-1">
            <div
              id="fw-icon"
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted"
            >
              <i className="ti ti-shield text-2xl text-muted-foreground"></i>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t.firewall.statusCard.label}
              </p>
              <p id="fw-status-label" className="text-xl font-bold">
                {t.firewall.statusCard.verifying}
              </p>
              <p id="fw-policy" className="text-xs text-muted-foreground"></p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button
              id="btn-ai-analyze"
              className="rounded-lg bg-gradient-to-r from-primary/15 to-purple-500/15 px-4 py-2 text-sm font-medium text-primary hover:from-primary/25 hover:to-purple-500/25 transition-colors"
            >
              <i className="ti ti-sparkles mr-1.5"></i>
              {t.firewall.aiAssistant.btnAnalyze}
            </button>
            <button
              id="btn-disable-fw"
              className="hidden rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <i className="ti ti-shield-off mr-1.5"></i>
              {t.firewall.statusCard.btnDisable}
            </button>
            <button
              id="btn-enable-fw"
              className="hidden rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 transition-colors"
            >
              <i className="ti ti-shield-check mr-1.5"></i>
              {t.firewall.statusCard.btnEnable}
            </button>
          </div>
        </div>

        {/** Security Audit Tab */}
        {showFirewallView("audit") && (
          <Fragment>
            <div
              id="security-audit-section"
              data-enabled={canUseSecurityAudit ? "true" : "false"}
              className="mb-6"
            >
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div className="flex items-center gap-3">
                    <i className="ti ti-shield-alert text-xl text-primary"></i>
                    <h2 className="text-base font-semibold">
                      {t.firewall.securityAudit.title}
                    </h2>
                  </div>
                  <button
                    id="btn-start-audit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    <i className="ti ti-scan text-sm"></i>
                    {t.firewall.securityAudit.btnStartAudit}
                  </button>
                </div>
                <div className="p-5">
                  {/** Scanner install status */}
                  <div
                    id="audit-scanners-grid"
                    className="mb-4 grid gap-2 sm:grid-cols-2"
                  >
                    <div
                      data-scanner="bitninja"
                      className="audit-scanner-row flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">BitNinja</p>
                        <p className="audit-scanner-status text-xs text-muted-foreground">
                          {t.firewall.securityAudit.scannerChecking}
                        </p>
                      </div>
                      <button
                        data-scanner-install="bitninja"
                        className="hidden inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        <i className="ti ti-download text-sm"></i>
                        {t.firewall.securityAudit.btnInstallScanner}
                      </button>
                    </div>
                    <div
                      data-scanner="lynis"
                      className="audit-scanner-row flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">Lynis</p>
                        <p className="audit-scanner-status text-xs text-muted-foreground">
                          {t.firewall.securityAudit.scannerChecking}
                        </p>
                      </div>
                      <button
                        data-scanner-install="lynis"
                        className="hidden inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        <i className="ti ti-download text-sm"></i>
                        {t.firewall.securityAudit.btnInstallScanner}
                      </button>
                    </div>
                    <div
                      data-scanner="rkhunter"
                      className="audit-scanner-row flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">rkhunter</p>
                        <p className="audit-scanner-status text-xs text-muted-foreground">
                          {t.firewall.securityAudit.scannerChecking}
                        </p>
                      </div>
                      <button
                        data-scanner-install="rkhunter"
                        className="hidden inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        <i className="ti ti-download text-sm"></i>
                        {t.firewall.securityAudit.btnInstallScanner}
                      </button>
                    </div>
                    <div
                      data-scanner="chkrootkit"
                      className="audit-scanner-row flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">chkrootkit</p>
                        <p className="audit-scanner-status text-xs text-muted-foreground">
                          {t.firewall.securityAudit.scannerChecking}
                        </p>
                      </div>
                      <button
                        data-scanner-install="chkrootkit"
                        className="hidden inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        <i className="ti ti-download text-sm"></i>
                        {t.firewall.securityAudit.btnInstallScanner}
                      </button>
                    </div>
                  </div>
                  <pre
                    id="audit-install-output"
                    className="hidden mb-4 max-h-48 overflow-y-auto rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-2 text-[11px] font-mono whitespace-pre-wrap"
                  ></pre>

                  {/** Active audit progress */}
                  <div id="audit-progress" className="hidden space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{t.firewall.securityAudit.scanProgress}</span>
                        <span id="audit-progress-pct" className="font-medium">
                          0%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-border overflow-hidden">
                        <div
                          id="audit-progress-bar"
                          className="h-full w-0 bg-primary transition-all duration-300"
                        ></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground"></span>
                        <span id="scan-bitninja">BitNinja: 0%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground"></span>
                        <span id="scan-lynis">Lynis: 0%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground"></span>
                        <span id="scan-rkhunter">Rkhunter: 0%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground"></span>
                        <span id="scan-chkrootkit">Chkrootkit: 0%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground"></span>
                      <span id="scan-ai">
                        {t.firewall.securityAudit.scanAi}
                      </span>
                    </div>
                  </div>

                  {/** Completed reports list */}
                  <div id="audit-reports" className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {t.firewall.securityAudit.noReports}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Fragment>
        )}

        {/** Cloudflare edge-block suggestion banner (filled by the extracted script
         after a deny/reject rule on a specific IP; gated by the sidebar module) */}
        <div id="cf-edge-banner" className="hidden mb-6"></div>

        <div
          id="fw-modules"
          className={
            isolatedFirewallView ? "grid gap-6" : "grid gap-6 lg:grid-cols-2"
          }
        >
          {/** UFW Rules */}
          {showFirewallView("rules") && (
            <Fragment>
              <div
                id="fw-rules-panel"
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h2 className="text-base font-semibold">
                    {t.firewall.ufwRules.title}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      id="btn-ai-ufw"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary/15 to-purple-500/15 px-3 py-1.5 text-xs font-medium text-primary hover:from-primary/25 hover:to-purple-500/25 transition-colors"
                    >
                      <i className="ti ti-sparkles text-sm"></i>
                      {t.firewall.aiAssistant.btnSuggestRules}
                    </button>
                    {/** Cloudflare preset: always visible — it belongs to the firewall
             module (/api/firewall/cloudflare-allow, public CF ranges, no
             token), NOT gated by the cloudflare module (that gate applies
             only to the cf-edge-banner cross-module deep link). Spanish
             hardcoded like other script-injected CF strings. */}
                    <button
                      id="btn-cf-allow"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      <i className="ti ti-cloud text-sm"></i>
                      {t.firewall.ufwRules.btnAllowCloudflare}
                    </button>
                    <button
                      id="btn-new-rule"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                    >
                      <i className="ti ti-plus text-sm"></i>
                      {t.firewall.ufwRules.btnNewRule}
                    </button>
                  </div>
                </div>
                <div className="border-b border-border px-5 py-3">
                  <label className="sr-only" htmlFor="fw-rule-search">
                    {t.firewall.ufwRules.searchLabel}
                  </label>
                  <input
                    id="fw-rule-search"
                    type="search"
                    placeholder={t.firewall.ufwRules.searchPlaceholder}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div id="rules-list" className="divide-y divide-border">
                  <div className="px-5 py-3 text-sm text-muted-foreground">
                    {t.firewall.ufwRules.loading}
                  </div>
                </div>
              </div>
            </Fragment>
          )}

          {/** Fail2ban */}
          {showFirewallView("fail2ban") && (
            <Fragment>
              <div
                id="fw-fail2ban-panel"
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h2 className="text-base font-semibold">Fail2ban</h2>
                  <div className="flex items-center gap-2">
                    <button
                      id="btn-ai-fail2ban"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary/15 to-purple-500/15 px-3 py-1.5 text-xs font-medium text-primary hover:from-primary/25 hover:to-purple-500/25 transition-colors"
                    >
                      <i className="ti ti-sparkles text-sm"></i>
                      {t.firewall.aiAssistant.btnSuggestBans}
                    </button>
                    <button
                      id="btn-ban-ip"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                    >
                      <i className="ti ti-lock text-sm"></i>
                      {t.firewall.fail2ban.btnBanIp}
                    </button>
                  </div>
                </div>
                <div id="jails-list" className="divide-y divide-border">
                  <div className="px-5 py-3 text-sm text-muted-foreground">
                    {t.firewall.fail2ban.loading}
                  </div>
                </div>
              </div>
            </Fragment>
          )}
        </div>
      </PanelLayout>

      {/** Add rule dialog */}
      {showFirewallView("rules") && (
        <Fragment>
          <dialog
            id="dialog-rule"
            className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          >
            <ModalNavbar
              title={t.firewall.ruleDialog.title}
              closeId="rule-close"
            />
            <form id="form-rule" className="flex flex-col gap-4 px-6 py-5">
              <div
                id="rule-error"
                className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
              ></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {t.firewall.ruleDialog.labelAction}
                  </label>
                  <select
                    id="rule-action"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="allow">
                      {t.firewall.ruleDialog.optionAllow}
                    </option>
                    <option value="deny">
                      {t.firewall.ruleDialog.optionDeny}
                    </option>
                    <option value="reject">
                      {t.firewall.ruleDialog.optionReject}
                    </option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {t.firewall.ruleDialog.labelProtocol}
                  </label>
                  <select
                    id="rule-proto"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="any">
                      {t.firewall.ruleDialog.optionAny}
                    </option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="rule-port">
                    {t.firewall.ruleDialog.labelPort}
                  </label>
                  <input
                    id="rule-port"
                    type="text"
                    required
                    placeholder={t.firewall.ruleDialog.placeholderPort}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="rule-from">
                    {t.firewall.ruleDialog.labelFromIp}
                  </label>
                  <input
                    id="rule-from"
                    type="text"
                    placeholder={t.firewall.ruleDialog.placeholderFromIp}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="rule-comment">
                  {t.firewall.ruleDialog.labelComment}
                </label>
                <input
                  id="rule-comment"
                  type="text"
                  placeholder={t.firewall.ruleDialog.placeholderComment}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  id="rule-cancel"
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  {t.firewall.ruleDialog.btnCancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {t.firewall.ruleDialog.btnAdd}
                </button>
              </div>
            </form>
          </dialog>
        </Fragment>
      )}

      {/** Ban IP dialog */}
      {showFirewallView("fail2ban") && (
        <Fragment>
          <dialog
            id="dialog-ban"
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          >
            <ModalNavbar
              title={t.firewall.banDialog.title}
              closeId="ban-close"
            />
            <form id="form-ban" className="flex flex-col gap-4 px-6 py-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="ban-ip">
                  {t.firewall.banDialog.labelIp}
                </label>
                <input
                  id="ban-ip"
                  type="text"
                  required
                  placeholder={t.firewall.banDialog.placeholderIp}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="ban-jail">
                  {t.firewall.banDialog.labelJail}
                </label>
                <select
                  id="ban-jail"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="sshd">sshd</option>
                  <option value="postfix-sasl">postfix-sasl</option>
                  <option value="nginx-http-auth">nginx-http-auth</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  id="ban-cancel"
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  {t.firewall.banDialog.btnCancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90"
                >
                  {t.firewall.banDialog.btnBan}
                </button>
              </div>
            </form>
          </dialog>
        </Fragment>
      )}

      {/** Install modal (UFW + Fail2ban) */}
      <InstallModal
        id="firewall"
        title={t.firewall.installWarning.btnInstall}
        description={t.firewall.installWarning.description}
      />

      {/** Audit report dialog */}
      {showFirewallView("audit") && (
        <Fragment>
          <dialog
            id="dlg-audit-report"
            className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl backdrop:bg-black/50"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">
                {t.firewall.auditReportDialog.title}
              </h3>
              <button
                onClick={() => {
                  (document.getElementById("dlg-audit-report") as HTMLDialogElement | null)?.close();
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
              >
                <i className="ti ti-x"></i>
              </button>
            </div>
            <div
              id="audit-report-content"
              className="space-y-4 max-h-[60vh] overflow-y-auto"
            ></div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  (document.getElementById("dlg-audit-report") as HTMLDialogElement | null)?.close();
                }}
                className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                {t.firewall.auditReportDialog.btnClose}
              </button>
            </div>
          </dialog>
        </Fragment>
      )}

      <div
        id="toast"
        className="fixed bottom-4 right-4 z-50 hidden max-w-xs rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
      >
        <p id="toast-msg" className="text-sm font-medium"></p>
      </div>

      <script
        id="firewall-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["firewall"]) }}
      ></script>
    </Fragment>
  );
}
