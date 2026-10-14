// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/monitor/index.astro.
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
 * Monitor page — /panel/monitor
 * Real-time system metrics via SSE + historical charts.
 */
import PanelLayout from "../module-frame";
import { ModuleHeaderStatus } from "../ModuleHeaderStatus";
import DataTable from "@/components/ui/DataTable";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import ModalNavbar from "./components_ui_ModalNavbar";
import {
  PROCESSES_TABLE_ID,
  processTableColumns,
  processTableFilters,
  processTableRowActions,
} from "@/config/tables/processes-table-config";
import { getPageMessages } from "../view-context";
import { NO_CACHE_HEADER } from "@/lib/http-cache";
export default function pages_panel_monitor_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["monitor", "components"]);
  const dataTableI18n = t.components.dataTable;
  const processTableStrings = t.monitor.processes.table;
  const ms = t.monitor.settingsUi;
  // Prevent stale HTML — the inline script reference rotates with each deploy.
  Astro.response.headers.set("Cache-Control", NO_CACHE_HEADER);
  Astro.response.headers.set("Pragma", "no-cache");
  const user = Astro.locals.user;
  const userKind = user?.kind ?? "user";
  const userName = user?.username ?? "";

  return (
    <Fragment>
      <PanelLayout title={t.monitor.pageTitle} activeModule="monitor">
        {/* Configuración del módulo (drawer derecho + menú lateral, como Correo/Cron/Files). */}
        <div slot="title-actions">
          <ViewSettingsModal
            id="monitor-settings-modal"
            title={ms.title}
            description={ms.description}
            variant="drawer"
            hideFooter={true}
          >
            <div className="flex h-full min-h-0 w-full @container">
              <nav
                className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52"
                role="tablist"
                aria-label={ms.sectionsLabel}
              >
                {[
                  {
                    id: "table",
                    label: ms.view,
                    icon: "ti-adjustments-horizontal",
                  },
                  {
                    id: "history",
                    label: t.monitor.history.title,
                    icon: "ti-chart-line",
                  },
                  { id: "alerts", label: ms.alerts, icon: "ti-bell" },
                  {
                    id: "watchdog",
                    label: ms.restart,
                    icon: "ti-refresh-alert",
                  },
                  {
                    id: "diagnostics",
                    label: ms.diagnostics,
                    icon: "ti-activity-heartbeat",
                  },
                ].map((item: any, index: number) => (
                  <Fragment>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={index === 0 ? "true" : "false"}
                      aria-controls={`monitor-settings-${item.id}`}
                      data-monitor-settings-nav={item.id}
                      title={item.label}
                      className={classList([
                        "flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 ease-out @xl:justify-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        index === 0
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      ])}
                    >
                      <i
                        className={`ti ${item.icon} shrink-0 text-lg`}
                        aria-hidden
                      ></i>
                      <span className="hidden truncate @xl:inline">
                        {item.label}
                      </span>
                    </button>
                  </Fragment>
                ))}
              </nav>
              <div className="min-w-0 flex-1 overflow-y-auto px-5 py-5">
                <section
                  id="monitor-settings-table"
                  data-monitor-settings-panel="table"
                  role="tabpanel"
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-base font-semibold">
                      {ms.viewProcesses}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ms.refreshSavedHint}
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    <h3 className="text-sm font-semibold">
                      {t.components.tableSettings.pagination}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {ms.processRowsPerPage}
                    </p>
                    <div
                      className="flex flex-wrap gap-1.5"
                      data-monitor-pagesize-group
                    >
                      {[10, 25, 50, 100].map((n: any) => (
                        <Fragment>
                          <button
                            type="button"
                            data-monitor-pagesize={String(n)}
                            className="h-9 min-w-11 rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
                          >
                            {n}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <h3 className="text-sm font-semibold">
                      {t.components.tableSettings.visibleActions}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t.components.tableSettings.actionsHint}
                    </p>
                    <label className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        data-monitor-action-toggle="kill"
                        className="h-4 w-4 rounded border-border"
                        defaultChecked
                      />
                      <i
                        className="ti ti-trash text-base text-muted-foreground"
                        aria-hidden
                      ></i>
                      <span>{processTableStrings.actionKill}</span>
                    </label>
                  </div>
                  <div className="space-y-2.5 border-t border-border pt-5">
                    <label
                      htmlFor="monitor-process-refresh"
                      className="text-sm font-semibold"
                    >
                      {ms.refreshLiveProcesses}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {ms.historyRefreshHint}
                    </p>
                    <select
                      id="monitor-process-refresh"
                      data-monitor-pref="processesRefreshSeconds"
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="0">{ms.paused}</option>
                      <option value="15">{ms.every15s}</option>
                      <option value="30">{ms.every30s}</option>
                      <option value="60">{ms.everyMinute}</option>
                    </select>
                  </div>
                </section>
                <section
                  id="monitor-settings-history"
                  data-monitor-settings-panel="history"
                  role="tabpanel"
                  className="hidden space-y-6"
                >
                  <div>
                    <h3 className="text-base font-semibold">
                      {t.monitor.history.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ms.historySettingsHint}
                    </p>
                  </div>
                  <div className="grid gap-4 @lg:grid-cols-2">
                    <label className="space-y-2 text-sm font-medium">
                      {ms.initialRange}
                      <select
                        data-monitor-pref="range"
                        className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      >
                        <option value="1h">{ms.oneHour}</option>
                        <option value="6h">{ms.sixHours}</option>
                        <option value="24h">{ms.twentyFourHours}</option>
                        <option value="7d">{ms.sevenDays}</option>
                      </select>
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      {ms.initialMetric}
                      <select
                        data-monitor-pref="metric"
                        className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      >
                        <option value="all">{ms.allResources}</option>
                        <option value="cpu">{t.monitor.stats.cpu}</option>
                        <option value="ram">{t.monitor.stats.ram}</option>
                        <option value="disk">{t.monitor.stats.disk}</option>
                        <option value="network">
                          {t.monitor.stats.network}
                        </option>
                      </select>
                    </label>
                  </div>
                  <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 text-sm">
                    <input
                      type="checkbox"
                      data-monitor-pref="compare"
                      className="h-4 w-4 accent-primary"
                    />
                    <span>{t.monitor.history.compareTitle}</span>
                  </label>
                  <label className="block space-y-2 text-sm font-medium">
                    {ms.refreshChart}
                    <select
                      data-monitor-pref="historyRefreshSeconds"
                      className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="0">{ms.paused}</option>
                      <option value="30">{ms.every30s}</option>
                      <option value="60">{ms.everyMinute}</option>
                      <option value="120">{ms.every2Minutes}</option>
                    </select>
                  </label>
                  <div className="border-t border-border pt-5">
                    <button
                      id="monitor-export-history"
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      <i className="ti ti-download" aria-hidden></i>
                      {ms.exportCsv}
                    </button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {ms.exportHint}
                    </p>
                    <p
                      id="monitor-history-export-status"
                      role="status"
                      className="mt-2 text-xs text-muted-foreground"
                    ></p>
                  </div>
                </section>
                <section
                  id="monitor-settings-alerts"
                  data-monitor-settings-panel="alerts"
                  role="tabpanel"
                  className="hidden space-y-5"
                >
                  <div>
                    <h3 className="text-base font-semibold">
                      {t.monitor.alertRules.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ms.alertRulesHint}
                    </p>
                  </div>
                  <form
                    id="monitor-alert-form"
                    className="space-y-3 rounded-xl border border-border bg-muted/10 p-4"
                  >
                    <input
                      id="monitor-alert-id"
                      type="hidden"
                      defaultValue=""
                    />
                    <label className="block space-y-1 text-xs font-medium">
                      {t.monitor.alertDialog.nameLabel}
                      <input
                        id="monitor-alert-name"
                        required
                        minLength={2}
                        maxLength={128}
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                        placeholder={t.monitor.alertDialog.namePlaceholder}
                      />
                    </label>
                    <div className="grid gap-3 @lg:grid-cols-2">
                      <label className="block space-y-1 text-xs font-medium">
                        {t.monitor.alertDialog.metricLabel}
                        <select
                          id="monitor-alert-metric"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                        >
                          <option value="cpu_usage_percent">
                            {t.monitor.charts.labelCpu}
                          </option>
                          <option value="memory_usage_percent">
                            {t.monitor.charts.labelRam}
                          </option>
                          <option value="disk_usage_percent">
                            {t.monitor.charts.labelDisk}
                          </option>
                          <option value="load_avg_1m">{ms.load1m}</option>
                          <option value="load_avg_5m">{ms.load5m}</option>
                          <option value="rx_bytes_per_sec">
                            {ms.networkReceived}
                          </option>
                          <option value="tx_bytes_per_sec">
                            {ms.networkSent}
                          </option>
                        </select>
                      </label>
                      <label className="block space-y-1 text-xs font-medium">
                        {ms.condition}
                        <select
                          id="monitor-alert-operator"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                        >
                          <option value="gt">{ms.greaterThan}</option>
                          <option value="gte">{ms.greaterOrEqual}</option>
                          <option value="lt">{ms.lessThan}</option>
                          <option value="lte">{ms.lessOrEqual}</option>
                        </select>
                      </label>
                      <label className="block space-y-1 text-xs font-medium">
                        {t.monitor.alertDialog.thresholdLabel}
                        <input
                          id="monitor-alert-threshold"
                          required
                          type="number"
                          step="any"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                        />
                      </label>
                      <label className="block space-y-1 text-xs font-medium">
                        {t.monitor.alertDialog.sustainedLabel}
                        <input
                          id="monitor-alert-samples"
                          required
                          type="number"
                          min="1"
                          max="60"
                          defaultValue="3"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        id="monitor-alert-submit"
                        type="submit"
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                      >
                        {t.monitor.alertDialog.submitButton}
                      </button>
                      <button
                        id="monitor-alert-cancel"
                        type="button"
                        className="hidden rounded-lg border border-border px-4 py-2 text-sm"
                      >
                        {ms.cancelEdit}
                      </button>
                    </div>
                  </form>
                  <p
                    id="monitor-alert-status"
                    role="status"
                    className="text-xs text-muted-foreground"
                  ></p>
                  <div id="monitor-alert-rules" className="space-y-2"></div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                    {ms.alertDestinationsHint}
                    <a
                      href="/panel/webhooks"
                      className="ml-1 font-medium text-primary hover:underline"
                    >
                      {ms.configureWebhooks}
                    </a>
                    .
                  </div>
                  <div className="border-t border-border pt-4">
                    <h4 className="text-sm font-semibold">{ms.recentEvents}</h4>
                    <div
                      id="monitor-alert-events"
                      className="mt-2 space-y-1 text-xs text-muted-foreground"
                    ></div>
                  </div>
                </section>
                <section
                  id="monitor-settings-watchdog"
                  data-monitor-settings-panel="watchdog"
                  role="tabpanel"
                  className="hidden space-y-5"
                >
                  <div>
                    <h3 className="text-base font-semibold">
                      {ms.restartProtection}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ms.restartProtectionHint}
                    </p>
                  </div>
                  <label className="block space-y-1 text-sm font-medium">
                    {ms.checkEvery}
                    <input
                      id="wd-interval"
                      type="number"
                      min="5"
                      max="300"
                      step="1"
                      className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    />
                    <span className="block text-xs font-normal text-muted-foreground">
                      {ms.checkEveryHint}
                    </span>
                  </label>
                  <label className="block space-y-1 text-sm font-medium">
                    {ms.waitAfterBoot}
                    <input
                      id="wd-grace"
                      type="number"
                      min="2"
                      max="120"
                      step="1"
                      className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    />
                    <span className="block text-xs font-normal text-muted-foreground">
                      {ms.waitAfterBootHint}
                    </span>
                  </label>
                  <label className="block space-y-1 text-sm font-medium">
                    {ms.minBetweenRestarts}
                    <input
                      id="wd-cooldown"
                      type="number"
                      min="5"
                      max="1440"
                      step="1"
                      className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    />
                    <span className="block text-xs font-normal text-muted-foreground">
                      {ms.minBetweenRestartsHint}
                    </span>
                  </label>
                  <button
                    id="wd-settings-save"
                    type="button"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {ms.saveProtection}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {ms.saveProtectionHint}
                  </p>
                </section>
                <section
                  id="monitor-settings-diagnostics"
                  data-monitor-settings-panel="diagnostics"
                  role="tabpanel"
                  className="hidden space-y-5"
                >
                  <div>
                    <h3 className="text-base font-semibold">
                      {ms.collectionDiagnostics}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ms.collectionDiagnosticsHint}
                    </p>
                  </div>
                  <dl className="divide-y divide-border rounded-xl border border-border text-sm">
                    <div className="flex justify-between gap-4 px-4 py-3">
                      <dt>{ms.lastMetric}</dt>
                      <dd
                        id="monitor-diag-snapshot"
                        className="text-right tabular-nums text-muted-foreground"
                      >
                        —
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 px-4 py-3">
                      <dt>{ms.lastProcessTable}</dt>
                      <dd
                        id="monitor-diag-processes"
                        className="text-right tabular-nums text-muted-foreground"
                      >
                        —
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 px-4 py-3">
                      <dt>{ms.samplesLastHour}</dt>
                      <dd
                        id="monitor-diag-samples"
                        className="text-right tabular-nums text-muted-foreground"
                      >
                        —
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 px-4 py-3">
                      <dt>{ms.coverageLastHour}</dt>
                      <dd
                        id="monitor-diag-coverage"
                        className="text-right tabular-nums text-muted-foreground"
                      >
                        —
                      </dd>
                    </div>
                  </dl>
                  <p
                    id="monitor-diag-status"
                    role="status"
                    className="text-xs text-muted-foreground"
                  ></p>
                  <button
                    id="monitor-diag-refresh"
                    type="button"
                    className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                  >
                    <i className="ti ti-refresh mr-1" aria-hidden></i>
                    {ms.checkNow}
                  </button>
                </section>
              </div>
            </div>
          </ViewSettingsModal>
        </div>

        {/** Session context for the page script (kill-button gating). */}
        <div
          id="monitor-session"
          data-user-kind={userKind}
          data-user-name={userName}
          className="hidden"
        ></div>

        <ModuleHeaderStatus>
          <div
            id="monitor-health"
            title={t.monitor.header.healthLabel}
            aria-label={t.monitor.header.healthLabel}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-xs font-medium text-emerald-500"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span id="monitor-health-label">
              {t.monitor.header.healthLabel}
            </span>
          </div>
        </ModuleHeaderStatus>

        {/** Live server overview */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <section
            className="rounded-xl border border-border bg-card p-5"
            aria-labelledby="resources-title"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="resources-title" className="text-sm font-semibold">
                {t.monitor.stats.resources}
              </h2>
              <i
                className="ti ti-activity-heartbeat text-xl text-emerald-500"
                aria-hidden="true"
              ></i>
            </div>
            <div className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t.monitor.labels.cpu}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <strong className="text-lg tabular-nums">
                      <span id="stat-cpu">—</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        %
                      </span>
                    </strong>
                    <button
                      type="button"
                      data-ai-optimize="cpu"
                      aria-label={t.monitor.actions.optimizeCpu}
                      title={t.monitor.actions.optimizeCpu}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-emerald-500 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <i className="ti ti-sparkles" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    id="bar-cpu"
                    className="h-full rounded-full bg-amber-500 transition-all duration-500"
                    style={cssStyle("width:0%")}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t.monitor.stats.memoryRam}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <strong className="text-lg tabular-nums">
                      <span id="stat-mem">—</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        %
                      </span>
                    </strong>
                    <button
                      type="button"
                      data-ai-optimize="ram"
                      aria-label={t.monitor.actions.optimizeRam}
                      title={t.monitor.actions.optimizeRam}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-emerald-500 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <i className="ti ti-sparkles" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    id="bar-mem"
                    className="h-full rounded-full bg-purple-500 transition-all duration-500"
                    style={cssStyle("width:0%")}
                  ></div>
                </div>
                <p
                  id="mem-detail"
                  className="mt-1 text-[11px] tabular-nums text-muted-foreground"
                >
                  — / — MB
                </p>
              </div>
              <div className="border-t border-border pt-3">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {t.monitor.stats.network}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
                  <span className="min-w-0 truncate">
                    <i
                      className="ti ti-arrow-down mr-1 text-emerald-500"
                      aria-hidden="true"
                    ></i>
                    {t.monitor.labels.rx} <strong id="stat-rx">—</strong>
                  </span>
                  <span className="min-w-0 truncate">
                    <i
                      className="ti ti-arrow-up mr-1 text-amber-500"
                      aria-hidden="true"
                    ></i>
                    {t.monitor.labels.tx} <strong id="stat-tx">—</strong>
                  </span>
                </div>
              </div>
            </div>
            <p
              id="sse-status"
              className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-muted animate-pulse"></span>
              {t.monitor.stats.connecting}
            </p>
          </section>

          <section
            className="rounded-xl border border-border bg-card p-5"
            aria-labelledby="disk-title"
          >
            <div className="flex items-center justify-between">
              <h2 id="disk-title" className="text-sm font-semibold">
                {t.monitor.stats.disk}
              </h2>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                <i className="ti ti-database text-lg" aria-hidden="true"></i>
              </div>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <p id="stat-disk" className="text-3xl font-bold tracking-tight">
                —
              </p>
              <p className="mb-0.5 text-sm text-muted-foreground">%</p>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                id="bar-disk"
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={cssStyle("width:0%")}
              ></div>
            </div>
            <p id="disk-detail" className="mt-1 text-xs text-muted-foreground">
              — / — GB
            </p>
            <div className="mt-3 border-t border-border pt-2">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t.monitor.stats.topFolders}
              </p>
              <div id="monitor-top-folders" className="space-y-1.5">
                {Array.from({ length: 3 }).map(() => (
                  <Fragment>
                    <div className="h-4 animate-pulse rounded bg-muted"></div>
                  </Fragment>
                ))}
              </div>
            </div>
            <button
              type="button"
              data-ai-optimize="disk"
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <i
                className="ti ti-sparkles text-sm text-emerald-500"
                aria-hidden="true"
              ></i>
              {t.monitor.actions.optimizeDisk}
            </button>
          </section>

          <section
            className="rounded-xl border border-border bg-card p-5"
            aria-labelledby="activity-title"
          >
            <div className="flex items-center justify-between">
              <h2 id="activity-title" className="text-sm font-semibold">
                {t.monitor.stats.serverActivity}
              </h2>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500">
                <i
                  className="ti ti-clock-hour-4 text-lg"
                  aria-hidden="true"
                ></i>
              </div>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              {t.monitor.stats.uptime}
            </p>
            <p
              id="stat-uptime"
              className="mt-1 text-2xl font-semibold tabular-nums tracking-tight"
            >
              —
            </p>
            <div className="mt-5 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                {t.monitor.stats.loadAvg}
              </p>
              <p
                id="load-avg"
                className="mt-1 font-mono text-base font-semibold tabular-nums tracking-tight"
              >
                —
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                1 / 5 / 15 min
              </p>
            </div>
          </section>

          <section
            className="rounded-xl border border-border bg-card p-5"
            aria-labelledby="hotspots-title"
          >
            <div className="flex items-center justify-between">
              <h2 id="hotspots-title" className="text-sm font-semibold">
                {t.monitor.stats.topActive}
              </h2>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <i
                  className="ti ti-list-details text-lg"
                  aria-hidden="true"
                ></i>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-amber-500/5 px-3 py-2.5">
                <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  {t.monitor.stats.topCpu}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                  <span
                    id="top-proc-cpu"
                    className="min-w-0 truncate font-mono"
                  >
                    —
                  </span>
                  <strong
                    id="top-proc-cpu-value"
                    className="shrink-0 tabular-nums"
                  >
                    —
                  </strong>
                </div>
              </div>
              <div className="rounded-lg bg-purple-500/5 px-3 py-2.5">
                <p className="text-[11px] font-medium text-purple-600 dark:text-purple-400">
                  {t.monitor.stats.topRam}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                  <span
                    id="top-proc-ram"
                    className="min-w-0 truncate font-mono"
                  >
                    —
                  </span>
                  <strong
                    id="top-proc-ram-value"
                    className="shrink-0 tabular-nums"
                  >
                    —
                  </strong>
                </div>
              </div>
            </div>
            <button
              type="button"
              data-monitor-open-processes
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t.monitor.stats.viewProcesses}
              <i className="ti ti-arrow-right" aria-hidden="true"></i>
            </button>
          </section>
        </div>

        {/** Monitor history and processes share one workspace. */}
        <section
          id="monitor-workspace"
          className="mb-6 overflow-hidden rounded-xl border border-border bg-card"
        >
          <div
            className="flex gap-1 border-b border-border px-5 pt-3"
            role="tablist"
            aria-label={t.monitor.history.workspaceLabel}
          >
            <button
              id="monitor-tab-history"
              type="button"
              role="tab"
              aria-selected="true"
              aria-controls="monitor-panel-history"
              tabIndex={0}
              className="border-b-2 border-primary px-4 py-2.5 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <i className="ti ti-chart-line mr-1.5" aria-hidden="true"></i>
              {t.monitor.history.title}
            </button>
            <button
              id="monitor-tab-processes"
              type="button"
              role="tab"
              aria-selected="false"
              aria-controls="monitor-panel-processes"
              tabIndex={-1}
              className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <i className="ti ti-list-details mr-1.5" aria-hidden="true"></i>
              {t.monitor.processes.title}
            </button>
          </div>
          <div
            id="monitor-panel-history"
            role="tabpanel"
            aria-labelledby="monitor-tab-history"
          >
            {/** Historical range selector + line chart */}
            <div>
              <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {t.monitor.history.rangeLabel}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    id="cmp-toggle"
                    type="button"
                    aria-pressed="false"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                    title={t.monitor.history.compareTitle}
                  >
                    <i className="ti ti-arrows-diff text-sm"></i>
                    {t.monitor.history.compareButton}
                  </button>
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="group"
                    aria-label={t.monitor.history.rangeLabel}
                  >
                    {(
                      [
                        { code: "1h", label: t.monitor.history.ranges["1h"] },
                        { code: "6h", label: t.monitor.history.ranges["6h"] },
                        { code: "24h", label: t.monitor.history.ranges["24h"] },
                        { code: "7d", label: t.monitor.history.ranges["7d"] },
                      ] as const
                    ).map((r: any) => (
                      <Fragment>
                        <button
                          type="button"
                          className={classList([
                            "range-btn rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                            r.code === "1h"
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-accent",
                          ])}
                          data-range={r.code}
                          aria-pressed={r.code === "1h" ? "true" : "false"}
                        >
                          {r.label}
                        </button>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-5 pt-4">
                <div
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-label={t.monitor.history.metricLabel}
                >
                  <span className="mr-1 text-xs font-medium text-muted-foreground">
                    {t.monitor.history.metricLabel}
                  </span>
                  {(
                    [
                      {
                        code: "all",
                        label: t.monitor.history.metrics.all,
                        dot: "bg-foreground",
                      },
                      {
                        code: "cpu",
                        label: t.monitor.labels.cpu,
                        dot: "bg-amber-500",
                      },
                      {
                        code: "ram",
                        label: t.monitor.labels.ram,
                        dot: "bg-purple-500",
                      },
                      {
                        code: "disk",
                        label: t.monitor.stats.disk,
                        dot: "bg-sky-500",
                      },
                      {
                        code: "network",
                        label: t.monitor.stats.network,
                        dot: "bg-emerald-500",
                      },
                    ] as const
                  ).map((metric: any) => (
                    <Fragment>
                      <button
                        type="button"
                        data-history-metric={metric.code}
                        aria-pressed={metric.code === "all" ? "true" : "false"}
                        className={classList([
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          metric.code === "all"
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                        ])}
                      >
                        <span
                          className={classList([
                            "h-2 w-2 rounded-full",
                            metric.dot,
                          ])}
                          aria-hidden="true"
                        ></span>
                        {metric.label}
                      </button>
                    </Fragment>
                  ))}
                </div>
                <p
                  id="history-status"
                  className="mt-3 min-h-5 text-xs text-muted-foreground"
                  role="status"
                  aria-live="polite"
                ></p>
                <div
                  id="history-coverage"
                  className="mt-2"
                  aria-label={t.monitor.history.coverageLabel}
                ></div>
                <div
                  id="history-summary"
                  className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
                ></div>
              </div>
              <div className="px-3 pb-5 pt-3 sm:px-5">
                <div className="relative h-80 w-full sm:h-96">
                  <canvas id="chart-history"></canvas>
                  <div
                    id="history-overlay"
                    className="absolute inset-0 hidden items-center justify-center rounded-lg bg-card/95 px-4 text-center text-sm text-muted-foreground"
                    role="status"
                  ></div>
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  <i className="ti ti-info-circle"></i>
                  {t.monitor.history.peakHint}
                </p>
                <div
                  id="peak-info"
                  className="mt-4 hidden rounded-lg border border-border bg-muted/30 px-4 py-3"
                ></div>
              </div>
            </div>

            {/** Breakdown charts */}
            <div className="grid gap-4 px-5 pb-5 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-5 py-3">
                  <h3 className="text-sm font-semibold">
                    {t.monitor.breakdown.memory}
                  </h3>
                </div>
                <div className="p-4">
                  <div className="relative h-56 w-full">
                    <canvas id="chart-mem"></canvas>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-5 py-3">
                  <h3 className="text-sm font-semibold">
                    {t.monitor.breakdown.disk}
                  </h3>
                </div>
                <div className="p-4">
                  <div className="relative h-56 w-full">
                    <canvas id="chart-disk"></canvas>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <h3 className="text-sm font-semibold">
                    {t.monitor.breakdown.topProcesses}
                  </h3>
                  <div className="flex rounded-lg border border-border p-0.5 text-xs font-medium">
                    <button
                      data-polar-metric="cpu"
                      className="rounded-md px-3 py-1 transition-colors bg-primary text-primary-foreground"
                    >
                      {t.monitor.labels.cpu}
                    </button>
                    <button
                      data-polar-metric="mem"
                      className="rounded-md px-3 py-1 transition-colors text-muted-foreground hover:bg-accent"
                    >
                      {t.monitor.labels.ram}
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="relative h-56 w-full">
                    <canvas id="chart-procs"></canvas>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-5 py-3">
                  <h3 className="text-sm font-semibold">
                    {t.monitor.breakdown.network}
                  </h3>
                </div>
                <div className="p-4">
                  <div className="relative h-56 w-full">
                    <canvas id="chart-net"></canvas>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            id="monitor-panel-processes"
            role="tabpanel"
            aria-labelledby="monitor-tab-processes"
            className="hidden"
          >
            {/** Process list */}
            <div className="p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">
                    {t.monitor.processes.tableTitle}
                  </h2>
                  <p
                    id="proc-updated"
                    className="text-xs text-muted-foreground"
                  >
                    {t.monitor.processes.updatedMomentAgo}
                  </p>
                </div>
                <div
                  id="proc-live-controls"
                  className="flex items-center gap-3"
                >
                  <div className="flex rounded-lg border border-border p-0.5 text-xs font-medium">
                    <button
                      id="proc-sort-cpu"
                      className="rounded-md px-3 py-1 transition-colors bg-primary text-primary-foreground"
                    >
                      {t.monitor.labels.cpu}
                    </button>
                    <button
                      id="proc-sort-mem"
                      className="rounded-md px-3 py-1 transition-colors text-muted-foreground hover:bg-accent"
                    >
                      {t.monitor.labels.ram}
                    </button>
                  </div>
                  <button
                    id="btn-refresh-procs"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors"
                    title={t.monitor.processes.refreshTitle}
                  >
                    <i className="ti ti-refresh text-sm"></i>
                  </button>
                </div>
              </div>
              <div className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:items-center">
                <button
                  id="proc-mode-live"
                  type="button"
                  aria-pressed="true"
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                >
                  <i className="ti ti-activity mr-1" aria-hidden="true"></i>
                  {t.monitor.processes.liveMode}
                </button>
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="proc-history-select"
                >
                  {t.monitor.processes.historyMode}
                </label>
                <select
                  id="proc-history-select"
                  className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  disabled
                >
                  <option value="">{t.monitor.processes.selectInterval}</option>
                </select>
                <p
                  id="proc-history-status"
                  className="text-xs text-muted-foreground"
                  role="status"
                  aria-live="polite"
                ></p>
              </div>
              <p
                id="proc-history-note"
                className="mb-3 hidden text-xs text-muted-foreground"
              >
                {t.monitor.processes.historyNote}
              </p>
              <DataTable
                i18n={dataTableI18n}
                tableId={PROCESSES_TABLE_ID}
                title={t.monitor.processes.tableTitle}
                columns={processTableColumns(processTableStrings)}
                data={[]}
                filters={processTableFilters(processTableStrings)}
                rowActions={processTableRowActions(processTableStrings)}
              />
            </div>
          </div>
        </section>

        {/** Service status + Automatic restart (one row, equal height) */}
        <div className="mb-6 grid items-stretch gap-6 lg:grid-cols-2">
          {/** Services */}
          <div className="flex flex-col rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">
                {t.monitor.services.title}
              </h2>
            </div>
            <div
              id="services-list"
              className="flex-1 divide-y divide-border px-1 py-1"
            >
              {Array.from({ length: 5 }).map(() => (
                <Fragment>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted"></div>
                    <div className="h-5 w-16 animate-pulse rounded-full bg-muted"></div>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>

          {/** Resource watchdog (auto-reboot) */}
          <div
            id="watchdog-card"
            className="flex flex-col rounded-xl border border-border bg-card"
            data-badge-active={t.monitor.watchdog.badgeActive}
            data-badge-inactive={t.monitor.watchdog.badgeInactive}
            data-last-prefix={t.monitor.watchdog.lastTriggered}
            data-never={t.monitor.watchdog.neverTriggered}
            data-saved={t.monitor.watchdog.savedToast}
            data-error={t.monitor.watchdog.errorToast}
            data-load-error={t.monitor.watchdog.loadError}
            data-confirm-title={t.monitor.watchdog.confirmTitle}
            data-confirm-body={t.monitor.watchdog.confirmBody}
            data-confirm-ok={t.monitor.watchdog.confirmOk}
            data-threshold-required={t.monitor.watchdog.thresholdHint}
            data-limits-error={t.monitor.watchdog.limitsError}
          >
            <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="inline-flex items-center gap-2 text-base font-semibold">
                  <i className="ti ti-refresh-alert text-amber-500"></i>
                  {t.monitor.watchdog.title}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t.monitor.watchdog.subtitle}
                </p>
              </div>
              <span
                id="wd-badge"
                className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground"></span>
                —
              </span>
            </div>
            <div className="grid flex-1 content-start gap-4 px-5 py-4 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <input
                  id="wd-enabled"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm font-medium">
                  {t.monitor.watchdog.enableLabel}
                </span>
              </label>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="wd-cpu">
                  {t.monitor.watchdog.cpuLabel}
                </label>
                <input
                  id="wd-cpu"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="—"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-muted-foreground">
                  {t.monitor.watchdog.thresholdHint}
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="wd-mem">
                  {t.monitor.watchdog.memLabel}
                </label>
                <input
                  id="wd-mem"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="—"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-muted-foreground">
                  {t.monitor.watchdog.thresholdHint}
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="wd-sustained">
                  {t.monitor.watchdog.sustainedLabel}
                </label>
                <select
                  id="wd-sustained"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                  defaultValue="120"
                >
                  <option value="60">
                    {t.monitor.watchdog.sustainedOptions.min1}
                  </option>
                  <option value="120">
                    {t.monitor.watchdog.sustainedOptions.min2}
                  </option>
                  <option value="300">
                    {t.monitor.watchdog.sustainedOptions.min5}
                  </option>
                  <option value="600">
                    {t.monitor.watchdog.sustainedOptions.min10}
                  </option>
                  <option value="1800">
                    {t.monitor.watchdog.sustainedOptions.min30}
                  </option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {t.monitor.watchdog.sustainedHint}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                <p id="wd-last">
                  {t.monitor.watchdog.lastTriggered}{" "}
                  {t.monitor.watchdog.neverTriggered}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-amber-500/80">
                  <i className="ti ti-alert-triangle text-xs"></i>
                  {t.monitor.watchdog.warning}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p
                  id="wd-admin-note"
                  className="hidden text-xs text-muted-foreground"
                >
                  {t.monitor.watchdog.adminOnly}
                </p>
                <button
                  id="wd-save"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <i className="ti ti-device-floppy text-sm"></i>
                  {t.monitor.watchdog.saveButton}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/** Kill confirm dialog */}
        <dialog
          id="dialog-kill"
          className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        >
          <ModalNavbar
            title={t.monitor.killDialog.title}
            closeId="kill-close"
          />
          <div className="flex flex-col gap-4 px-6 py-5">
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-amber-500">
              <i className="ti ti-alert-triangle text-lg shrink-0 mt-0.5"></i>
              <div className="text-sm">
                <p className="font-medium">
                  {t.monitor.killDialog.warningTitle}
                </p>
                <p className="text-xs opacity-80 mt-1">
                  {t.monitor.killDialog.warningDetail}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                {t.monitor.killDialog.processLabel}
              </p>
              <p id="kill-name" className="font-mono font-medium truncate">
                —
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t.monitor.killDialog.pidLabel}{" "}
                <span id="kill-pid" className="font-mono">
                  —
                </span>
              </p>
            </div>
            <div
              id="kill-error"
              className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
            ></div>
            <div className="flex gap-3">
              <button
                id="kill-cancel"
                type="button"
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                {t.monitor.killDialog.cancelButton}
              </button>
              <button
                id="kill-confirm"
                type="button"
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                <i className="ti ti-trash text-sm"></i>
                {t.monitor.killDialog.confirmButton}
              </button>
            </div>
          </div>
        </dialog>
      </PanelLayout>

      <div
        id="toast"
        className="fixed bottom-4 right-4 z-50 hidden max-w-xs rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
      >
        <p id="toast-msg" className="text-sm font-medium"></p>
      </div>

      {/** AI provider picker (shown when more than one provider is active) */}
      <dialog
        id="dialog-ai-optimize"
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.monitor.aiOptimize.title}
          titleId="ai-provider-title"
          icon="ti-sparkles"
          closeId="ai-optimize-close"
        />
        <div className="flex flex-col gap-3 px-6 py-5">
          <p
            id="ai-provider-subtitle"
            className="text-sm text-muted-foreground"
          >
            {t.monitor.aiOptimize.subtitle}
          </p>
          <div id="ai-optimize-providers" className="grid gap-2"></div>
        </div>
      </dialog>

      <script
        id="monitor-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["monitor"]) }}
      ></script>
    </Fragment>
  );
}
