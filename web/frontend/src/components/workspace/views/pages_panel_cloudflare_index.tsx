// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/cloudflare/index.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

/**
 * Cloudflare — /panel/cloudflare
 *
 * Manage Cloudflare zones for the connected server: DNS records, cache
 * purge, SSL/TLS + security settings and IP access rules. The API token is
 * stored server-side (settings sidecar) and is never echoed back — only a
 * masked preview reaches the browser.
 */
import PanelLayout from "../module-frame";
import DataTable from "@/components/ui/DataTable";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import ModalNavbar from "./components_ui_ModalNavbar";
import {
  buildCfDnsColumns,
  buildCfDnsFilters,
  buildCfDnsRowActions,
  buildCfDnsValueBadges,
  buildCfAccessColumns,
  buildCfAccessFilters,
  buildCfAccessRowActions,
  buildCfAccessValueBadges,
} from "@/config/tables/cloudflare-table-config";
import { getPageMessages } from "../view-context";
export default function pages_panel_cloudflare_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["cloudflare", "settings", "components"]);
  const cfTables: any = t.cloudflare;
  const dataTableI18n = (t.components as any).dataTable;
  const cfPageSizes = [10, 25, 50, 100];
  const cfSettingsTables = [
    {
      id: "cf-dns-table",
      nav: "DNS",
      icon: "ti-world",
      actions: buildCfDnsRowActions(cfTables),
    },
    {
      id: "cf-access-table",
      nav: cfTables.settingsUi.access,
      icon: "ti-shield-lock",
      actions: buildCfAccessRowActions(cfTables),
    },
  ];
  const cfView = Astro.url.searchParams.get("workspaceView");
  const isolatedCfView =
    Astro.url.searchParams.get("embed") === "1" &&
    !Astro.url.searchParams.has("settingsOverlay") &&
    ["dns", "cache", "security", "access", "config"].includes(cfView ?? "");
  const showCfView = (view: string) => !isolatedCfView || cfView === view;

  return (
    <Fragment>
      <PanelLayout title={t.cloudflare.pageTitle} activeModule="cloudflare">
        <div slot="title-actions">
          <ViewSettingsModal
            id="cloudflare-settings-modal"
            title={cfTables.settingsUi.title}
            description={cfTables.settingsUi.description}
            variant="drawer"
            hideFooter={true}
          >
            <div className="flex h-full min-h-0 w-full @container">
              <nav className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52">
                {cfSettingsTables.map((tbl: any, i: number) => (
                  <Fragment>
                    <button
                      type="button"
                      data-cf-settings-nav={tbl.id}
                      title={tbl.nav}
                      className={`flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 ease-out @xl:justify-start ${i === 0 ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                    >
                      <i
                        className={`ti ${tbl.icon} shrink-0 text-lg`}
                        aria-hidden
                      ></i>
                      <span className="hidden truncate @xl:inline">
                        {tbl.nav}
                      </span>
                    </button>
                  </Fragment>
                ))}
              </nav>
              <div className="min-w-0 flex-1 overflow-y-auto px-5 py-5">
                {cfSettingsTables.map((tbl: any, i: number) => (
                  <Fragment>
                    <section
                      data-cf-view={tbl.id}
                      className={i === 0 ? "space-y-6" : "hidden space-y-6"}
                    >
                      <div className="space-y-2.5">
                        <h3 className="text-sm font-semibold">
                          {t.components.tableSettings.pagination}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {t.components.tableSettings.rowsPerPage}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {cfPageSizes.map((n: any) => (
                            <Fragment>
                              <button
                                type="button"
                                data-cf-pagesize={String(n)}
                                data-cf-table={tbl.id}
                                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
                              >
                                {n}
                              </button>
                            </Fragment>
                          ))}
                        </div>
                      </div>
                      {tbl.actions.length > 0 && (
                        <Fragment>
                          <div className="space-y-2.5">
                            <h3 className="text-sm font-semibold">
                              {t.components.tableSettings.visibleActions}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {t.components.tableSettings.actionsHint}
                            </p>
                            <div className="space-y-1.5">
                              {tbl.actions.map((a: any) => (
                                <Fragment>
                                  <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 text-sm hover:bg-accent/40">
                                    <input
                                      type="checkbox"
                                      defaultChecked
                                      data-cf-action-toggle={a.id}
                                      data-cf-table={tbl.id}
                                      className="h-4 w-4 rounded border-border"
                                    />
                                    <i
                                      className={`ti ${a.icon ?? "ti-dots"} text-base text-muted-foreground`}
                                    ></i>
                                    <span>{a.label}</span>
                                  </label>
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        </Fragment>
                      )}
                    </section>
                  </Fragment>
                ))}
                <section className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
                  <h3 className="font-semibold">
                    {cfTables.settingsUi.credentialsConnections}
                  </h3>
                  <div className="flex flex-col gap-2 text-xs">
                    <a
                      href="/panel/settings#cred-cloudflare"
                      className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                    >
                      {cfTables.settingsUi.cloudflareToken}
                    </a>
                    <a
                      href="/panel/firewall"
                      className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                    >
                      {cfTables.settingsUi.serverFirewall}
                    </a>
                    <a
                      href="/panel/webhooks"
                      className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                    >
                      {cfTables.settingsUi.dnsWebhooks}
                    </a>
                  </div>
                </section>
              </div>
            </div>
          </ViewSettingsModal>
        </div>

        <div className="mb-5 flex flex-col gap-1">
          <h2 className="text-xl font-semibold">
            {t.cloudflare.header.heading}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t.cloudflare.header.subheading}
          </p>
        </div>

        {/** No-token notice (visible only while no API token is configured) */}
        <div
          id="cf-no-token"
          className="mb-5 hidden items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
        >
          <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <i className="ti ti-alert-triangle text-base"></i>
            <span>{t.cloudflare.common.noToken}</span>
          </p>
          <button
            id="cf-go-config"
            className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <i className="ti ti-settings text-sm"></i>{" "}
            {t.cloudflare.tabs.config}
          </button>
        </div>

        {/** Zone selector + status/plan badges */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <label htmlFor="cf-zone" className="text-sm font-medium">
            {t.cloudflare.zones.title}
          </label>
          <select
            id="cf-zone"
            className="min-w-56 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">{t.cloudflare.zones.select}</option>
          </select>
          <span
            id="cf-zone-status"
            className="hidden items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium"
          >
            <span className="text-muted-foreground">
              {t.cloudflare.zones.status}:
            </span>
            <span id="cf-zone-status-val"></span>
          </span>
          <span
            id="cf-zone-plan"
            className="hidden items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium"
          >
            <span className="text-muted-foreground">
              {t.cloudflare.zones.plan}:
            </span>
            <span id="cf-zone-plan-val"></span>
          </span>
        </div>
        <p
          id="cf-zone-health"
          className="mb-4 text-xs text-muted-foreground"
          role="status"
        ></p>

        <section className="min-w-0 rounded-xl border border-border bg-card overflow-hidden">
          {/** Tabs (db-tab pattern from databases) */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <div
              className={
                isolatedCfView
                  ? "sr-only"
                  : "flex flex-wrap gap-1 rounded-lg bg-muted p-0.5 text-xs"
              }
            >
              <button
                data-tab="dns"
                className="cf-tab rounded-md px-3 py-1.5 font-medium transition-colors duration-200 ease-out"
              >
                {t.cloudflare.tabs.dns}
              </button>
              <button
                data-tab="cache"
                className="cf-tab rounded-md px-3 py-1.5 font-medium transition-colors duration-200 ease-out"
              >
                {t.cloudflare.tabs.cache}
              </button>
              <button
                data-tab="security"
                className="cf-tab rounded-md px-3 py-1.5 font-medium transition-colors duration-200 ease-out"
              >
                {t.cloudflare.tabs.security}
              </button>
              <button
                data-tab="access"
                className="cf-tab rounded-md px-3 py-1.5 font-medium transition-colors duration-200 ease-out"
              >
                {t.cloudflare.tabs.access}
              </button>
              <button
                data-tab="config"
                className="cf-tab rounded-md px-3 py-1.5 font-medium transition-colors duration-200 ease-out"
              >
                {t.cloudflare.tabs.config}
              </button>
            </div>
          </div>

          {/** DNS tab */}
          {showCfView("dns") && (
            <Fragment>
              <div id="cf-pane-dns" className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {t.cloudflare.dns.title}
                  </h3>
                  <button
                    id="cf-dns-add"
                    className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    <i className="ti ti-plus text-sm"></i>{" "}
                    {t.cloudflare.dns.add}
                  </button>
                </div>
                <DataTable
                  scopedPreferences={true}
                  tableId="cf-dns-table"
                  title={t.cloudflare.dns.title}
                  columns={buildCfDnsColumns(cfTables)}
                  data={[]}
                  filters={buildCfDnsFilters(cfTables)}
                  rowActions={buildCfDnsRowActions(cfTables)}
                  valueBadges={buildCfDnsValueBadges(cfTables)}
                  selectable={false}
                  i18n={dataTableI18n}
                />
              </div>
            </Fragment>
          )}

          {/** Cache tab */}
          {showCfView("cache") && (
            <Fragment>
              <div id="cf-pane-cache" className="hidden flex-col gap-5 p-4">
                <h3 className="text-sm font-semibold">
                  {t.cloudflare.cache.title}
                </h3>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">
                    {t.cloudflare.cache.purgeAllHint}
                  </p>
                  <button
                    id="cf-purge-all"
                    className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-background px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                  >
                    <i className="ti ti-trash text-base"></i>{" "}
                    {t.cloudflare.cache.purgeAll}
                  </button>
                </div>

                <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
                  <textarea
                    id="cf-purge-urls"
                    rows={4}
                    spellCheck="false"
                    placeholder={t.cloudflare.cache.purgeUrlsPlaceholder}
                    className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  ></textarea>
                  <div>
                    <button
                      id="cf-purge-urls-btn"
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
                    >
                      <i className="ti ti-eraser text-base"></i>{" "}
                      {t.cloudflare.cache.purgeUrls}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {t.cloudflare.cache.devMode}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.cloudflare.cache.devModeHint}
                    </span>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      id="cf-dev-mode"
                      type="checkbox"
                      className="h-4 w-4 rounded border-input text-primary"
                    />
                  </label>
                </div>
              </div>
            </Fragment>
          )}

          {/** SSL / Security tab */}
          {showCfView("security") && (
            <Fragment>
              <div id="cf-pane-security" className="hidden flex-col gap-5 p-4">
                <h3 className="text-sm font-semibold">
                  {t.cloudflare.security.title}
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 rounded-lg border border-border p-4">
                    <label
                      htmlFor="cf-ssl-mode"
                      className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                    >
                      {t.cloudflare.security.sslMode}
                    </label>
                    <select
                      id="cf-ssl-mode"
                      className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="off">
                        {t.cloudflare.security.sslOff}
                      </option>
                      <option value="flexible">
                        {t.cloudflare.security.sslFlexible}
                      </option>
                      <option value="full">
                        {t.cloudflare.security.sslFull}
                      </option>
                      <option value="strict">
                        {t.cloudflare.security.sslFullStrict}
                      </option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 rounded-lg border border-border p-4">
                    <label
                      htmlFor="cf-security-level"
                      className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                    >
                      {t.cloudflare.security.securityLevel}
                    </label>
                    <select
                      id="cf-security-level"
                      className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="essentially_off">
                        {t.cloudflare.options.essentiallyOff}
                      </option>
                      <option value="low">{t.cloudflare.options.low}</option>
                      <option value="medium">
                        {t.cloudflare.options.medium}
                      </option>
                      <option value="high">{t.cloudflare.options.high}</option>
                      <option value="under_attack">
                        {t.cloudflare.security.underAttack}
                      </option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
                  <span className="text-sm font-medium">
                    {t.cloudflare.security.alwaysHttps}
                  </span>
                  <input
                    id="cf-always-https"
                    type="checkbox"
                    className="h-4 w-4 rounded border-input text-primary"
                  />
                </div>
              </div>
            </Fragment>
          )}

          {/** Access rules tab */}
          {showCfView("access") && (
            <Fragment>
              <div id="cf-pane-access" className="hidden p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {t.cloudflare.access.title}
                  </h3>
                  <button
                    id="cf-access-add"
                    className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    <i className="ti ti-plus text-sm"></i>{" "}
                    {t.cloudflare.access.add}
                  </button>
                </div>
                <DataTable
                  scopedPreferences={true}
                  tableId="cf-access-table"
                  title={t.cloudflare.access.title}
                  columns={buildCfAccessColumns(cfTables)}
                  data={[]}
                  filters={buildCfAccessFilters(cfTables)}
                  rowActions={buildCfAccessRowActions(cfTables)}
                  valueBadges={buildCfAccessValueBadges(cfTables)}
                  selectable={false}
                  i18n={dataTableI18n}
                />
              </div>
            </Fragment>
          )}

          {/** Config tab (openclaw-style API token card) */}
          {showCfView("config") && (
            <Fragment>
              <div id="cf-pane-config" className="hidden p-4">
                <div className="max-w-2xl space-y-5 rounded-xl border border-border bg-card p-6">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {t.cloudflare.config.title}
                    </h3>
                    <p
                      id="cf-token-state"
                      className="mt-0.5 text-xs text-muted-foreground"
                    >
                      {t.cloudflare.config.tokenMissing}
                    </p>
                  </div>

                  

                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                    
                    <button
                      id="cf-token-test"
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-50"
                    >
                      <i className="ti ti-plug-connected text-base"></i>{" "}
                      {t.cloudflare.config.test}
                    </button>
                    
                  </div>
                  <a
                    href="/panel/settings#cred-cloudflare"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <i className="ti ti-key text-sm"></i>{" "}
                    {t.settings.credentials.title}
                  </a>
                </div>
              </div>
            </Fragment>
          )}
        </section>
      </PanelLayout>

      {/** DNS record editor (create / edit) */}
      <dialog
        id="dlg-cf-dns"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.cloudflare.dns.add}
          titleId="cf-dns-title"
          closeId="cf-dns-x"
        />
        <div className="space-y-4 px-6 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="cf-dns-type"
                className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
              >
                {t.cloudflare.dns.type}
              </label>
              <select
                id="cf-dns-type"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="A">{t.cloudflare.dns.typeA}</option>
                <option value="AAAA">{t.cloudflare.dns.typeAAAA}</option>
                <option value="CNAME">{t.cloudflare.dns.typeCNAME}</option>
                <option value="TXT">{t.cloudflare.dns.typeTXT}</option>
                <option value="MX">{t.cloudflare.dns.typeMX}</option>
                <option value="NS">{t.cloudflare.dns.typeNS}</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="cf-dns-ttl"
                className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
              >
                {t.cloudflare.dns.ttl}
              </label>
              <select
                id="cf-dns-ttl"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="1">{t.cloudflare.dns.ttlAuto}</option>
                <option value="60">{t.cloudflare.dns.ttl60}</option>
                <option value="300">{t.cloudflare.dns.ttl300}</option>
                <option value="1800">{t.cloudflare.dns.ttl1800}</option>
                <option value="3600">{t.cloudflare.dns.ttl3600}</option>
                <option value="86400">{t.cloudflare.dns.ttl86400}</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="cf-dns-name"
              className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {t.cloudflare.dns.name}
            </label>
            <input
              id="cf-dns-name"
              type="text"
              spellCheck="false"
              autoComplete="off"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label
              htmlFor="cf-dns-content"
              className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {t.cloudflare.dns.content}
            </label>
            <div className="flex gap-2">
              <input
                id="cf-dns-content"
                type="text"
                spellCheck="false"
                autoComplete="off"
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                id="cf-dns-use-ip"
                type="button"
                className="shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
              >
                {t.cloudflare.dns.useServerIp}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t.cloudflare.common.serverIp}:{" "}
              <span id="cf-server-ip-val" className="font-mono">
                —
              </span>
            </p>
          </div>

          <div id="cf-dns-priority-wrap" className="hidden">
            <label
              htmlFor="cf-dns-priority"
              className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {t.cloudflare.dns.priority}
            </label>
            <input
              id="cf-dns-priority"
              type="number"
              min="0"
              max="65535"
              defaultValue="10"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              id="cf-dns-proxied"
              type="checkbox"
              className="h-4 w-4 rounded border-input text-primary"
            />
            <span>{t.cloudflare.dns.proxied}</span>
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="cf-dns-cancel"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t.cloudflare.common.cancel}
          </button>
          <button
            id="cf-dns-save"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <i className="ti ti-device-floppy text-base"></i>{" "}
            {t.cloudflare.common.save}
          </button>
        </div>
      </dialog>

      {/** Access rule editor (create) */}
      <dialog
        id="dlg-cf-access"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar title={t.cloudflare.access.add} closeId="cf-access-x" />
        <div className="space-y-4 px-6 py-4">
          <div>
            <label
              htmlFor="cf-access-mode"
              className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {t.cloudflare.access.mode}
            </label>
            <select
              id="cf-access-mode"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="block">{t.cloudflare.access.block}</option>
              <option value="whitelist">{t.cloudflare.access.allow}</option>
              <option value="challenge">{t.cloudflare.access.challenge}</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="cf-access-ip"
              className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {t.cloudflare.access.ip}
            </label>
            <input
              id="cf-access-ip"
              type="text"
              spellCheck="false"
              autoComplete="off"
              placeholder="203.0.113.10 · 203.0.113.0/24"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label
              htmlFor="cf-access-notes"
              className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {t.cloudflare.access.notes}
            </label>
            <input
              id="cf-access-notes"
              type="text"
              autoComplete="off"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="cf-access-cancel"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t.cloudflare.common.cancel}
          </button>
          <button
            id="cf-access-save"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <i className="ti ti-device-floppy text-base"></i>{" "}
            {t.cloudflare.common.save}
          </button>
        </div>
      </dialog>

      <div
        id="toast"
        className="fixed bottom-4 right-4 z-50 hidden max-w-xs rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
      >
        <p id="toast-msg" className="text-sm font-medium"></p>
      </div>

      <script
        id="cloudflare-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["cloudflare"]) }}
      ></script>
    </Fragment>
  );
}
