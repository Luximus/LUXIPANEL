// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/databases/index.astro.
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
 * Databases Manager — /panel/databases
 *
 * General DB browser + SQL console for the connected server (MySQL/MariaDB,
 * PostgreSQL). Engines are auto-detected; nothing is configured/stored here.
 */
import PanelLayout from "../module-frame";
import InstallModal from "./components_InstallModal";
import ModuleDepsBanner from "./components_ModuleDepsBanner";
import ModalNavbar from "./components_ui_ModalNavbar";
import DataTable from "@/components/ui/DataTable";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";

import {
  buildDbStructureColumns,
  buildDbRowsRowActions,
} from "@/config/tables/databases-table-config";
import { getPageMessages } from "../view-context";
export default function pages_panel_databases_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["databases", "deps", "components"]);
  const db: any = t.databases;
  const dataTableI18n = (t.components as any).dataTable;
  const isHostingTenant =
    Astro.locals.user?.kind === "hosting" ||
    Astro.locals.user?.tenantId !== undefined;
  const owner = isHostingTenant ? Astro.locals.user?.owner || "" : "";
  const tenantDatabasePrefix = context.databasePrefix || "";

  return (
    <Fragment>
      <PanelLayout title={t.databases.pageTitle} activeModule="databases">
        <div slot="title-actions">
          <ViewSettingsModal
            id="databases-settings-modal"
            title={db.settings.title}
            description={db.settings.description}
            variant="drawer"
            hideFooter={true}
          >
            <div className="flex h-full min-h-0 w-full @container">
              <nav className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52">
                <button
                  type="button"
                  data-db-settings-nav="tabla"
                  className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 ease-out @xl:justify-start bg-primary/10 text-primary"
                >
                  <i className="ti ti-table shrink-0 text-lg"></i>
                  <span className="hidden truncate @xl:inline">
                    {db.settings.table}
                  </span>
                </button>
                {!isHostingTenant && (
                  <Fragment>
                    <button
                      type="button"
                      data-db-settings-nav="consola"
                      className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 ease-out hover:bg-accent hover:text-foreground @xl:justify-start"
                    >
                      <i className="ti ti-terminal-2 shrink-0 text-lg"></i>
                      <span className="hidden truncate @xl:inline">
                        {db.tabs.console}
                      </span>
                    </button>
                  </Fragment>
                )}
              </nav>
              <div className="min-w-0 flex-1 overflow-y-auto px-5 py-5">
                <section data-db-settings-view="tabla" className="space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {db.settings.pagination}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {db.settings.rowsPerPage}
                    </p>
                    <div className="mt-3 inline-flex overflow-hidden rounded-lg border border-border">
                      {[10, 20, 50, 100].map((n: any) => (
                        <Fragment>
                          <button
                            type="button"
                            data-db-pagesize={n}
                            className="border-r border-border px-3.5 py-1.5 text-sm last:border-r-0 hover:bg-accent"
                          >
                            {n}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {db.settings.serverPagination}
                  </p>
                  <div className="border-t border-border pt-4">
                    <h3 className="text-sm font-semibold">
                      {db.settings.relatedModules}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {!isHostingTenant && (
                        <Fragment>
                          <a
                            href="/panel/hosting"
                            className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                          >
                            {db.settings.hostingQuotas}
                          </a>
                        </Fragment>
                      )}
                      {!isHostingTenant && (
                        <Fragment>
                          <a
                            href="/panel/backups"
                            className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                          >
                            {db.settings.databaseBackups}
                          </a>
                        </Fragment>
                      )}
                      <a
                        href="/panel/files"
                        className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                      >
                        {db.settings.sqlFiles}
                      </a>
                    </div>
                  </div>
                </section>
                {!isHostingTenant && (
                  <Fragment>
                    <section
                      data-db-settings-view="consola"
                      className="hidden space-y-4"
                    >
                      <div>
                        <h3 className="text-sm font-semibold">
                          {db.tabs.console}
                        </h3>
                        <label className="mt-3 flex items-center gap-2 text-sm">
                          <input
                            id="db-cfg-allow-write"
                            type="checkbox"
                            className="h-4 w-4 rounded border-input text-primary"
                          />
                          <span>{db.settings.allowWriteDefault}</span>
                        </label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {db.settings.allowWriteHelp}
                        </p>
                      </div>
                    </section>
                  </Fragment>
                )}
              </div>
            </div>
          </ViewSettingsModal>
        </div>
        <div className="mb-5 flex flex-col gap-1">
          <h2 className="text-xl font-semibold">
            {t.databases.header.heading}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t.databases.header.subheading}
          </p>
        </div>

        {/**
      Generic deps banner (system-deps, requiresOneOf): only drives the
      "no engine installed at all" state. With ≥1 engine present the page's own
      selector + per-engine install buttons (#db-install) remain the primary
      flow and the banner stays hidden (see initDeps in the page script).
    */}
        <ModuleDepsBanner module="databases" t={t.deps} />

        {/** Engine selector (only running engines are shown) + install menu */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div id="db-engines" className="flex flex-wrap items-center gap-2">
            <div className="h-9 w-40 animate-pulse rounded-lg bg-muted"></div>
            <div className="h-9 w-40 animate-pulse rounded-lg bg-muted"></div>
          </div>
          {/** Install affordance: buttons for engines not yet running on the target. */}
          {!isHostingTenant && (
            <Fragment>
              <div
                id="db-install"
                className="flex flex-wrap items-center gap-2"
              ></div>
            </Fragment>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/** Sidebar: databases + tables */}
          <aside className="flex flex-col gap-5">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">
                  {t.databases.databases.title}
                </h3>
                <button
                  id="db-create"
                  type="button"
                  className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-accent"
                  title={db.settings.createDatabase}
                >
                  <i className="ti ti-plus"></i> {db.settings.create}
                </button>
              </div>
              <div
                id="db-databases"
                data-tenant-prefix={tenantDatabasePrefix}
                className="max-h-64 overflow-y-auto p-1.5 text-sm"
              >
                <p className="px-3 py-3 text-xs text-muted-foreground">
                  {t.databases.common.selectEngine}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">
                  {t.databases.tables.title}
                </h3>
              </div>
              <div
                id="db-tables"
                className="max-h-[22rem] overflow-y-auto p-1.5 text-sm"
              >
                <p className="px-3 py-3 text-xs text-muted-foreground">
                  {t.databases.common.selectDb}
                </p>
              </div>
            </div>
          </aside>

          {/** Main panel */}
          <section className="min-w-0 rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <div
                id="db-breadcrumb"
                className="truncate text-sm font-medium text-muted-foreground"
              >
                {t.databases.common.selectTable}
              </div>
              <div className="flex items-center gap-2">
                {/** Database-level export (visible once a database is selected). */}
                <button
                  id="db-export-btn"
                  className="hidden items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <i className="ti ti-download text-sm"></i>{" "}
                  {t.databases.actions.export}
                </button>
                {/** Insert record (visible on the Rows tab with a table selected). */}
                <button
                  id="db-add-record"
                  className="hidden items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                >
                  <i className="ti ti-plus text-sm"></i>{" "}
                  {t.databases.actions.addRecord}
                </button>
                <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs">
                  <button
                    data-tab="rows"
                    className="db-tab rounded-md px-3 py-1.5 font-medium transition-colors duration-200 ease-out"
                  >
                    {t.databases.tabs.rows}
                  </button>
                  <button
                    data-tab="structure"
                    className="db-tab rounded-md px-3 py-1.5 font-medium transition-colors duration-200 ease-out"
                  >
                    {t.databases.tabs.structure}
                  </button>
                  {!isHostingTenant && (
                    <Fragment>
                      <button
                        data-tab="console"
                        className="db-tab rounded-md px-3 py-1.5 font-medium transition-colors duration-200 ease-out"
                      >
                        {t.databases.tabs.console}
                      </button>
                    </Fragment>
                  )}
                </div>
              </div>
            </div>

            {/** Result viewport: placeholder + per-tab DataTables */}
            <div id="db-view-area" className="min-h-[20rem] p-4">
              {/** Empty state (no table selected) */}
              <div
                id="db-empty"
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                {t.databases.common.selectTable}
              </div>

              {/** Rows tab: dynamic columns + server-side (external) pagination */}
              <div id="db-rows-wrap" className="hidden">
                <DataTable
                  scopedPreferences={true}
                  i18n={dataTableI18n}
                  tableId="db-rows-table"
                  title={t.databases.tabs.rows}
                  columns={[]}
                  data={[]}
                  rowActions={buildDbRowsRowActions(db)}
                  selectable={false}
                  externalPagination={true}
                  serverQuery={true}
                />
              </div>

              {/** Structure tab: fixed columns */}
              <div id="db-structure-wrap" className="hidden">
                <DataTable
                  scopedPreferences={true}
                  i18n={dataTableI18n}
                  tableId="db-structure-table"
                  title={t.databases.tabs.structure}
                  columns={buildDbStructureColumns(db)}
                  data={[]}
                  selectable={false}
                />
              </div>
            </div>

            {/** SQL console (console tab) */}
            <div
              id="db-console"
              className="hidden flex-col gap-3 p-4"
              aria-hidden={isHostingTenant ? "true" : undefined}
            >
              <textarea
                id="sql-input"
                rows={5}
                spellCheck="false"
                placeholder={t.databases.console.placeholder}
                className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              ></textarea>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  id="sql-run"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
                >
                  <i className="ti ti-player-play text-base"></i>{" "}
                  {t.databases.console.run}
                </button>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    id="sql-allow-write"
                    type="checkbox"
                    className="h-4 w-4 rounded border-input text-primary"
                  />
                  <span>{t.databases.console.allowWrite}</span>
                </label>
                <span className="text-xs text-muted-foreground">
                  {t.databases.console.hint}
                </span>
              </div>
              <div id="db-console-meta"></div>
              <div id="db-console-wrap" className="hidden">
                <DataTable
                  scopedPreferences={true}
                  i18n={dataTableI18n}
                  tableId="db-console-table"
                  title={t.databases.tabs.console}
                  columns={[]}
                  data={[]}
                  selectable={false}
                />
              </div>
            </div>
          </section>
        </div>
      </PanelLayout>

      {/** Record editor (insert / edit) */}
      <dialog
        id="dlg-db-record"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.databases.titles.record}
          titleId="db-record-title"
          closeId="db-record-x"
        />
        <div
          id="db-record-fields"
          className="max-h-[60vh] overflow-y-auto px-6 py-4"
        ></div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="db-record-cancel"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t.databases.actions.cancel}
          </button>
          <button
            id="db-record-save"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <i className="ti ti-device-floppy text-base"></i>{" "}
            {t.databases.actions.save}
          </button>
        </div>
      </dialog>

      {/** Export database */}
      <dialog
        id="dlg-db-export"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.databases.titles.exportDb}
          closeId="db-export-x"
        />
        <div className="px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">
              {t.databases.labels.tablesLabel}
            </span>
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input
                id="db-export-all"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-input text-primary"
              />{" "}
              {t.databases.labels.allTables}
            </label>
          </div>
          <div
            id="db-export-tables"
            className="mb-4 max-h-56 overflow-y-auto rounded-lg border border-border p-2 text-sm"
          ></div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              id="db-export-data"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-input text-primary"
            />
            <span>{t.databases.labels.includeData}</span>
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="db-export-cancel"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t.databases.actions.cancel}
          </button>
          <button
            id="db-export-go"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <i className="ti ti-download text-base"></i>{" "}
            {t.databases.actions.downloadSql}
          </button>
        </div>
      </dialog>

      <InstallModal
        id="databases"
        title={t.databases.install.title}
        description={t.databases.install.description}
      />

      <div
        id="toast"
        className="fixed bottom-4 right-4 z-50 hidden max-w-xs rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
      >
        <p id="toast-msg" className="text-sm font-medium"></p>
      </div>

      <script
        id="databases-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["databases"]) }}
      ></script>
    </Fragment>
  );
}
