// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/backups/index.astro.
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
 * Backup Manager — /panel/backups
 */
import PanelLayout from "../module-frame";
import DataTable from "@/components/ui/DataTable";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import BackupSources from "./components_backups_BackupSources";
import ModuleDepsBanner from "./components_ModuleDepsBanner";
import ModalNavbar from "./components_ui_ModalNavbar";
import {
  buildBackupsTableColumns,
  buildBackupsTableFilters,
  buildBackupsTableQuickActions,
  buildBackupsTableRowActions,
  buildStoragesTableColumns,
  buildStoragesTableFilters,
  buildStoragesTableRowActions,
  BACKUPS_TABLE_VALUE_BADGES,
  STORAGES_TABLE_VALUE_BADGES,
} from "@/config/tables/backups-table-config";
import { getPageMessages } from "../view-context";
export default function pages_panel_backups_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["backups", "deps", "components"]);
  const dataTableI18n = t.components.dataTable;
  // Config drawer: per-table prefs (pagination + which row actions to show).
  const backupsSettingsTables = [
    {
      tableId: "backup-storages-table",
      title: t.backups.storagesSection.tableTitle,
      actions: buildStoragesTableRowActions(t.backups.table),
    },
    {
      tableId: "backups-history-table",
      title: t.backups.historySection.tableTitle,
      actions: buildBackupsTableRowActions(t.backups.table),
    },
  ];
  const backupView = Astro.url.searchParams.get("workspaceView");
  const isolatedBackupView =
    Astro.url.searchParams.get("embed") === "1" &&
    !Astro.url.searchParams.has("settingsOverlay") &&
    ["overview", "schedules", "history"].includes(backupView ?? "");
  const showBackupView = (view: string) =>
    !isolatedBackupView || backupView === view;

  return (
    <Fragment>
      <PanelLayout
        title={t.backups.pageTitle}
        activeModule="backups"
        titleInActions
      >
        {/* Configuración operativa del servidor conectado. */}
        <div slot="title-actions" className="flex min-w-0 items-center gap-2">
          <h1
            id="panel-topbar-title"
            data-panel-title
            className="shrink-0 text-base font-semibold text-foreground"
          >
            {t.backups.pageTitle}
          </h1>
          <ViewSettingsModal
            id="backups-settings-modal"
            title={t.backups.settings.title}
            description={t.backups.settings.description}
            variant="drawer"
            hideFooter={true}
          >
            <div className="flex h-full min-h-0 w-full @container">
              <nav
                aria-label={t.backups.settings.sections}
                className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52"
              >
                <button
                  type="button"
                  data-backups-settings-nav="local"
                  aria-current="page"
                  title={t.backups.configCard.tabLocal}
                  className="flex items-center justify-center gap-2.5 rounded-lg bg-primary/10 px-2.5 py-2 text-sm font-medium text-primary transition-colors duration-200 ease-out @xl:justify-start"
                >
                  <i className="ti ti-server shrink-0 text-lg" aria-hidden></i>
                  <span className="hidden truncate @xl:inline">
                    {t.backups.configCard.tabLocal}
                  </span>
                </button>
                <button
                  type="button"
                  data-backups-settings-nav="cloud"
                  title={t.backups.configCard.tabCloud}
                  className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 ease-out hover:bg-accent @xl:justify-start"
                >
                  <i className="ti ti-cloud shrink-0 text-lg" aria-hidden></i>
                  <span className="hidden truncate @xl:inline">
                    {t.backups.configCard.tabCloud}
                  </span>
                </button>
                <button
                  type="button"
                  data-backups-settings-nav="table"
                  title={t.backups.settings.tables}
                  className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 ease-out hover:bg-accent @xl:justify-start"
                >
                  <i className="ti ti-table shrink-0 text-lg" aria-hidden></i>
                  <span className="hidden truncate @xl:inline">
                    {t.backups.settings.tables}
                  </span>
                </button>
              </nav>
              <div className="min-w-0 flex-1 overflow-y-auto px-5 py-5">
                <section
                  data-backups-settings-view="local"
                  className="space-y-5"
                >
                  <div>
                    <h3 className="text-base font-semibold">
                      {t.backups.settings.localHeading}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.backups.settings.localHelp}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor="s-backup-dir"
                    >
                      {t.backups.configCard.labelLocalDir}
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        id="s-backup-dir"
                        type="text"
                        readOnly
                        placeholder={t.backups.configCard.placeholderLocalDir}
                        className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-muted/40 px-3 text-sm font-mono cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        id="s-backup-dir-browse"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
                      >
                        <i
                          className="ti ti-folder-search text-base"
                          aria-hidden
                        ></i>
                        {t.backups.configCard.btnBrowse}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.backups.settings.changeDirWarning}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor="s-backup-retention"
                    >
                      {t.backups.configCard.labelRetentionDefault}
                    </label>
                    <input
                      id="s-backup-retention"
                      type="number"
                      min="1"
                      max="365"
                      step="1"
                      className="h-10 w-full max-w-40 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t.backups.settings.retentionHelp}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 border-t border-border pt-4">
                    <button
                      id="backup-settings-save"
                      type="button"
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      {t.backups.settings.save}
                    </button>
                    <span
                      id="backup-settings-status"
                      role="status"
                      aria-live="polite"
                      className="text-xs text-muted-foreground"
                    ></span>
                  </div>
                </section>
                <section
                  data-backups-settings-view="cloud"
                  className="hidden space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">
                        {t.backups.storagesSection.tableTitle}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.backups.storagesSection.subtitle}
                      </p>
                    </div>
                    <button
                      type="button"
                      id="btn-new-storage"
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <i className="ti ti-plus text-sm" aria-hidden></i>
                      {t.backups.storagesSection.btnNew}
                    </button>
                  </div>
                  <div
                    id="backup-storage-cards"
                    className="grid gap-2 @4xl:hidden"
                  ></div>
                  <div className="hidden @4xl:block">
                    <DataTable
                      i18n={dataTableI18n}
                      tableId="backup-storages-table"
                      title={t.backups.storagesSection.tableTitle}
                      pageSizeOptions={[10, 25, 50, 100]}
                      columns={buildStoragesTableColumns(t.backups.table)}
                      data={[]}
                      filters={buildStoragesTableFilters(t.backups.table)}
                      rowActions={buildStoragesTableRowActions(t.backups.table)}
                      valueBadges={STORAGES_TABLE_VALUE_BADGES}
                    />
                  </div>
                </section>
                <section
                  data-backups-settings-view="table"
                  className="hidden flex-col gap-6"
                >
                  <div>
                    <h3 className="text-base font-semibold">
                      {t.backups.settings.tables}
                    </h3>
                  </div>
                  {backupsSettingsTables.map((tbl: any) => (
                    <Fragment>
                      <section className="space-y-3">
                        <h3 className="text-sm font-semibold">{tbl.title}</h3>
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t.components.dataTable.resultsPerPage}
                          </p>
                          <div
                            className="inline-flex overflow-hidden rounded-lg border border-border"
                            role="group"
                            data-backups-pagesize-group={tbl.tableId}
                          >
                            {[10, 25, 50, 100].map((n: any) => (
                              <Fragment>
                                <button
                                  type="button"
                                  data-backups-pagesize={String(n)}
                                  data-backups-table={tbl.tableId}
                                  className="border-r border-border px-3 py-1.5 text-sm last:border-r-0 hover:bg-accent"
                                >
                                  {n}
                                </button>
                              </Fragment>
                            ))}
                          </div>
                        </div>
                        {tbl.actions.length > 0 && (
                          <Fragment>
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t.components.tableSettings.visibleActions}
                              </p>
                              <div className="flex flex-col gap-1">
                                {tbl.actions.map((a: any) => (
                                  <Fragment>
                                    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 text-sm hover:bg-accent">
                                      <input
                                        type="checkbox"
                                        data-backups-action-toggle={a.id}
                                        data-backups-table={tbl.tableId}
                                        className="h-4 w-4"
                                        defaultChecked
                                      />
                                      <i
                                        className={`ti ${a.icon ?? "ti-dots"} text-base text-muted-foreground`}
                                        aria-hidden
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
                </section>
              </div>
            </div>
          </ViewSettingsModal>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {t.backups.settings?.overview ?? "Estado de las copias"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t.backups.header.subheading}
            </p>
          </div>
          <button
            id="btn-backup-now"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            <i className="ti ti-database-export text-base"></i>
            {t.backups.header.btnBackupNow}
          </button>
        </div>

        {/** System dependencies (tar/gzip required; mysqldump/pg_dump optional). Backend module id: "backup" */}
        <ModuleDepsBanner module="backup" t={t.deps} />

        {showBackupView("overview") && (
          <Fragment>
            <div
              id="backup-summary-panel"
              className="mb-6 grid gap-3 sm:grid-cols-3"
            >
              <div className="rounded-xl border border-border bg-card px-4 py-4">
                <p className="text-xs text-muted-foreground">
                  {t.backups.settings?.lastSuccess ?? "Última copia correcta"}
                </p>
                <p
                  id="backup-summary-last"
                  className="mt-2 text-sm font-semibold"
                >
                  —
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card px-4 py-4">
                <p className="text-xs text-muted-foreground">
                  {t.backups.settings?.localCopies ?? "Copias locales"}
                </p>
                <p
                  id="backup-summary-local"
                  className="mt-2 text-xl font-semibold"
                >
                  —
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card px-4 py-4">
                <p className="text-xs text-muted-foreground">
                  {t.backups.settings?.activeSchedules ??
                    "Programaciones activas"}
                </p>
                <p
                  id="backup-summary-schedules"
                  className="mt-2 text-xl font-semibold"
                >
                  —
                </p>
              </div>
            </div>
          </Fragment>
        )}

        {/** Progress banner (hidden) */}
        <div
          id="backup-progress"
          className="hidden mb-4 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4"
        >
          <div className="flex items-center gap-3">
            <svg
              className="h-5 w-5 animate-spin text-primary shrink-0"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="text-sm font-medium text-primary">
              {t.backups.progress.creating}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {showBackupView("schedules") && (
            <Fragment>
              <div
                id="backup-schedules-panel"
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h2 className="text-base font-semibold">
                    {t.backups.schedulesSection.title}
                  </h2>
                  <button
                    id="btn-new-schedule"
                    className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    <i className="ti ti-plus text-sm"></i>
                    {t.backups.schedulesSection.btnNew}
                  </button>
                </div>
                <div id="schedules-list" className="divide-y divide-border">
                  <div className="px-5 py-3 text-sm text-muted-foreground">
                    {t.backups.schedulesSection.loading}
                  </div>
                </div>
              </div>
            </Fragment>
          )}
          {showBackupView("history") && (
            <Fragment>
              <div id="backup-history-panel" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">
                    {t.backups.historySection.title}
                  </h2>
                  <span
                    id="backup-count"
                    className="text-xs text-muted-foreground"
                  ></span>
                </div>
                <DataTable
                  i18n={dataTableI18n}
                  tableId="backups-history-table"
                  title={t.backups.historySection.tableTitle}
                  pageSizeOptions={[10, 25, 50, 100]}
                  columns={buildBackupsTableColumns(t.backups.table)}
                  data={[]}
                  filters={buildBackupsTableFilters(t.backups.table)}
                  rowActions={buildBackupsTableRowActions(t.backups.table)}
                  quickActions={buildBackupsTableQuickActions(t.backups.table)}
                  valueBadges={BACKUPS_TABLE_VALUE_BADGES}
                />
              </div>
            </Fragment>
          )}
        </div>
      </PanelLayout>

      {/** Backup now dialog */}
      <dialog
        id="dialog-backup"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.backups.backupDialog.title}
          closeId="backup-close"
        />
        <form
          id="form-backup"
          className="flex flex-col gap-4 px-6 py-5 max-h-[80vh] overflow-y-auto"
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="backup-label">
              {t.backups.backupDialog.labelName}
            </label>
            <input
              id="backup-label"
              type="text"
              required
              placeholder={t.backups.backupDialog.placeholderName}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t.backups.backupDialog.labelStorage}
            </label>
            <select
              id="backup-storage"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
            >
              <option value="local">
                {t.backups.backupDialog.optionLocal}
              </option>
            </select>
          </div>
          <BackupSources prefix="bk" s={t.backups.backupSources} />
          <div className="flex gap-3">
            <button
              type="button"
              id="backup-cancel"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.backups.backupDialog.btnCancel}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.backups.backupDialog.btnStart}
            </button>
          </div>
        </form>
      </dialog>

      {/** Schedule dialog */}
      <dialog
        id="dialog-schedule"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.backups.scheduleDialog.title}
          titleId="schedule-dialog-title"
          closeId="sched-close"
        />
        <form
          id="form-schedule"
          className="flex flex-col gap-4 px-6 py-5 max-h-[80vh] overflow-y-auto"
        >
          <input type="hidden" id="sched-edit-id" defaultValue="" />
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="sched-label">
              {t.backups.scheduleDialog.labelName}
            </label>
            <input
              id="sched-label"
              type="text"
              required
              placeholder={t.backups.scheduleDialog.placeholderName}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="sched-freq">
                {t.backups.scheduleDialog.labelFrequency}
              </label>
              <select
                id="sched-freq"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                defaultValue="daily"
              >
                <option value="hourly">
                  {t.backups.scheduleDialog.optHourly}
                </option>
                <option value="daily">
                  {t.backups.scheduleDialog.optDaily}
                </option>
                <option value="weekly">
                  {t.backups.scheduleDialog.optWeekly}
                </option>
                <option value="monthly">
                  {t.backups.scheduleDialog.optMonthly}
                </option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="sched-storage">
                {t.backups.scheduleDialog.labelStorage}
              </label>
              <select
                id="sched-storage"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
              >
                <option value="local">
                  {t.backups.scheduleDialog.optionLocal}
                </option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div id="sched-time-wrap" className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="sched-time">
                {t.backups.scheduleDialog.labelTime}
              </label>
              <input
                id="sched-time"
                type="time"
                defaultValue="03:00"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div id="sched-weekday-wrap" className="space-y-1.5 hidden">
              <label className="text-sm font-medium" htmlFor="sched-weekday">
                {t.backups.scheduleDialog.labelWeekday}
              </label>
              <select
                id="sched-weekday"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
              >
                {t.backups.scheduleDialog.weekdays.map((d: any, i: number) => (
                  <Fragment>
                    <option value={String(i)} selected={i === 1}>
                      {d}
                    </option>
                  </Fragment>
                ))}
              </select>
            </div>
            <div id="sched-monthday-wrap" className="space-y-1.5 hidden">
              <label className="text-sm font-medium" htmlFor="sched-monthday">
                {t.backups.scheduleDialog.labelMonthday}
              </label>
              <select
                id="sched-monthday"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
              >
                {Array.from({ length: 28 }, (_, i) => (
                  <Fragment>
                    <option value={String(i + 1)}>{i + 1}</option>
                  </Fragment>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            <span>{t.backups.scheduleDialog.cronPreview}:</span>{" "}
            <code
              id="sched-cron-preview"
              className="font-mono rounded bg-muted/40 px-1.5 py-0.5"
            >
              {t.backups.scheduleDialog.cronExample}
            </code>
          </p>
          <details
            id="sched-custom-cron-wrap"
            className="text-xs text-muted-foreground"
          >
            <summary className="cursor-pointer">
              {t.backups.settings?.advancedCron ??
                "Expresión cron personalizada"}
            </summary>
            <input
              id="sched-custom-cron"
              type="text"
              placeholder="0 3 * * *"
              className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm text-foreground"
            />
          </details>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="sched-retention">
              {t.backups.scheduleDialog.labelRetention}
            </label>
            <input
              id="sched-retention"
              type="number"
              defaultValue="7"
              min="1"
              max="365"
              step="1"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
            />
            <p
              id="sched-retention-help"
              className="text-xs text-muted-foreground"
            ></p>
          </div>
          <BackupSources prefix="sch" s={t.backups.backupSources} />
          <div className="flex gap-3">
            <button
              type="button"
              id="sched-cancel"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.backups.scheduleDialog.btnCancel}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.backups.scheduleDialog.btnSave}
            </button>
          </div>
        </form>
      </dialog>

      {/** Folder picker for the local backup destination */}
      <dialog
        id="dialog-path-browser"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.backups.pathBrowserDialog.title}
          closeId="path-browser-close"
        />
        <div className="px-5 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <button
              id="path-browser-up"
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
            >
              <i className="ti ti-arrow-up"></i>{" "}
              {t.backups.pathBrowserDialog.btnUp}
            </button>
            <code
              id="path-browser-current"
              className="flex-1 truncate rounded-md bg-muted/40 px-2 py-1 text-xs"
            >
              /
            </code>
          </div>
          <div
            id="path-browser-error"
            className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          ></div>
          <ul
            id="path-browser-list"
            className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border text-sm"
          ></ul>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              id="path-browser-cancel"
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.backups.pathBrowserDialog.btnCancel}
            </button>
            <button
              type="button"
              id="path-browser-select"
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.backups.pathBrowserDialog.btnSelect}
            </button>
          </div>
        </div>
      </dialog>

      {/** Database picker (choose specific databases to back up) */}
      <dialog
        id="dialog-db-picker"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.backups.dbPickerDialog.title}
          closeId="db-picker-close"
        />
        <div className="db-picker-body flex min-h-0 flex-1 flex-col gap-2 px-5 py-3">
          <div
            id="db-picker-error"
            role="alert"
            className="hidden shrink-0 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          ></div>
          <div
            id="db-picker-list"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto text-sm"
          >
            <p className="px-1 py-2 text-xs text-muted-foreground">
              {t.backups.dbPickerDialog.loading}
            </p>
          </div>
          <div className="flex shrink-0 gap-2 border-t border-border pt-3">
            <button
              type="button"
              id="db-picker-retry"
              className="hidden rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.backups.dbPickerDialog.btnRetry ?? "Reintentar"}
            </button>
            <button
              type="button"
              id="db-picker-cancel"
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.backups.dbPickerDialog.btnCancel}
            </button>
            <button
              type="button"
              id="db-picker-select"
              disabled
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.backups.dbPickerDialog.btnSelect}
            </button>
          </div>
        </div>
      </dialog>

      {/** Cloud storage create/edit dialog */}
      <dialog
        id="dialog-storage"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.backups.storageDialog.titleNew}
          titleId="storage-title"
          closeId="storage-close"
        />
        <form
          id="form-storage"
          className="flex flex-col gap-4 px-6 py-5 max-h-[80vh] overflow-y-auto"
        >
          <input type="hidden" id="storage-id" defaultValue="" />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="storage-name">
                {t.backups.storageDialog.labelName}
              </label>
              <input
                id="storage-name"
                type="text"
                required
                placeholder={t.backups.storageDialog.placeholderName}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="storage-provider">
                {t.backups.storageDialog.labelProvider}
              </label>
              <select
                id="storage-provider"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
              >
                <option value="s3">{t.backups.storageDialog.optS3}</option>
                <option value="r2">{t.backups.storageDialog.optR2}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="storage-bucket">
                {t.backups.storageDialog.labelBucket}
              </label>
              <input
                id="storage-bucket"
                type="text"
                required
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="storage-prefix">
                {t.backups.storageDialog.labelPrefix}
              </label>
              <input
                id="storage-prefix"
                type="text"
                placeholder={t.backups.storageDialog.placeholderPrefix}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          {/** Las credenciales S3 / R2 NO se registran aquí: viven en
         Ajustes → Credenciales. El target solo define el bucket y hereda la
         credencial central del proveedor seleccionado. */}
          <a
            id="storage-central-notice"
            href="/panel/settings#cred-grid"
            className="hidden items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600"
          >
            <i className="ti ti-circle-check text-sm"></i>
            <span id="storage-central-notice-text"></span>
          </a>
          <div
            id="storage-cred-required"
            className="hidden rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs text-amber-600"
          >
            <p id="storage-cred-required-text" className="mb-2"></p>
            <a
              href="/panel/settings#cred-grid"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-background px-3 py-1.5 font-medium text-foreground hover:bg-accent"
            >
              <i className="ti ti-key text-sm"></i>
              <span id="storage-cred-required-cta"></span>
            </a>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              id="storage-cancel"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.backups.storageDialog.btnCancel}
            </button>
            <button
              type="submit"
              id="storage-save"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {t.backups.storageDialog.btnSave}
            </button>
          </div>
        </form>
      </dialog>

      <div
        id="toast"
        className="fixed bottom-4 right-4 z-50 hidden max-w-xs rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
      >
        <p id="toast-msg" className="text-sm font-medium"></p>
      </div>

      <script
        id="backups-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["backups"]) }}
      ></script>
    </Fragment>
  );
}
