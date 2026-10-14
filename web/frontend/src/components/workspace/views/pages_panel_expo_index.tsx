// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/expo/index.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

/**
 * Expo — /panel/expo
 *
 * Manage Expo / React Native apps for the connected server: EAS builds, store
 * submissions, OTA updates, dev-client QR for real-device testing and build
 * quota. The Expo access token (EXPO_TOKEN) is stored server-side and is never
 * echoed back — only a masked preview reaches the browser. Store credentials
 * (Google service-account JSON, Apple ASC .p8) live on the client server.
 */
import PanelLayout from "../module-frame";
import DataTable from "@/components/ui/DataTable";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import ModalNavbar from "./components_ui_ModalNavbar";
import {
  buildExpoBuildsColumns,
  buildExpoBuildsRowActions,
  buildExpoBuildStatusBadges,
  buildExpoStoreColumns,
  buildExpoStoreValueBadges,
  buildExpoEnvColumns,
  buildExpoEnvRowActions,
} from "@/config/tables/expo-table-config";
import { getPageMessages } from "../view-context";
export default function pages_panel_expo_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["expo", "settings", "components"]);
  const ex: any = t.expo;
  const dataTableI18n = (t.components as any).dataTable;

  return (
    <Fragment>
      <PanelLayout title={t.expo.pageTitle} activeModule="expo">
        <div slot="title-actions">
          <ViewSettingsModal
            id="expo-settings-modal"
            title={ex.settingsUi.title}
            description={ex.settingsUi.description}
            variant="drawer"
            hideFooter={true}
          >
            <div className="flex h-full min-h-0 w-full @container">
              <nav className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52">
                <button
                  type="button"
                  data-expo-settings-nav="table"
                  title={ex.settingsUi.table}
                  className="flex items-center justify-center gap-2.5 rounded-lg bg-primary/10 px-2.5 py-2 text-sm font-medium text-primary transition-colors duration-200 ease-out @xl:justify-start"
                >
                  <i className="ti ti-table shrink-0 text-lg" aria-hidden></i>
                  <span className="hidden truncate @xl:inline">
                    {ex.settingsUi.table}
                  </span>
                </button>
              </nav>
              <div
                className="min-w-0 flex-1 overflow-y-auto px-5 py-5 space-y-6"
                data-expo-settings-view="table"
              >
                {/* Builds */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    {t.expo.builds?.title ?? "Builds"}
                  </h3>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      {ex.settingsUi.rowsPerPage}
                    </p>
                    <div
                      className="inline-flex overflow-hidden rounded-lg border border-border"
                      data-expo-pagesize-group="expo-builds-table"
                    >
                      {[10, 25, 50, 100].map((n: any) => (
                        <Fragment>
                          <button
                            type="button"
                            data-expo-pagesize="expo-builds-table"
                            data-value={String(n)}
                            className="border-r border-border px-3 py-1.5 text-sm last:border-r-0 hover:bg-accent"
                          >
                            {n}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t.components.tableSettings.visibleActions}
                    </p>
                    <div className="space-y-1">
                      {buildExpoBuildsRowActions(ex).map((a: any) => (
                        <Fragment>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              data-expo-action="expo-builds-table"
                              data-action-id={a.id}
                              className="h-4 w-4"
                              defaultChecked
                            />
                            <i
                              className={`ti ${a.icon ?? "ti-dots"} text-sm text-muted-foreground`}
                            ></i>
                            <span>{a.label}</span>
                          </label>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </section>
                <section className="space-y-3 border-t border-border pt-5">
                  <h3 className="text-sm font-semibold">
                    {ex.settingsUi.relatedModules}
                  </h3>
                  <div className="flex flex-col gap-2 text-xs">
                    <a
                      href="/panel/files"
                      className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                    >
                      {ex.settingsUi.appFiles}
                    </a>
                    <a
                      href="/panel/assistant"
                      className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                    >
                      {ex.settingsUi.devAssistant}
                    </a>
                    <a
                      href="/panel/github"
                      className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                    >
                      {ex.settingsUi.repositoryBackup}
                    </a>
                  </div>
                </section>
                {/* Store (sin acciones) */}
                <section className="space-y-3 border-t border-border pt-5">
                  <h3 className="text-sm font-semibold">
                    {t.expo.storeAccounts?.title ?? "Store"}
                  </h3>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      {ex.settingsUi.rowsPerPage}
                    </p>
                    <div
                      className="inline-flex overflow-hidden rounded-lg border border-border"
                      data-expo-pagesize-group="expo-store-table"
                    >
                      {[10, 25, 50, 100].map((n: any) => (
                        <Fragment>
                          <button
                            type="button"
                            data-expo-pagesize="expo-store-table"
                            data-value={String(n)}
                            className="border-r border-border px-3 py-1.5 text-sm last:border-r-0 hover:bg-accent"
                          >
                            {n}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </ViewSettingsModal>
        </div>
        <div className="mb-5 flex flex-col gap-1">
          <h2 className="text-xl font-semibold">{t.expo.header.heading}</h2>
          <p className="text-sm text-muted-foreground">
            {t.expo.header.subheading}
          </p>
        </div>

        {/** No-token notice (visible only while no access token is configured) */}
        <div
          id="expo-no-token"
          className="mb-5 hidden items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
        >
          <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <i className="ti ti-alert-triangle text-base"></i>
            <span>{t.expo.common.noToken}</span>
          </p>
          <button
            id="expo-go-config"
            className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <i className="ti ti-key text-sm"></i> {t.expo.account.setToken}
          </button>
        </div>

        {/** Top cards: account / quota / token */}
        <div id="expo-root" className="mb-6 grid gap-4 lg:grid-cols-3">
          {/** Account card */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <i className="ti ti-brand-expo text-lg"></i>
              <h3 className="text-sm font-semibold">{t.expo.account.title}</h3>
            </div>
            <p
              id="expo-account-state"
              className="text-sm text-muted-foreground"
            >
              {t.expo.account.loading}
            </p>
            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              <button
                id="expo-token-set"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <i className="ti ti-key text-sm"></i>{" "}
                <span id="expo-token-set-label">{t.expo.account.setToken}</span>
              </button>
              <button
                id="expo-token-test"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent"
              >
                <i className="ti ti-plug-connected text-sm"></i>{" "}
                {t.expo.config.test}
              </button>
              
            </div>
            <a
              href="/panel/settings#cred-expo"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <i className="ti ti-key text-sm"></i>{" "}
              {t.settings.credentials.title}
            </a>
          </div>

          {/** Quota card */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{t.expo.quota.title}</h3>
              <button
                id="expo-quota-refresh"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title={t.expo.common.refresh}
              >
                <i className="ti ti-refresh text-sm"></i>
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t.expo.quota.plan}</dt>
              <dd id="expo-quota-plan" className="text-right font-medium">
                —
              </dd>
              <dt className="text-muted-foreground">
                {t.expo.quota.remaining}
              </dt>
              <dd id="expo-quota-remaining" className="text-right font-medium">
                —
              </dd>
              <dt className="text-muted-foreground">
                {t.expo.quota.concurrency}
              </dt>
              <dd
                id="expo-quota-concurrency"
                className="text-right font-medium"
              >
                —
              </dd>
              <dt className="text-muted-foreground">{t.expo.quota.used}</dt>
              <dd id="expo-quota-used" className="text-right font-medium">
                —
              </dd>
            </dl>
          </div>

          {/** Create app card */}
          <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-5">
            <div className="flex items-center gap-2">
              <i className="ti ti-sparkles text-lg text-primary"></i>
              <h3 className="text-sm font-semibold">{t.expo.create.title}</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.expo.create.hint}
            </p>
            <button
              id="expo-create-open"
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <i className="ti ti-plus text-base"></i> {t.expo.projects.create}
            </button>
          </div>
        </div>

        {/** Projects */}
        <section className="mb-6 min-w-0 rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">{t.expo.projects.title}</h3>
            <div className="flex items-center gap-2">
              <button
                id="expo-projects-link"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <i className="ti ti-link text-sm"></i> {t.expo.projects.link}
              </button>
              <button
                id="expo-projects-refresh"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <i className="ti ti-refresh text-sm"></i>{" "}
                {t.expo.projects.refresh}
              </button>
            </div>
          </div>
          <div id="expo-projects" className="min-h-[10rem]">
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t.expo.common.loading}
            </div>
          </div>
          <div
            id="expo-readiness"
            className="border-t border-border px-4 py-3 text-xs text-muted-foreground"
          >
            {ex.settingsUi.selectProjectPrep}
          </div>
        </section>

        {/** Build history */}
        <section className="mb-6 min-w-0 rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">{t.expo.history.title}</h3>
            <button
              id="expo-history-refresh"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <i className="ti ti-refresh text-sm"></i> {t.expo.history.refresh}
            </button>
          </div>
          {/** Build history filters */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
            <select
              id="expo-bh-status"
              className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
            >
              <option value="">{t.expo.history.filterStatusAll}</option>
            </select>
            <select
              id="expo-bh-platform"
              className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
            >
              <option value="">{t.expo.history.filterPlatformAll}</option>
            </select>
            <select
              id="expo-bh-profile"
              className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
            >
              <option value="">{t.expo.history.filterProfileAll}</option>
            </select>
            <div className="relative">
              <button
                id="expo-bh-daterange"
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <i className="ti ti-calendar text-sm"></i>{" "}
                <span id="expo-bh-daterange-label">
                  {t.expo.history.dateRange}
                </span>
              </button>
              <div
                id="expo-bh-calendar"
                className="absolute left-0 top-full z-30 mt-1 hidden w-[18rem] rounded-xl border border-border bg-card p-3 shadow-2xl"
              ></div>
            </div>
            <button
              id="expo-bh-clear"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <i className="ti ti-x text-sm"></i> {t.expo.history.clearFilters}
            </button>
          </div>
          <div className="p-4">
            <DataTable
              scopedPreferences={true}
              i18n={dataTableI18n}
              tableId="expo-builds-table"
              title={t.expo.history.title}
              columns={buildExpoBuildsColumns(ex)}
              data={[]}
              rowActions={buildExpoBuildsRowActions(ex)}
              valueBadges={buildExpoBuildStatusBadges(ex)}
              selectable={false}
            />
          </div>
        </section>

        {/** Store accounts + Env mini-managers */}
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {/** Store accounts */}
          <section className="min-w-0 rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold">
              {t.expo.storeAccounts.title}
            </h3>

            {/** Unified credential table: EAS-managed, project (eas.json) and panel-staged */}
            <div className="mb-5">
              <DataTable
                scopedPreferences={true}
                i18n={dataTableI18n}
                tableId="expo-store-table"
                title={t.expo.storeAccounts.title}
                columns={buildExpoStoreColumns(ex)}
                data={[]}
                valueBadges={buildExpoStoreValueBadges(ex)}
                selectable={false}
              />
            </div>

            <div className="mb-5 flex flex-col gap-2 rounded-lg border border-border p-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t.expo.storeAccounts.google}
              </span>
              <p className="text-[11px] text-muted-foreground">
                {t.expo.storeAccounts.googleHint}
              </p>
              <div className="flex items-center gap-2">
                <input
                  id="expo-google-json"
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                />
                <button
                  id="expo-google-upload"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <i className="ti ti-upload text-sm"></i>{" "}
                  {t.expo.storeAccounts.googleUpload}
                </button>
                <span
                  id="expo-google-state"
                  className="text-xs text-muted-foreground"
                ></span>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t.expo.storeAccounts.apple}
              </span>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="expo-apple-issuer"
                    className="mb-1 block text-[11px] font-medium text-muted-foreground"
                  >
                    {t.expo.storeAccounts.appleIssuerId}
                  </label>
                  <input
                    id="expo-apple-issuer"
                    type="text"
                    spellCheck="false"
                    autoComplete="off"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="expo-apple-key-id"
                    className="mb-1 block text-[11px] font-medium text-muted-foreground"
                  >
                    {t.expo.storeAccounts.appleKeyId}
                  </label>
                  <input
                    id="expo-apple-key-id"
                    type="text"
                    spellCheck="false"
                    autoComplete="off"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="expo-apple-p8"
                  type="file"
                  accept=".p8"
                  className="hidden"
                />
                <button
                  id="expo-apple-upload"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <i className="ti ti-upload text-sm"></i>{" "}
                  {t.expo.storeAccounts.appleUpload}
                </button>
                <span
                  id="expo-apple-state"
                  className="text-xs text-muted-foreground"
                ></span>
              </div>
              <div>
                <button
                  id="expo-apple-save"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <i className="ti ti-device-floppy text-sm"></i>{" "}
                  {t.expo.storeAccounts.save}
                </button>
              </div>
            </div>
          </section>

          {/** Env / secrets mini-manager */}
          <section className="min-w-0 rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{t.expo.env.title}</h3>
              <button
                id="expo-env-add"
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
              >
                <i className="ti ti-plus text-sm"></i> {t.expo.env.add}
              </button>
            </div>
            {/** Env filters */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                id="expo-env-filter-text"
                type="text"
                placeholder={t.expo.env.filterPlaceholder}
                spellCheck="false"
                autoComplete="off"
                className="min-w-[8rem] flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
              />
              <select
                id="expo-env-filter-scope"
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              >
                <option value="">{t.expo.env.filterScopeAll}</option>
              </select>
              <select
                id="expo-env-filter-visibility"
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              >
                <option value="">{t.expo.env.filterVisibilityAll}</option>
              </select>
              <select
                id="expo-env-filter-env"
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              >
                <option value="">{t.expo.env.filterEnvAll}</option>
              </select>
            </div>
            <div id="expo-env-table" className="min-h-[8rem]">
              <DataTable
                scopedPreferences={true}
                i18n={dataTableI18n}
                tableId="expo-env-table"
                title={t.expo.env.title}
                columns={buildExpoEnvColumns(ex)}
                data={[]}
                rowActions={buildExpoEnvRowActions(ex)}
                selectable={false}
              />
            </div>
          </section>
        </div>
      </PanelLayout>

      {/** Build dialog */}
      <dialog
        id="dlg-expo-build"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.expo.build.title}
          titleId="expo-build-title"
          closeId="expo-build-x"
        />
        <div className="space-y-4 px-6 py-4">
          <p id="expo-build-app" className="text-xs text-muted-foreground"></p>
          <div>
            <label
              htmlFor="expo-build-platform"
              className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {t.expo.build.platform}
            </label>
            <select
              id="expo-build-platform"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="android">{t.expo.build.android}</option>
              <option value="ios">{t.expo.build.ios}</option>
              <option value="all">{t.expo.build.all}</option>
            </select>
          </div>
          <p id="expo-build-status" className="hidden text-xs"></p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="expo-build-cancel"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t.expo.common.cancel}
          </button>
          <button
            id="expo-build-go"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <i className="ti ti-hammer text-base"></i> {t.expo.build.launch}
          </button>
        </div>
      </dialog>

      {/** Dev-client QR dialog */}
      <dialog
        id="dlg-expo-qr"
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.expo.devClient.title}
          titleId="expo-qr-title"
          closeId="expo-qr-x"
        />
        <div className="flex flex-col items-center gap-4 px-6 py-5 text-center">
          <p
            id="expo-qr-hint"
            className="mx-auto max-w-md text-xs text-muted-foreground"
          >
            {t.expo.devClient.hint}
          </p>
          <div
            id="expo-qr-box"
            className="mx-auto flex min-h-[12rem] flex-col items-center justify-center"
          >
            <span className="text-sm text-muted-foreground">
              {t.expo.devClient.starting}
            </span>
          </div>
          <div className="mx-auto w-full max-w-md">
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {t.expo.devClient.url}
            </span>
            <p
              id="expo-qr-url"
              className="select-all break-all rounded-md border border-border bg-muted/30 px-3 py-2 text-left font-mono text-xs"
            ></p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="expo-qr-stop"
            className="hidden inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-background px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <i className="ti ti-player-stop text-base"></i>{" "}
            {t.expo.devClient.stop}
          </button>
          <button
            id="expo-qr-close"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t.expo.common.close}
          </button>
        </div>
      </dialog>

      {/** Build logs dialog */}
      <dialog
        id="dlg-expo-logs"
        className="w-full max-w-3xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">{t.expo.logs.title}</h3>
            <p
              id="expo-logs-sub"
              className="truncate text-xs text-muted-foreground"
            ></p>
          </div>
          <button
            id="expo-logs-x"
            className="text-muted-foreground hover:text-foreground"
          >
            <i className="ti ti-x text-lg"></i>
          </button>
        </div>
        <div className="space-y-3 px-6 py-4">
          <div
            id="expo-logs-error"
            className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm"
          ></div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="expo-logs-search"
              type="text"
              autoComplete="off"
              spellCheck="false"
              placeholder={t.expo.logs.filterPlaceholder}
              className="min-w-[12rem] flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                id="expo-logs-errors-only"
                type="checkbox"
                className="rounded border-input"
              />{" "}
              {t.expo.logs.errorsOnly}
            </label>
          </div>
          <div
            id="expo-logs-box"
            className="max-h-[55vh] overflow-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed"
          ></div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
          <a
            id="expo-logs-open"
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-xs text-muted-foreground hover:text-foreground"
          >
            {t.expo.logs.openInExpo}
          </a>
          <div className="ml-auto flex items-center gap-2">
            <button
              id="expo-logs-copy"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <i className="ti ti-copy text-base"></i> {t.expo.logs.copy}
            </button>
            <button
              id="expo-logs-ai"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <i className="ti ti-sparkles text-base"></i>{" "}
              {t.expo.logs.analyzeWithAI}
            </button>
            <button
              id="expo-logs-close"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.expo.common.close}
            </button>
          </div>
        </div>
      </dialog>

      {/** OTA update dialog */}
      <dialog
        id="dlg-expo-ota"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar title={t.expo.ota.title} closeId="expo-ota-x" />
        <div className="space-y-4 px-6 py-4">
          <p id="expo-ota-app" className="text-xs text-muted-foreground"></p>
          <div>
            <label
              htmlFor="expo-ota-branch"
              className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {t.expo.ota.branch}
            </label>
            <input
              id="expo-ota-branch"
              type="text"
              spellCheck="false"
              autoComplete="off"
              defaultValue="production"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label
              htmlFor="expo-ota-message"
              className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {t.expo.ota.message}
            </label>
            <input
              id="expo-ota-message"
              type="text"
              autoComplete="off"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="expo-ota-cancel"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t.expo.common.cancel}
          </button>
          <button
            id="expo-ota-go"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <i className="ti ti-cloud-upload text-base"></i>{" "}
            {t.expo.ota.publish}
          </button>
        </div>
      </dialog>

      {/** Create app wizard dialog */}
      <dialog
        id="dlg-expo-create"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar title={t.expo.create.title} closeId="expo-create-x" />
        <div className="space-y-4 px-6 py-4">
          <div>
            <label
              htmlFor="expo-create-name"
              className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {t.expo.create.nameLabel}
            </label>
            <input
              id="expo-create-name"
              type="text"
              spellCheck="false"
              autoComplete="off"
              placeholder={t.expo.create.namePlaceholder}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              id="expo-create-github"
              type="checkbox"
              defaultChecked
              className="mt-0.5 h-4 w-4 rounded border-input text-primary"
            />
            <span className="flex flex-col">
              <span className="font-medium">{t.expo.create.githubBackup}</span>
              <span className="text-[11px] text-muted-foreground">
                {t.expo.create.githubBackupHint}
              </span>
            </span>
          </label>
          <p className="text-[11px] text-muted-foreground">
            {t.expo.create.hint}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="expo-create-cancel"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t.expo.common.cancel}
          </button>
          <button
            id="expo-create-go"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <i className="ti ti-sparkles text-base"></i> {t.expo.create.start}
          </button>
        </div>
      </dialog>

      {/** Env variable dialog */}
      <dialog
        id="dlg-expo-env"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.expo.env.add}
          titleId="expo-env-dialog-title"
          closeId="expo-env-x"
        />
        <div className="space-y-4 px-6 py-4">
          <div>
            <label
              htmlFor="expo-env-name"
              className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {t.expo.env.name}
            </label>
            <input
              id="expo-env-name"
              type="text"
              spellCheck="false"
              autoComplete="off"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label
              htmlFor="expo-env-value"
              className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {t.expo.env.value}
            </label>
            <input
              id="expo-env-value"
              type="text"
              spellCheck="false"
              autoComplete="off"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label
              htmlFor="expo-env-visibility"
              className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {t.expo.env.visibility}
            </label>
            <select
              id="expo-env-visibility"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="plaintext">{t.expo.env.visPlaintext}</option>
              <option value="sensitive">{t.expo.env.visSensitive}</option>
              <option value="secret">{t.expo.env.visSecret}</option>
            </select>
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t.expo.env.environments}
            </span>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  className="expo-env-env-cb accent-primary"
                  defaultValue="production"
                  defaultChecked
                />{" "}
                {t.expo.env.envProduction}
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  className="expo-env-env-cb accent-primary"
                  defaultValue="preview"
                />{" "}
                {t.expo.env.envPreview}
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  className="expo-env-env-cb accent-primary"
                  defaultValue="development"
                />{" "}
                {t.expo.env.envDevelopment}
              </label>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="expo-env-cancel"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t.expo.common.cancel}
          </button>
          <button
            id="expo-env-save"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <i className="ti ti-device-floppy text-base"></i>{" "}
            {t.expo.common.save}
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
        id="expo-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["expo"]) }}
      ></script>
    </Fragment>
  );
}
