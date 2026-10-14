// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/hosting/index.astro.
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
 * /panel/hosting — Shared hosting accounts management (WHM-style).
 * Admin-only page. Lists all tenant accounts with actions.
 */
import PanelLayout from "../module-frame";
import { adminRedirect } from "../view-context";
import DataTable from "@/components/ui/DataTable";
import { getPageMessages } from "../view-context";
import {
  buildHostingTableColumns,
  buildHostingTableFilters,
  buildHostingTableRowActions,
  buildHostingTableValueBadges,
} from "@/config/tables/hosting-table-config";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import ProviderGroupSettings from "./components_hosting_ProviderGroupSettings";
export default function pages_panel_hosting_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["hosting", "components", "permissions"]);
  const hs: any = t.hosting.settingsUi;
  const dataTableI18n = t.components.dataTable;
  // E-11: guarda admin compartida (antes copiada por página).
  const denied = adminRedirect(Astro);
  if (denied) return denied;
  const HOSTING_ROW_ACTIONS = buildHostingTableRowActions(t.hosting);
  const HOSTING_PAGE_SIZES = [10, 25, 50, 100];
  // Initial page data is now fetched client-side after mount (the page
  // script always re-fetches anyway, so the SSR round-trip was double work
  // AND blocked the first paint). Cache-first backend makes the client
  // fetch sub-100ms — render the skeleton immediately and let it fill in.
  {
  }
  return (
    <Fragment>
      <PanelLayout title={t.hosting.pageTitle} activeModule="hosting">
        <div slot="title-actions">
          <ViewSettingsModal
            id="hosting-settings-modal"
            title={hs.title}
            description={hs.description}
            variant="drawer"
            hideFooter={true}
          >
            <div className="flex h-full min-h-0 w-full @container">
              <nav className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52">
                <button
                  type="button"
                  data-hosting-settings-nav="table"
                  title={hs.table}
                  aria-current="page"
                  className="flex items-center justify-center gap-2.5 rounded-lg bg-primary/10 px-2.5 py-2 text-sm font-medium text-primary transition-colors duration-200 ease-out @xl:justify-start"
                >
                  <i className="ti ti-table shrink-0 text-lg" aria-hidden></i>
                  <span className="hidden truncate @xl:inline">{hs.table}</span>
                </button>
                <button
                  type="button"
                  data-hosting-settings-nav="providers"
                  title={hs.apiProviders}
                  className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground hover:bg-accent @xl:justify-start"
                >
                  <i
                    className="ti ti-plug-connected shrink-0 text-lg"
                    aria-hidden
                  ></i>
                  <span className="hidden truncate @xl:inline">
                    {hs.apiProviders}
                  </span>
                </button>
              </nav>
              <div className="min-w-0 flex-1 overflow-y-auto px-5 py-5">
                <section
                  data-hosting-settings-view="table"
                  className="mt-0 space-y-5"
                >
                  <div>
                    <h4 className="text-sm font-semibold">
                      {t.components.tableSettings.pagination}
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {hs.rowsPerPage}
                    </p>
                    <div className="mt-3 inline-flex rounded-lg border border-border p-1">
                      {HOSTING_PAGE_SIZES.map((n: any) => (
                        <Fragment>
                          <button
                            type="button"
                            data-hosting-pagesize={String(n)}
                            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
                          >
                            {n}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-border pt-5">
                    <h4 className="text-sm font-semibold">
                      {hs.newAccountDefaults}
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {hs.defaultsHint}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <label>
                        {t.hosting.modal.labelPlan}
                        <select
                          id="host-default-plan"
                          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                        >
                          <option value="basic">
                            {t.hosting.options.planBasic}
                          </option>
                          <option value="pro">
                            {t.hosting.options.planPro}
                          </option>
                          <option value="business">
                            {t.hosting.options.planBusiness}
                          </option>
                          <option value="custom">
                            {t.hosting.options.planCustom}
                          </option>
                        </select>
                      </label>
                      <label>
                        {t.hosting.stats.disk}
                        <input
                          id="host-default-disk"
                          type="number"
                          min="256"
                          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                        />
                      </label>
                      <label>
                        {t.hosting.stats.bandwidth}
                        <input
                          id="host-default-bandwidth"
                          type="number"
                          min="1024"
                          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                        />
                      </label>
                      <label>
                        {t.hosting.stats.domains}
                        <input
                          id="host-default-domains"
                          type="number"
                          min="1"
                          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                        />
                      </label>
                      <label>
                        {hs.emailAccounts}
                        <input
                          id="host-default-emails"
                          type="number"
                          min="1"
                          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                        />
                      </label>
                      <label>
                        {t.hosting.stats.databases}
                        <input
                          id="host-default-databases"
                          type="number"
                          min="0"
                          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                        />
                      </label>
                      <label>
                        {hs.subusers}
                        <input
                          id="host-default-subusers"
                          type="number"
                          min="0"
                          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                        />
                      </label>
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-xs">
                      <input id="host-default-jail" type="checkbox" />
                      {hs.defaultJail}
                    </label>
                    <label className="mt-3 block text-xs">
                      {hs.defaultModules}
                      <input
                        id="host-default-modules"
                        type="text"
                        className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5"
                        placeholder="files, databases"
                      />
                    </label>
                    <button
                      id="host-default-save"
                      type="button"
                      className="mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                    >
                      {hs.saveDefaults}
                    </button>
                    <p
                      id="host-default-status"
                      role="status"
                      className="mt-2 text-xs text-muted-foreground"
                    ></p>
                  </div>
                  <div className="border-t border-border pt-5">
                    <h4 className="text-sm font-semibold">
                      {hs.relatedModules}
                    </h4>
                    <div className="mt-3 flex flex-col gap-2 text-xs">
                      <a
                        href="/panel/users"
                        className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                      >
                        {hs.users}
                      </a>
                      <a
                        href="/panel/databases"
                        className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                      >
                        {t.hosting.stats.databases}
                      </a>
                      <a
                        href="/panel/nginx"
                        className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                      >
                        {hs.domainsSsl}
                      </a>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">
                        {t.components.tableSettings.visibleActions}
                      </h4>
                      <div className="flex items-center gap-3 text-xs">
                        <button
                          type="button"
                          data-hosting-actions-all="show"
                          className="font-medium text-primary hover:underline"
                        >
                          {hs.showAll}
                        </button>
                        <span className="text-muted-foreground">·</span>
                        <button
                          type="button"
                          data-hosting-actions-all="hide"
                          className="font-medium text-muted-foreground hover:underline"
                        >
                          {hs.hideAll}
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.components.tableSettings.actionsHint}
                    </p>
                    <div className="mt-3 space-y-1">
                      {HOSTING_ROW_ACTIONS.map((a: any) => (
                        <Fragment>
                          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/50">
                            <input
                              type="checkbox"
                              data-hosting-action-toggle={a.id}
                              className="h-4 w-4"
                              defaultChecked
                            />
                            <i
                              className={`ti ${a.icon ?? "ti-dots"} text-base text-muted-foreground`}
                              aria-hidden
                            ></i>
                            <span className="truncate">{a.label}</span>
                          </label>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </section>
                <ProviderGroupSettings
                  h={t.hosting}
                  hs={hs}
                  pplan={t.permissions}
                />
              </div>
            </div>
          </ViewSettingsModal>
        </div>

        <div className="space-y-6">
          {/** Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {t.hosting.pageTitle}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t.hosting.pageSubtitle}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/panel/docs/hosting-api"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <i className="ti ti-book-2" aria-hidden="true"></i>
                {hs.apiGuide}
              </a>
              <button
                id="btn-new"
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <i className="ti ti-plus text-base"></i>
                {t.hosting.btnNewAccount}
              </button>
            </div>
          </div>

          {/** Stats strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: t.hosting.stats.total,
                id: "stat-total",
                icon: "server-2",
                color: "text-primary",
              },
              {
                label: t.hosting.stats.active,
                id: "stat-active",
                icon: "check-circle",
                color: "text-emerald-500",
              },
              {
                label: t.hosting.stats.suspended,
                id: "stat-suspended",
                icon: "ban",
                color: "text-amber-500",
              },
              {
                label: t.hosting.stats.terminated,
                id: "stat-terminated",
                icon: "trash",
                color: "text-destructive",
              },
            ].map((s: any) => (
              <Fragment>
                <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${s.color}`}
                  >
                    <i className={`ti ti-${s.icon} text-xl`}></i>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold text-foreground" id={s.id}>
                      —
                    </p>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>

          {/** Table */}
          <div
            id="hosting-load-error"
            className="hidden rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            <span id="hosting-load-error-text"></span>
            <button
              id="hosting-retry"
              type="button"
              className="ml-3 font-semibold underline"
            >
              {hs.retry}
            </button>
          </div>
          <DataTable
            scopedPreferences={true}
            i18n={dataTableI18n}
            tableId="hosting-accounts-table"
            externalPagination={true}
            serverQuery={true}
            title={t.hosting.tableTitle}
            columns={buildHostingTableColumns(t.hosting)}
            data={[]}
            filters={buildHostingTableFilters(t.hosting)}
            rowActions={buildHostingTableRowActions(t.hosting)}
            valueBadges={buildHostingTableValueBadges(t.hosting)}
          />
        </div>

        {/** ── CREATE / EDIT MODAL ──────────────────────────────────── */}
        <div
          id="modal-overlay"
          className="hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-bold text-foreground" id="modal-title">
                {t.hosting.modal.titleNew}
              </h3>
              <button
                id="modal-close"
                className="rounded-lg p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground"
              >
                <i className="ti ti-x text-lg"></i>
              </button>
            </div>

            <form id="account-form" className="px-6 py-5 space-y-4">
              <input type="hidden" id="edit-id" defaultValue="" />

              {/** Sub-pestañas del formulario */}
              <div className="flex gap-4 border-b border-border">
                <button
                  type="button"
                  data-host-tab="account"
                  className="host-tab -mb-px border-b-2 transition-colors duration-200 ease-out border-primary pb-2 text-xs font-semibold text-foreground"
                >
                  {t.hosting.modal.tabs?.account ?? "Cuenta"}
                </button>
                <button
                  type="button"
                  data-host-tab="resources"
                  className="host-tab -mb-px border-b-2 transition-colors duration-200 ease-out border-transparent pb-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  {t.hosting.modal.tabs?.resources ?? "Recursos"}
                </button>
                <button
                  type="button"
                  data-host-tab="security"
                  className="host-tab -mb-px border-b-2 transition-colors duration-200 ease-out border-transparent pb-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  {t.hosting.modal.tabs?.security ?? "Módulos y seguridad"}
                </button>
              </div>

              {/** TAB: Cuenta */}
              <div className="host-pane space-y-4" data-host-pane="account">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      {t.hosting.modal.labelUsername}
                    </label>
                    <input
                      id="f-username"
                      type="text"
                      required
                      pattern="[a-z0-9_\-]{3,64}"
                      placeholder={t.hosting.modal.phUsername}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {t.hosting.modal.hintUsername}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      {t.hosting.modal.labelPassword}
                    </label>
                    <input
                      id="f-password"
                      type="password"
                      placeholder={t.hosting.modal.phPassword}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      {t.hosting.modal.labelName}
                    </label>
                    <input
                      id="f-displayName"
                      type="text"
                      placeholder={t.hosting.modal.phName}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      {t.hosting.modal.labelEmail}
                    </label>
                    <input
                      id="f-email"
                      type="email"
                      placeholder={t.hosting.modal.phEmail}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label
                      htmlFor="f-template-id"
                      className="text-xs font-medium"
                    >
                      {t.permissions.title}
                    </label>
                    <select
                      id="f-template-id"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">{t.permissions.legacy}</option>
                    </select>
                    <p
                      id="f-template-state"
                      className="text-xs text-muted-foreground"
                    ></p>
                    <button
                      id="f-template-reconcile"
                      type="button"
                      className="hidden rounded-lg border border-border px-3 py-2 text-xs"
                    >
                      {t.permissions.retry}
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      {t.hosting.modal.labelPlan}
                    </label>
                    <select
                      id="f-plan"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="basic">
                        {t.hosting.options.planBasic}
                      </option>
                      <option value="pro">{t.hosting.options.planPro}</option>
                      <option value="business">
                        {t.hosting.options.planBusiness}
                      </option>
                      <option value="custom">
                        {t.hosting.options.planCustom}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      {t.hosting.modal.labelExpiresAt}
                    </label>
                    <input
                      id="f-expires"
                      type="date"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {t.hosting.modal.hintExpiresAt}
                    </p>
                  </div>
                </div>

                {/** Identidad del tenant (sólo lectura, derivada del envelope) — visible al editar */}
                <div
                  id="f-envelope-readonly"
                  className="hidden grid grid-cols-2 gap-4 rounded-xl border border-dashed border-border bg-muted/20 p-3"
                >
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      {t.hosting.modal.labelTenantGroup}
                    </label>
                    <p
                      id="f-tenant-group"
                      className="text-xs font-mono text-foreground break-all"
                    >
                      —
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {t.hosting.modal.hintTenantGroup}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      {t.hosting.modal.labelHomeRoot}
                    </label>
                    <p
                      id="f-home-root"
                      className="text-xs font-mono text-foreground break-all"
                    >
                      —
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {t.hosting.modal.hintHomeRoot}
                    </p>
                  </div>
                </div>
              </div>

              {/** TAB: Recursos */}
              <div
                className="host-pane hidden space-y-4"
                data-host-pane="resources"
              >
                <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    {t.hosting.modal.resourcesTitle}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">
                        {t.hosting.modal.labelDisk}
                      </label>
                      <input
                        id="f-disk"
                        type="number"
                        defaultValue="10240"
                        min="256"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        {t.hosting.modal.labelBandwidth}
                      </label>
                      <input
                        id="f-bandwidth"
                        type="number"
                        defaultValue="102400"
                        min="1024"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        {t.hosting.modal.labelDomains}
                      </label>
                      <input
                        id="f-domains"
                        type="number"
                        defaultValue="10"
                        min="1"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        {t.hosting.modal.labelEmails}
                      </label>
                      <input
                        id="f-emails"
                        type="number"
                        defaultValue="20"
                        min="1"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        {t.hosting.modal.labelDatabases}
                      </label>
                      <input
                        id="f-databases"
                        type="number"
                        defaultValue="0"
                        min="0"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        {t.hosting.modal.labelSubUsers}
                      </label>
                      <input
                        id="f-maxsubusers"
                        type="number"
                        defaultValue="0"
                        min="0"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/** TAB: Módulos y seguridad */}
              <div
                className="host-pane hidden space-y-4"
                data-host-pane="security"
              >
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    {t.hosting.modal.labelModules}
                  </label>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    {t.hosting.modal.hintModules}
                  </p>
                  <div
                    id="f-allowed-modules-grid"
                    className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3 bg-background"
                  >
                    <p
                      className="col-span-full text-xs text-muted-foreground"
                      data-modules-loading
                    >
                      {t.hosting.modal.modulesLoading}
                    </p>
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-3 cursor-pointer">
                  <input
                    id="f-jail-enabled"
                    type="checkbox"
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      {t.hosting.modal.labelJail}
                    </span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      {t.hosting.modal.hintJail}
                    </span>
                  </span>
                </label>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    {t.hosting.modal.labelNotes}
                  </label>
                  <textarea
                    id="f-notes"
                    rows={2}
                    placeholder={t.hosting.modal.phNotes}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  ></textarea>
                </div>
              </div>

              <p
                id="form-error"
                className="hidden text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2"
              ></p>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  id="modal-cancel"
                  className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                >
                  {t.hosting.modal.btnCancel}
                </button>
                <button
                  type="submit"
                  id="form-submit"
                  className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {t.hosting.modal.btnCreate}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/** ── CHANGE PASSWORD MODAL ────────────────────────────────── */}
        <div
          id="pwd-overlay"
          className="hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-bold text-foreground">
                {t.hosting.pwdModal.title}
              </h3>
              <button
                id="pwd-close"
                className="rounded-lg p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground"
              >
                <i className="ti ti-x text-lg"></i>
              </button>
            </div>
            <form id="pwd-form" className="px-6 py-5 space-y-4">
              <input type="hidden" id="pwd-account-id" />
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  {t.hosting.pwdModal.labelNew}
                </label>
                <input
                  id="pwd-input"
                  type="password"
                  required
                  minLength={8}
                  placeholder={t.hosting.pwdModal.phPassword}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <p
                id="pwd-error"
                className="hidden text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2"
              ></p>
              <div className="flex gap-3">
                <button
                  type="button"
                  id="pwd-cancel"
                  className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent"
                >
                  {t.hosting.pwdModal.btnCancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  {t.hosting.pwdModal.btnChange}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/** ── DETALLE / USO (STATS) MODAL ──────────────────────────── */}
        <div
          id="stats-overlay"
          className="hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-bold text-foreground" id="stats-title">
                {t.hosting.stats.title}
              </h3>
              <button
                id="stats-close"
                className="rounded-lg p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground"
              >
                <i className="ti ti-x text-lg"></i>
              </button>
            </div>
            <div
              className="px-6 py-5 space-y-4 overflow-y-auto"
              id="stats-body"
            >
              <p className="text-sm text-muted-foreground" data-stats-loading>
                {t.hosting.modal.modulesLoading}
              </p>
            </div>
          </div>
        </div>

        {/** ── AUDITORÍA MODAL ──────────────────────────────────────── */}
        <div
          id="audit-overlay"
          className="hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-bold text-foreground" id="audit-title">
                {t.hosting.audit.title}
              </h3>
              <button
                id="audit-close"
                className="rounded-lg p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground"
              >
                <i className="ti ti-x text-lg"></i>
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto" id="audit-body">
              <p className="text-sm text-muted-foreground" data-audit-loading>
                {t.hosting.modal.modulesLoading}
              </p>
            </div>
          </div>
        </div>
      </PanelLayout>

      <script
        id="permissions-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t.permissions) }}
      ></script>
      <script
        id="hosting-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["hosting"]) }}
      ></script>
    </Fragment>
  );
}
