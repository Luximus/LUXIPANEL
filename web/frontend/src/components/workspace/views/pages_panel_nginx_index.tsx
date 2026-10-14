// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/nginx/index.astro.
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
 * NGINX Manager — /panel/nginx
 * Tabs: Resumen | Sitios y HTTPS | Tráfico | Rendimiento | Logs | Servicio
 *
 * Reemplaza al antiguo módulo DNS. El slug de permisos sigue siendo "dns"
 * (activeModule="dns") por compatibilidad de licencia/permisos.
 */
import PanelLayout from "../module-frame";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import ModuleDepsBanner from "./components_ModuleDepsBanner";
import ModalNavbar from "./components_ui_ModalNavbar";
import DataTable from "@/components/ui/DataTable";
import {
  buildNginxSitesColumns,
  buildNginxSitesFilters,
  buildNginxSitesRowActions,
  buildNginxSitesValueBadges,
  buildNginxUpstreamsColumns,
  buildNginxUpstreamsFilters,
} from "@/config/tables/nginx-table-config";
import { getPageMessages } from "../view-context";
export default function pages_panel_nginx_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["nginx", "deps", "components"]);
  const dataTableI18n = t.components.dataTable;
  const nginxTable = t.nginx?.table;
  const isAdmin = Astro.locals.user?.kind === "admin";
  const isHosting =
    Astro.locals.user?.kind === "hosting" ||
    Astro.locals.user?.tenantId !== undefined;
  const nginxView = Astro.url.searchParams.get("workspaceView");
  const isolatedNginxView =
    Astro.url.searchParams.get("embed") === "1" &&
    !Astro.url.searchParams.has("settingsOverlay") &&
    ["overview", "sites", "proxy", "perf", "logs", "status"].includes(
      nginxView ?? "",
    );
  const showNginxView = (view: string) =>
    !isolatedNginxView || nginxView === view;
  const inputCls =
    "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <Fragment>
      <PanelLayout title={t.nginx.pageTitle} activeModule="dns" titleInActions>
        {/** Configuración del módulo (drawer derecho + menú lateral, estilo Correo/Cron/Files). */}
        <div slot="title-actions" className="flex min-w-0 items-center gap-2">
          <h1
            id="panel-topbar-title"
            data-panel-title
            className="shrink-0 text-base font-semibold text-foreground"
          >
            {t.nginx.pageTitle}
          </h1>
          <ViewSettingsModal
            id="nginx-settings-modal"
            title={t.nginx.settings.title}
            description={t.nginx.settings.description}
            variant="drawer"
            hideFooter={true}
          >
            <div className="flex h-full min-h-0 w-full @container">
              <nav
                role="tablist"
                aria-orientation="vertical"
                aria-label={t.nginx.settings.title}
                className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52"
              >
                <button
                  type="button"
                  id="nginx-settings-tab-sites"
                  role="tab"
                  aria-controls="nginx-settings-sites"
                  data-nginx-settings-nav="sites"
                  aria-selected="true"
                  tabIndex={0}
                  title={t.nginx.settings.sites}
                  className="flex items-center justify-center gap-2.5 rounded-lg bg-primary/10 px-2.5 py-2 text-sm font-medium text-primary transition-colors duration-200 ease-out @xl:justify-start"
                >
                  <i
                    className="ti ti-world-www shrink-0 text-lg"
                    aria-hidden="true"
                  ></i>
                  <span className="hidden truncate @xl:inline">
                    {t.nginx.settings.sites}
                  </span>
                </button>
                {isAdmin && (
                  <Fragment>
                    <button
                      type="button"
                      id="nginx-settings-tab-upstreams"
                      role="tab"
                      aria-controls="nginx-settings-upstreams"
                      data-nginx-settings-nav="upstreams"
                      aria-selected="false"
                      tabIndex={-1}
                      title={t.nginx.settings.upstreams}
                      className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 ease-out hover:bg-accent hover:text-foreground @xl:justify-start"
                    >
                      <i
                        className="ti ti-topology-star-3 shrink-0 text-lg"
                        aria-hidden="true"
                      ></i>
                      <span className="hidden truncate @xl:inline">
                        {t.nginx.settings.upstreams}
                      </span>
                    </button>
                  </Fragment>
                )}
                <button
                  type="button"
                  id="nginx-settings-tab-ai"
                  role="tab"
                  aria-controls="nginx-settings-ai"
                  data-nginx-settings-nav="ai"
                  aria-selected="false"
                  tabIndex={-1}
                  title={t.nginx.settings.ai}
                  className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 ease-out hover:bg-accent hover:text-foreground @xl:justify-start"
                >
                  <i
                    className="ti ti-sparkles shrink-0 text-lg"
                    aria-hidden="true"
                  ></i>
                  <span className="hidden truncate @xl:inline">
                    {t.nginx.settings.ai}
                  </span>
                </button>
              </nav>
              <div className="min-w-0 flex-1 overflow-y-auto px-5 py-5">
                <div
                  id="nginx-settings-sites"
                  role="tabpanel"
                  aria-labelledby="nginx-settings-tab-sites"
                  data-nginx-settings-view="sites"
                  data-nginx-table="nginx-sites-table"
                  className="flex flex-col gap-6"
                >
                  <div className="space-y-2.5">
                    <h3 className="text-sm font-semibold">
                      {t.nginx.settings.pagination}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t.nginx.settings.sitesPageSize}
                    </p>
                    <div className="inline-flex overflow-hidden rounded-lg border border-border">
                      <button
                        type="button"
                        data-nginx-pagesize="10"
                        className="px-3 py-1.5 text-sm"
                      >
                        10
                      </button>
                      <button
                        type="button"
                        data-nginx-pagesize="25"
                        className="border-l border-border px-3 py-1.5 text-sm"
                      >
                        25
                      </button>
                      <button
                        type="button"
                        data-nginx-pagesize="50"
                        className="border-l border-border px-3 py-1.5 text-sm"
                      >
                        50
                      </button>
                      <button
                        type="button"
                        data-nginx-pagesize="100"
                        className="border-l border-border px-3 py-1.5 text-sm"
                      >
                        100
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <h3 className="text-sm font-semibold">
                      {t.nginx.settings.actions}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t.nginx.settings.actionsHelp}
                    </p>
                    <label className="flex items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        data-nginx-action="edit"
                        className="h-4 w-4"
                      />
                      <i className="ti ti-edit text-base"></i>
                      {t.nginx.table.sites.rowActions.edit}
                    </label>
                    <label className="flex items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        data-nginx-action="toggle"
                        className="h-4 w-4"
                      />
                      <i className="ti ti-toggle-left text-base"></i>
                      {t.nginx.table.sites.rowActions.toggle}
                    </label>
                    <label className="flex items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        data-nginx-action="ssl"
                        className="h-4 w-4"
                      />
                      <i className="ti ti-lock text-base"></i>
                      {t.nginx.table.sites.rowActions.ssl}
                    </label>
                    <label className="flex items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        data-nginx-action="renewal"
                        className="h-4 w-4"
                      />
                      <i className="ti ti-refresh text-base"></i>
                      {t.nginx.table.sites.rowActions.renewal}
                    </label>
                    <label className="flex items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        data-nginx-action="delete"
                        className="h-4 w-4"
                      />
                      <i className="ti ti-trash text-base"></i>
                      {t.nginx.table.sites.rowActions.delete}
                    </label>
                  </div>
                </div>
                {isAdmin && (
                  <Fragment>
                    <div
                      id="nginx-settings-upstreams"
                      role="tabpanel"
                      aria-labelledby="nginx-settings-tab-upstreams"
                      data-nginx-settings-view="upstreams"
                      data-nginx-table="nginx-upstreams-table"
                      className="hidden flex-col gap-6"
                    >
                      <div className="space-y-2.5">
                        <h3 className="text-sm font-semibold">
                          {t.nginx.settings.pagination}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {t.nginx.settings.upstreamsPageSize}
                        </p>
                        <div className="inline-flex overflow-hidden rounded-lg border border-border">
                          <button
                            type="button"
                            data-nginx-pagesize="10"
                            className="px-3 py-1.5 text-sm"
                          >
                            10
                          </button>
                          <button
                            type="button"
                            data-nginx-pagesize="25"
                            className="border-l border-border px-3 py-1.5 text-sm"
                          >
                            25
                          </button>
                          <button
                            type="button"
                            data-nginx-pagesize="50"
                            className="border-l border-border px-3 py-1.5 text-sm"
                          >
                            50
                          </button>
                          <button
                            type="button"
                            data-nginx-pagesize="100"
                            className="border-l border-border px-3 py-1.5 text-sm"
                          >
                            100
                          </button>
                        </div>
                      </div>
                    </div>
                  </Fragment>
                )}
                <div
                  id="nginx-settings-ai"
                  role="tabpanel"
                  aria-labelledby="nginx-settings-tab-ai"
                  data-nginx-settings-view="ai"
                  className="hidden flex-col gap-5"
                >
                  <div>
                    <h3 className="text-sm font-semibold">
                      {t.nginx.settings.ai}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.nginx.settings.aiHelp}
                    </p>
                  </div>
                  <label
                    className="flex flex-col gap-1.5 text-sm font-medium"
                    htmlFor="nginx-ai-submit"
                  >
                    {t.nginx.settings.submitMode}
                    <select id="nginx-ai-submit" className={inputCls}>
                      <option value="auto">{t.nginx.settings.auto}</option>
                      <option value="prefill">
                        {t.nginx.settings.prefill}
                      </option>
                    </select>
                  </label>
                  <label
                    className="flex flex-col gap-1.5 text-sm font-medium"
                    htmlFor="nginx-ai-lines"
                  >
                    {t.nginx.settings.logLines}
                    <select id="nginx-ai-lines" className={inputCls}>
                      <option value="50">50</option>
                      <option value="200">200</option>
                      <option value="500">500</option>
                    </select>
                  </label>
                  <p className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                    {t.nginx.settings.privacy}
                  </p>
                </div>
              </div>
            </div>
          </ViewSettingsModal>
        </div>

        {/** Dependencias del módulo: nginx (requerido) + certbot (opcional, SSL).
         El page-script lo conduce con initModuleDeps(\\{ module: "nginx" \\}). */}
        <ModuleDepsBanner module="nginx" t={t.deps} />

        {/** Tabs */}
        <div
          id="nginx-tabs"
          role="tablist"
          aria-label={t.nginx.pageTitle}
          data-admin={isAdmin ? "true" : "false"}
          data-hosting={isHosting ? "true" : "false"}
          className={
            isolatedNginxView
              ? "sr-only"
              : "mb-6 flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1 w-fit"
          }
        >
          {[
            {
              id: "tab-overview",
              label: t.nginx.tabs.overview,
              icon: "ti-activity-heartbeat",
            },
            {
              id: "tab-sites",
              label: t.nginx.tabs.sitesHttps,
              icon: "ti-server",
            },
            ...(isAdmin
              ? [
                  {
                    id: "tab-proxy",
                    label: t.nginx.tabs.traffic,
                    icon: "ti-arrows-exchange",
                  },
                  {
                    id: "tab-perf",
                    label: t.nginx.tabs.performance,
                    icon: "ti-rocket",
                  },
                ]
              : []),
            { id: "tab-logs", label: t.nginx.tabs.logs, icon: "ti-file-text" },
            ...(isAdmin
              ? [
                  {
                    id: "tab-status",
                    label: t.nginx.tabs.service,
                    icon: "ti-heartbeat",
                  },
                ]
              : []),
          ].map((tab: any) => (
            <Fragment>
              <button
                id={tab.id}
                data-tab={tab.id}
                role="tab"
                aria-controls={tab.id.replace("tab-", "panel-")}
                aria-selected="false"
                className="tab-btn flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <i className={`ti ${tab.icon} text-sm`}></i>
                {tab.label}
              </button>
            </Fragment>
          ))}
        </div>

        {showNginxView("overview") && (
          <Fragment>
            <section
              id="panel-overview"
              role="tabpanel"
              aria-labelledby="tab-overview"
              className="tab-panel hidden space-y-5"
            >
              <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                      {t.nginx.overview.eyebrow}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                      {t.nginx.overview.heading}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                      {t.nginx.overview.description}
                    </p>
                  </div>
                  <button
                    id="nginx-ai-overview"
                    type="button"
                    className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20"
                  >
                    <i className="ti ti-sparkles mr-1.5" aria-hidden="true"></i>
                    {t.nginx.overview.diagnose}
                  </button>
                </div>
                <div
                  id="overview-health"
                  role="status"
                  aria-live="polite"
                  className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                >
                  <p className="text-sm text-muted-foreground">
                    {t.nginx.overview.loading}
                  </p>
                </div>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                  <button
                    id="overview-new-site"
                    type="button"
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                  >
                    {t.nginx.sites.btnNewSite}
                  </button>
                  <button
                    id="overview-open-sites"
                    type="button"
                    className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                  >
                    {t.nginx.overview.openSites}
                  </button>
                  {isAdmin && (
                    <Fragment>
                      <button
                        id="overview-test"
                        type="button"
                        className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                      >
                        nginx -t
                      </button>
                    </Fragment>
                  )}
                </div>
                <p
                  id="overview-action-result"
                  role="status"
                  className="mt-3 text-xs text-muted-foreground"
                ></p>
              </div>
            </section>
          </Fragment>
        )}

        {/** ═══ TAB: SITIOS ═══ */}
        {showNginxView("sites") && (
          <Fragment>
            <div
              id="panel-sites"
              role="tabpanel"
              aria-labelledby="tab-sites"
              className="tab-panel hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold">
                    {t.nginx.sites.heading}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.nginx.sites.descriptionPre}{" "}
                    <code>/etc/nginx/sites-available</code>
                    {t.nginx.sites.descriptionMid} <code>nginx -t</code>{" "}
                    {t.nginx.sites.descriptionPost}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    id="btn-new-site"
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 transition-colors"
                  >
                    <i className="ti ti-plus text-sm"></i>
                    {t.nginx.sites.btnNewSite}
                  </button>
                </div>
              </div>
              {/** Puente Cloudflare post-creación: lo puebla index-script1.ts y lo limpia init() */}
              <div id="nginx-cf-banner"></div>
              <DataTable
                i18n={dataTableI18n}
                tableId="nginx-sites-table"
                title={t.nginx.sites.tableTitle}
                columns={buildNginxSitesColumns(nginxTable)}
                data={[]}
                filters={buildNginxSitesFilters(nginxTable)}
                rowActions={buildNginxSitesRowActions(nginxTable)}
                valueBadges={buildNginxSitesValueBadges(nginxTable)}
              />
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card px-5 py-4">
                  <h3 className="text-sm font-semibold">
                    {t.nginx.overview.siteDiagnosis}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.nginx.overview.siteDiagnosisHelp}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select
                      id="nginx-ai-site-select"
                      aria-label={t.nginx.logs.labelSite}
                      className={inputCls + " min-w-40 flex-1"}
                    ></select>
                    <button
                      id="nginx-ai-site"
                      type="button"
                      className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20"
                    >
                      {t.nginx.overview.diagnose}
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">
                        {t.nginx.ssl.heading}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.nginx.ssl.description}
                      </p>
                    </div>
                    <button
                      id="btn-enable-https"
                      type="button"
                      className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20"
                    >
                      {t.nginx.ssl.btnEnableHttps}
                    </button>
                  </div>
                  <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
                    <h4 className="text-sm font-semibold">
                      {t.nginx.ssl.renewalTitle}
                    </h4>
                    <p
                      id="nginx-renewal-status"
                      role="status"
                      aria-live="polite"
                      className="mt-1 text-xs text-muted-foreground"
                    >
                      {t.nginx.ssl.renewalChecking}
                    </p>
                    {isAdmin && (
                      <Fragment>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            id="nginx-renewal-configure"
                            type="button"
                            className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
                          >
                            {t.nginx.ssl.renewalConfigure}
                          </button>
                          <button
                            id="nginx-renewal-test"
                            type="button"
                            className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
                          >
                            {t.nginx.ssl.renewalTest}
                          </button>
                        </div>
                      </Fragment>
                    )}
                    <pre
                      id="nginx-renewal-result"
                      className="hidden mt-3 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-xs"
                    ></pre>
                  </div>
                </div>
              </div>
            </div>
          </Fragment>
        )}

        {/** ═══ TAB: REVERSE PROXY ═══ */}
        {showNginxView("proxy") && (
          <Fragment>
            <div
              id="panel-proxy"
              role="tabpanel"
              aria-labelledby="tab-proxy"
              className="tab-panel hidden"
            >
              <div className="grid gap-6 lg:grid-cols-5">
                <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
                  <h2 className="text-base font-semibold mb-1">
                    {t.nginx.proxy.formHeading}
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    {t.nginx.proxy.formDescription}
                  </p>
                  <form id="form-proxy" className="flex flex-col gap-3">
                    <div
                      id="proxy-error"
                      className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
                    ></div>
                    <div className="space-y-1.5">
                      <label
                        className="text-sm font-medium"
                        htmlFor="proxy-domain"
                      >
                        {t.nginx.proxy.labelDomain}
                      </label>
                      <input
                        id="proxy-domain"
                        type="text"
                        required
                        placeholder={t.nginx.placeholders.appDomain}
                        className={inputCls + " font-mono"}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">
                        {t.nginx.proxy.labelUpstreams}
                      </label>
                      <div id="proxy-upstreams" className="space-y-2"></div>
                      <button
                        type="button"
                        id="proxy-add-upstream"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {t.nginx.proxy.btnAddUpstream}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        id="proxy-balance-group"
                        className="hidden space-y-1.5"
                      >
                        <label
                          className="text-sm font-medium"
                          htmlFor="proxy-balance"
                        >
                          {t.nginx.proxy.labelBalance}
                        </label>
                        <select id="proxy-balance" className={inputCls}>
                          <option value="round_robin">
                            {t.nginx.balance.optionRoundRobin}
                          </option>
                          <option value="least_conn">
                            {t.nginx.balance.optionLeastConn}
                          </option>
                          <option value="ip_hash">
                            {t.nginx.balance.optionIpHash}
                          </option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-2 pt-6">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            id="proxy-ws"
                            type="checkbox"
                            className="h-4 w-4 rounded border-input text-primary"
                          />
                          {t.nginx.proxy.labelWebSocket}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            id="proxy-https"
                            type="checkbox"
                            className="h-4 w-4 rounded border-input text-primary"
                          />
                          {t.nginx.proxy.labelForceHttps}
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        id="proxy-preview-btn"
                        className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                      >
                        {t.nginx.proxy.btnPreview}
                      </button>
                      <button
                        type="submit"
                        className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        {t.nginx.proxy.btnCreate}
                      </button>
                    </div>
                  </form>
                </div>
                <div className="lg:col-span-3 space-y-4">
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="border-b border-border px-5 py-3">
                      <h3 className="text-sm font-semibold">
                        {t.nginx.proxy.previewHeading}
                      </h3>
                    </div>
                    <pre
                      id="proxy-preview"
                      className="m-0 max-h-64 overflow-auto p-4 text-xs font-mono text-muted-foreground"
                    >
                      {t.nginx.proxy.previewPlaceholder}
                    </pre>
                  </div>
                  <DataTable
                    i18n={dataTableI18n}
                    tableId="nginx-upstreams-table"
                    title={t.nginx.proxy.tableTitle}
                    columns={buildNginxUpstreamsColumns(nginxTable)}
                    data={[]}
                    filters={buildNginxUpstreamsFilters(nginxTable)}
                  />
                </div>
              </div>
            </div>
          </Fragment>
        )}

        {/** ═══ TAB: LOGS ═══ */}
        {showNginxView("logs") && (
          <Fragment>
            <div id="panel-logs" className="tab-panel hidden">
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" htmlFor="log-site">
                      {t.nginx.logs.labelSite}
                    </label>
                    <select id="log-site" className={inputCls + " w-56"}>
                      {isAdmin && (
                        <Fragment>
                          <option value="">{t.nginx.logs.optionGlobal}</option>
                        </Fragment>
                      )}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" htmlFor="log-type">
                      {t.nginx.logs.labelType}
                    </label>
                    <select id="log-type" className={inputCls + " w-36"}>
                      <option value="error">error</option>
                      <option value="access">access</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium" htmlFor="log-lines">
                      {t.nginx.logs.labelLines}
                    </label>
                    <input
                      id="log-lines"
                      type="number"
                      defaultValue="200"
                      min="1"
                      max="2000"
                      className={inputCls + " w-28"}
                    />
                  </div>
                  <button
                    id="log-refresh"
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {t.nginx.logs.btnRefresh}
                  </button>
                  <button
                    id="nginx-ai-logs"
                    type="button"
                    className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    <i className="ti ti-sparkles mr-1" aria-hidden="true"></i>
                    {t.nginx.overview.diagnose}
                  </button>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      id="log-auto"
                      type="checkbox"
                      className="h-4 w-4 rounded border-input text-primary"
                    />
                    {t.nginx.logs.labelAutoRefresh}
                  </label>
                  <span
                    id="log-path"
                    className="ml-auto text-xs text-muted-foreground font-mono"
                  ></span>
                </div>
                <pre
                  id="log-output"
                  className="m-0 max-h-[60vh] overflow-auto p-4 text-xs font-mono leading-relaxed"
                >
                  {t.nginx.logs.outputPlaceholder}
                </pre>
              </div>
            </div>
          </Fragment>
        )}

        {/** ═══ TAB: ESTADO ═══ */}
        {showNginxView("status") && (
          <Fragment>
            <div id="panel-status" className="tab-panel hidden">
              <div
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-5"
                id="status-cards"
              >
                <div className="h-20 animate-pulse rounded-xl bg-muted"></div>
                <div className="h-20 animate-pulse rounded-xl bg-muted"></div>
                <div className="h-20 animate-pulse rounded-xl bg-muted"></div>
                <div className="h-20 animate-pulse rounded-xl bg-muted"></div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 mb-5">
                <h3 className="text-sm font-semibold mb-3">
                  {t.nginx.status.serviceControlHeading}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    data-svc="start"
                    className="svc-btn rounded-lg border border-emerald-600/40 px-3 py-2 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10"
                  >
                    <i className="ti ti-player-play mr-1"></i>
                    {t.nginx.status.btnStart}
                  </button>
                  <button
                    data-svc="stop"
                    className="svc-btn rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
                  >
                    <i className="ti ti-player-stop mr-1"></i>
                    {t.nginx.status.btnStop}
                  </button>
                  <button
                    data-svc="restart"
                    className="svc-btn rounded-lg border border-amber-600/40 px-3 py-2 text-xs font-medium text-amber-600 hover:bg-amber-500/10"
                  >
                    <i className="ti ti-refresh mr-1"></i>
                    {t.nginx.status.btnRestart}
                  </button>
                  <button
                    data-svc="reload"
                    className="svc-btn rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
                  >
                    <i className="ti ti-reload mr-1"></i>
                    {t.nginx.status.btnReload}
                  </button>
                  <button
                    data-svc="test"
                    className="svc-btn rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
                  >
                    <i className="ti ti-checkup-list mr-1"></i>nginx -t
                  </button>
                </div>
                <pre
                  id="svc-output"
                  className="mt-3 hidden m-0 max-h-48 overflow-auto rounded-lg bg-muted/50 p-3 text-xs font-mono"
                ></pre>
              </div>

              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <h3 className="text-sm font-semibold">
                    {t.nginx.status.globalConfHeading}
                  </h3>
                  <button
                    id="btn-edit-conf"
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <i className="ti ti-edit mr-1"></i>
                    {t.nginx.status.btnEditConf}
                  </button>
                </div>
                <pre
                  id="conf-preview"
                  className="m-0 max-h-72 overflow-auto p-4 text-xs font-mono text-muted-foreground"
                >
                  {t.nginx.status.confLoading}
                </pre>
              </div>
            </div>
          </Fragment>
        )}

        {/** ═══ TAB: RENDIMIENTO ═══ */}
        {showNginxView("perf") && (
          <Fragment>
            <div id="panel-perf" className="tab-panel hidden">
              <div className="mb-4 rounded-xl border border-border bg-muted/30 px-5 py-4">
                <h2 className="text-base font-semibold mb-1">
                  {t.nginx.performance.heading}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t.nginx.performance.descriptionPre}{" "}
                  <code>conf.d/lxp-performance.conf</code>{" "}
                  {t.nginx.performance.descriptionMid} <code>nginx.conf</code>
                  {t.nginx.performance.descriptionPost} <code>nginx -t</code>
                  {t.nginx.performance.descriptionFinal}
                </p>
              </div>
              <form id="form-perf" className="grid gap-4 lg:grid-cols-2">
                <div
                  id="perf-error"
                  className="hidden lg:col-span-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive whitespace-pre-wrap"
                ></div>

                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <h3 className="text-sm font-semibold">
                    {t.nginx.performance.compressionHeading}
                  </h3>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>{t.nginx.performance.labelGzip}</span>
                    <input
                      id="perf-gzip"
                      type="checkbox"
                      className="h-4 w-4 rounded border-input text-primary"
                    />
                  </label>
                  <div className="space-y-1.5">
                    <label className="text-sm" htmlFor="perf-gzip-level">
                      {t.nginx.performance.labelGzipLevel}
                    </label>
                    <input
                      id="perf-gzip-level"
                      type="number"
                      min="1"
                      max="9"
                      defaultValue="5"
                      className={inputCls + " w-28"}
                    />
                  </div>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>{t.nginx.performance.labelSendfile}</span>
                    <input
                      id="perf-sendfile"
                      type="checkbox"
                      className="h-4 w-4 rounded border-input text-primary"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>{t.nginx.performance.labelOpenFileCache}</span>
                    <input
                      id="perf-ofc"
                      type="checkbox"
                      className="h-4 w-4 rounded border-input text-primary"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>{t.nginx.performance.labelProxyCache}</span>
                    <input
                      id="perf-pcache"
                      type="checkbox"
                      className="h-4 w-4 rounded border-input text-primary"
                    />
                  </label>
                  <div className="space-y-1.5">
                    <label className="text-sm" htmlFor="perf-cache-days">
                      {t.nginx.performance.labelCacheDays}
                    </label>
                    <input
                      id="perf-cache-days"
                      type="number"
                      min="0"
                      max="365"
                      defaultValue="30"
                      className={inputCls + " w-28"}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <h3 className="text-sm font-semibold">
                    {t.nginx.performance.connectionsHeading}
                  </h3>
                  <div className="space-y-1.5">
                    <label className="text-sm" htmlFor="perf-keepalive">
                      {t.nginx.performance.labelKeepalive}
                    </label>
                    <input
                      id="perf-keepalive"
                      type="number"
                      min="0"
                      max="600"
                      defaultValue="65"
                      className={inputCls + " w-28"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm" htmlFor="perf-workers">
                      {t.nginx.performance.labelWorkers}
                    </label>
                    <input
                      id="perf-workers"
                      type="text"
                      defaultValue="auto"
                      placeholder={t.nginx.performance.placeholderWorkers}
                      className={inputCls + " w-40 font-mono"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm" htmlFor="perf-conns">
                      {t.nginx.performance.labelWorkerConns}
                    </label>
                    <input
                      id="perf-conns"
                      type="number"
                      min="64"
                      max="65536"
                      defaultValue="1024"
                      className={inputCls + " w-40"}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.nginx.performance.workerConnsNote}
                  </p>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {t.nginx.performance.btnApply}
                  </button>
                </div>
              </form>
            </div>
          </Fragment>
        )}
      </PanelLayout>

      {/** ── Dialog: Sitio (guiado) ───────────────────────────────────── */}
      <dialog
        id="dialog-site"
        className="w-full max-w-xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.nginx.siteDialog.titleNew}
          titleId="site-dialog-title"
          closeId="site-close"
        />
        <form id="form-site" className="flex flex-col gap-4 px-6 py-5">
          <div
            id="site-error"
            className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
          ></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="site-kind">
                {t.nginx.siteDialog.labelType}
              </label>
              <select
                id="site-kind"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
              >
                <option value="static">
                  {t.nginx.siteDialog.optionStatic}
                </option>
                <option
                  value="php"
                  disabled={
                    isHosting &&
                    Astro.locals.user?.hostingPolicy?.runtime &&
                    !Astro.locals.user?.hostingPolicy?.capabilities?.php
                  }
                >
                  {t.nginx.siteDialog.optionPhp}
                </option>
                {isAdmin && (
                  <Fragment>
                    <option value="proxy">
                      {t.nginx.siteDialog.optionProxy}
                    </option>
                  </Fragment>
                )}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="site-domain">
                {t.nginx.siteDialog.labelDomain}
              </label>
              <input
                id="site-domain"
                type="text"
                required
                placeholder={t.nginx.placeholders.domain}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="site-aliases">
              {t.nginx.siteDialog.labelAliases}{" "}
              <span className="text-muted-foreground font-normal">
                ({t.nginx.siteDialog.aliasesSuffix})
              </span>
            </label>
            <input
              id="site-aliases"
              type="text"
              placeholder={t.nginx.placeholders.aliases}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div id="site-root-field" className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="site-root">
              {t.nginx.siteDialog.labelDocRoot}
            </label>
            <input
              id="site-root"
              type="text"
              required={isHosting}
              placeholder={t.nginx.placeholders.docRoot}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div id="site-php-field" className="space-y-1.5 hidden">
            <label className="text-sm font-medium" htmlFor="site-php">
              {t.nginx.siteDialog.labelPhpSocket}
            </label>
            <input
              id="site-php"
              type="text"
              defaultValue="unix:/run/php/php-fpm.sock"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div id="site-proxy-field" className="space-y-1.5 hidden">
            <label className="text-sm font-medium" htmlFor="site-proxypass">
              {t.nginx.siteDialog.labelProxyPass}
            </label>
            <input
              id="site-proxypass"
              type="text"
              placeholder={t.nginx.siteDialog.placeholderProxyPass}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <label className="flex items-center gap-2 text-sm pt-1">
              <input
                id="site-ws"
                type="checkbox"
                className="h-4 w-4 rounded border-input text-primary"
              />
              {t.nginx.siteDialog.labelPassWsHeaders}
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              id="site-https"
              type="checkbox"
              className="h-4 w-4 rounded border-input text-primary"
            />
            {t.nginx.siteDialog.labelForceHttps}
          </label>
          <div className={isHosting ? "hidden" : "space-y-1.5"}>
            <label className="text-sm font-medium" htmlFor="site-extra">
              {t.nginx.siteDialog.labelExtraDirectives}{" "}
              <span className="text-muted-foreground font-normal">
                ({t.nginx.siteDialog.extraDirectivesSuffix})
              </span>
            </label>
            <textarea
              id="site-extra"
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder={t.nginx.siteDialog.placeholderExtraDirectives}
            ></textarea>
          </div>
          <button
            type="button"
            id="site-preview-btn"
            className="self-start rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
          >
            {t.nginx.proxy.btnPreview}
          </button>
          <pre
            id="site-preview"
            className="hidden max-h-44 overflow-auto rounded-lg border border-border bg-muted/20 p-3 text-xs font-mono"
          ></pre>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              id="site-cancel"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.nginx.siteDialog.btnCancel}
            </button>
            <button
              type="button"
              id="site-advanced"
              className={
                isHosting
                  ? "hidden"
                  : "rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              }
              title={t.nginx.siteDialog.btnAdvancedTitle}
            >
              <i className="ti ti-code mr-1"></i>
              {t.nginx.siteDialog.btnAdvanced}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.nginx.siteDialog.btnSave}
            </button>
          </div>
        </form>
      </dialog>

      {/** ── Dialog: renovación del certificado de un sitio ─────────── */}
      <dialog
        id="dialog-site-renewal"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.nginx.ssl.siteRenewalTitle}
          closeId="site-renewal-close"
        />
        <div className="space-y-4 px-6 py-5">
          <div>
            <p
              id="site-renewal-name"
              className="font-mono text-sm font-semibold"
            ></p>
            <p
              id="site-renewal-detail"
              role="status"
              aria-live="polite"
              className="mt-2 text-sm text-muted-foreground"
            ></p>
            <p
              id="site-renewal-scope-help"
              className="mt-2 text-xs text-muted-foreground"
            >
              {t.nginx.ssl.siteRenewalScopeHelp}
            </p>
          </div>
          <div
            id="site-renewal-lineages"
            className="hidden rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs break-all"
          ></div>
          <pre
            id="site-renewal-output"
            className="hidden max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-xs"
          ></pre>
          <div className="flex flex-wrap gap-2">
            <button
              id="site-renewal-enable-https"
              type="button"
              className="hidden rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.nginx.ssl.btnEnableHttps}
            </button>
            {isAdmin && (
              <Fragment>
                <button
                  id="site-renewal-configure"
                  type="button"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {t.nginx.ssl.renewalConfigure}
                </button>
              </Fragment>
            )}
            {isAdmin && (
              <Fragment>
                <button
                  id="site-renewal-test"
                  type="button"
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  {t.nginx.ssl.siteRenewalTestAll}
                </button>
              </Fragment>
            )}
          </div>
        </div>
      </dialog>

      {/** ── Dialog: Editor avanzado (Monaco, reutiliza el de Files) ──── */}
      <dialog
        id="dialog-adv"
        className="h-[96dvh] w-[98vw] max-w-none rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="flex h-full flex-col">
          <ModalNavbar
            title={t.nginx.advDialog.titleEdit}
            titleId="adv-title"
            closeId="adv-close"
          />
          <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
            <div id="adv-name-row" className="mb-3 shrink-0 space-y-1.5">
              <label className="text-sm font-medium" htmlFor="adv-name">
                {t.nginx.advDialog.labelFileName}
              </label>
              <input
                id="adv-name"
                type="text"
                placeholder={t.nginx.placeholders.domain}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-mono focus:border-primary focus:outline-none"
              />
            </div>
            <div
              id="adv-error"
              className="hidden mb-3 shrink-0 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive whitespace-pre-wrap"
            ></div>
            <div
              id="nginx-adv-host"
              className="min-h-0 flex-1 rounded-lg border border-border overflow-hidden"
            ></div>
            <div className="flex shrink-0 gap-3 pt-4">
              <button
                type="button"
                id="adv-cancel"
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                {t.nginx.advDialog.btnCancel}
              </button>
              <button
                type="button"
                id="adv-save"
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t.nginx.advDialog.btnSave}
              </button>
            </div>
          </div>
        </div>
      </dialog>

      {/** ── Dialog: Habilitar HTTPS ──────────────────────────────────── */}
      <dialog
        id="dialog-ssl"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.nginx.httpsDialog.titleEnable}
          closeId="ssl-close"
        />
        <form id="form-ssl" className="flex flex-col gap-4 px-6 py-5">
          <div
            id="ssl-error"
            className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
          ></div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="ssl-site">
              {t.nginx.httpsDialog.labelSite}
            </label>
            <select
              id="ssl-site"
              required
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-mono focus:border-primary focus:outline-none"
            ></select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="ssl-email">
              {t.nginx.httpsDialog.labelEmail}
            </label>
            <input
              id="ssl-email"
              type="email"
              required
              placeholder={t.nginx.placeholders.email}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              id="ssl-cancel"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.nginx.httpsDialog.btnCancel}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.nginx.httpsDialog.btnSubmit}
            </button>
          </div>
        </form>
      </dialog>

      <div
        id="toast"
        className="fixed bottom-4 right-4 z-50 hidden max-w-md rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
      >
        <p id="toast-msg" className="text-sm font-medium"></p>
      </div>

      <script
        id="nginx-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["nginx"]) }}
      ></script>
    </Fragment>
  );
}
