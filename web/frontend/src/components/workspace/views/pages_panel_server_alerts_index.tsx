// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/server-alerts/index.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

/**
 * Server Alerts — /panel/server-alerts
 *
 * Manage the panel owner's server notifications for the connected server:
 *   - Preferences (status/access toggles + CPU/RAM/disk % thresholds + low-MB).
 *   - Immediate push ("send now").
 *   - Scheduled / recurring notifications (one-shot ISO or 5-field cron).
 *   - Metric rules (cpu/ram/disk/load/service-down + operator + cooldown).
 *
 * Preferences are proxied to/from LP (no local sidecar); scheduled + rules are
 * stored as per-server sidecars on the connected server. Delivery happens
 * through LP's managed notification channel (the panel holds no push tokens).
 */
import PanelLayout from "../module-frame";
import DataTable from "@/components/ui/DataTable";
import ModalNavbar from "./components_ui_ModalNavbar";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import { getSession } from "../view-context";
import {
  buildScheduledTableColumns,
  buildScheduledTableRowActions,
  buildRulesTableColumns,
  buildRulesTableRowActions,
} from "@/config/tables/server-alerts-table-config";
import { getPageMessages } from "../view-context";
export default function pages_panel_server_alerts_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["serverAlerts", "components"]);
  const sa: any = t.serverAlerts;
  const user = getSession(Astro.request);
  const isAdmin = user?.kind === "admin";
  const alertsView = Astro.url.searchParams.get("workspaceView");
  const isolatedAlertsView =
    Astro.url.searchParams.get("embed") === "1" &&
    !Astro.url.searchParams.has("settingsOverlay") &&
    ["prefs", "send", "scheduled", "rules", "history"].includes(
      alertsView ?? "",
    );
  const showAlertsView = (view: string) =>
    !isolatedAlertsView || alertsView === view;
  const saTables = [
    {
      id: "sa-scheduled-table",
      label: sa?.scheduled?.title ?? sa?.tabs?.scheduled ?? "Programadas",
      actions: isAdmin ? buildScheduledTableRowActions(sa) : [],
    },
    {
      id: "sa-rules-table",
      label: sa?.rules?.title ?? sa?.tabs?.rules ?? "Reglas",
      actions: isAdmin ? buildRulesTableRowActions(sa) : [],
    },
  ];
  const dataTableI18n = (t.components as any).dataTable;

  return (
    <Fragment>
      <PanelLayout
        title={t.serverAlerts.pageTitle}
        activeModule="server-alerts"
        titleInActions
      >
        <div slot="title-actions" className="flex min-w-0 items-center gap-2">
          <h1
            id="panel-topbar-title"
            data-panel-title
            className="shrink-0 text-base font-semibold text-foreground"
          >
            {t.serverAlerts.pageTitle}
          </h1>
          <ViewSettingsModal
            id="server-alerts-settings-modal"
            title={sa.settings.title}
            description={sa.settings.description}
            variant="drawer"
            hideFooter={true}
          >
            <div className="flex h-full min-h-0 w-full @container">
              <nav
                aria-label={sa.settings.sections}
                className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52"
              >
                <button
                  type="button"
                  data-salerts-settings-nav="prefs"
                  title={sa.settings.myAlerts}
                  className="flex items-center justify-center gap-2.5 rounded-lg bg-primary/10 px-2.5 py-2 text-sm font-medium text-primary transition-colors @xl:justify-start"
                >
                  <i
                    className="ti ti-bell-cog shrink-0 text-lg"
                    aria-hidden="true"
                  ></i>
                  <span className="hidden truncate @xl:inline">
                    {sa.settings.myAlerts}
                  </span>
                </button>
                <button
                  type="button"
                  data-salerts-settings-nav="channels"
                  title={sa.settings.channels}
                  className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground hover:bg-accent @xl:justify-start"
                >
                  <i
                    className="ti ti-devices shrink-0 text-lg"
                    aria-hidden="true"
                  ></i>
                  <span className="hidden truncate @xl:inline">
                    {sa.settings.channels}
                  </span>
                </button>
                <button
                  type="button"
                  data-salerts-settings-nav="table"
                  title={sa.settings.table}
                  className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground hover:bg-accent @xl:justify-start"
                >
                  <i
                    className="ti ti-table shrink-0 text-lg"
                    aria-hidden="true"
                  ></i>
                  <span className="hidden truncate @xl:inline">
                    {sa.settings.table}
                  </span>
                </button>
              </nav>
              <div className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                <section
                  data-salerts-settings-view="prefs"
                  className="space-y-5"
                >
                  <div>
                    <h2 className="text-base font-semibold">
                      {sa.settings.myAlerts}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {sa.settings.prefsHelp}
                    </p>
                  </div>
                  <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 text-sm font-medium">
                    <span>{sa.settings.enabled}</span>
                    <input
                      id="sa-pref-enabled"
                      type="checkbox"
                      className="h-4 w-4"
                    />
                  </label>
                  <div className="space-y-2 rounded-xl border border-border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {sa.settings.categories}
                    </p>
                    <label className="flex items-center justify-between gap-4 py-1 text-sm">
                      <span>{sa.settings.manual}</span>
                      <input
                        id="sa-pref-manual"
                        type="checkbox"
                        className="h-4 w-4"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-4 py-1 text-sm">
                      <span>{sa.settings.scheduled}</span>
                      <input
                        id="sa-pref-scheduled"
                        type="checkbox"
                        className="h-4 w-4"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-4 py-1 text-sm">
                      <span>{sa.settings.rules}</span>
                      <input
                        id="sa-pref-rules"
                        type="checkbox"
                        className="h-4 w-4"
                      />
                    </label>
                  </div>
                  <button
                    id="sa-prefs-save"
                    type="button"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {sa.settings.save}
                  </button>
                  <span
                    id="sa-prefs-status"
                    role="status"
                    aria-live="polite"
                    className="block text-xs text-muted-foreground"
                  ></span>
                </section>
                <section
                  data-salerts-settings-view="channels"
                  className="hidden space-y-5"
                >
                  <div>
                    <h2 className="text-base font-semibold">
                      {sa.settings.channels}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {sa.settings.channelsHelp}
                    </p>
                  </div>
                  <div className="space-y-3 rounded-xl border border-border p-4">
                    <p
                      id="sa-channel-status"
                      className="text-sm text-muted-foreground"
                    >
                      {sa?.common?.loading ?? "Cargando…"}
                    </p>
                    <label className="flex items-center justify-between gap-4 text-sm">
                      <span>{sa.settings.web}</span>
                      <input
                        id="sa-pref-web"
                        type="checkbox"
                        className="h-4 w-4"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-4 text-sm">
                      <span>{sa.settings.mobile}</span>
                      <input
                        id="sa-pref-mobile"
                        type="checkbox"
                        className="h-4 w-4"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      id="sa-web-enable"
                      type="button"
                      className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      {sa.settings.enableWeb}
                    </button>
                    <button
                      id="sa-web-disable"
                      type="button"
                      className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      {sa.settings.disableWeb}
                    </button>
                    <button
                      id="sa-test-btn"
                      type="button"
                      className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      {sa.settings.test}
                    </button>
                  </div>
                  <button
                    id="sa-channels-save"
                    type="button"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {sa.settings.save}
                  </button>
                  <p
                    id="sa-test-result"
                    role="status"
                    aria-live="polite"
                    className="text-xs text-muted-foreground"
                  ></p>
                </section>
                <section data-salerts-settings-view="table" className="hidden">
                  <div className="space-y-6">
                    {saTables.map((tbl: any) => (
                      <Fragment>
                        <div
                          className="space-y-3 rounded-xl border border-border p-4"
                          data-sa-table={tbl.id}
                        >
                          <h3 className="text-sm font-semibold">{tbl.label}</h3>
                          <div>
                            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t.components.dataTable.resultsPerPage}
                            </p>
                            <div className="inline-flex rounded-lg border border-border p-0.5">
                              {[10, 25, 50, 100].map((n: any) => (
                                <Fragment>
                                  <button
                                    type="button"
                                    data-sa-pagesize={n}
                                    className="rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                  >
                                    {n}
                                  </button>
                                </Fragment>
                              ))}
                            </div>
                          </div>
                          {tbl.actions.length > 0 && (
                            <Fragment>
                              <div>
                                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Acciones a mostrar
                                </p>
                                <div className="space-y-1.5">
                                  {tbl.actions.map((a: any) => (
                                    <Fragment>
                                      <label className="flex items-center gap-2 text-sm">
                                        <input
                                          type="checkbox"
                                          data-sa-action={a.id}
                                          defaultChecked
                                          className="h-4 w-4 rounded border-input"
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
                        </div>
                      </Fragment>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </ViewSettingsModal>
        </div>
        <div className="space-y-6 pt-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold">
              {t.serverAlerts.header.heading}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t.serverAlerts.header.subheading}
            </p>
          </div>

          {/** Tabs (estilo modules: underline + count badge) */}
          <div
            className={
              isolatedAlertsView
                ? "sr-only"
                : "flex gap-1 overflow-x-auto border-b border-border"
            }
          >
            <button
              data-tab="prefs"
              className="tab-btn inline-flex items-center gap-2 border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary transition-all hover:text-primary/80"
            >
              <span>{sa?.tabs?.overview ?? "Resumen"}</span>
            </button>
            <button
              data-tab="send"
              className="tab-btn inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
            >
              <span>{t.serverAlerts.tabs.send}</span>
            </button>
            <button
              data-tab="scheduled"
              className="tab-btn inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
            >
              <span>{t.serverAlerts.tabs.scheduled}</span>
              <span
                id="tab-scheduled-count"
                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold"
              >
                —
              </span>
            </button>
            <button
              data-tab="rules"
              className="tab-btn inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
            >
              <span>{t.serverAlerts.tabs.rules}</span>
              <span
                id="tab-rules-count"
                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold"
              >
                —
              </span>
            </button>
            <button
              data-tab="history"
              className="tab-btn inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
            >
              <span>{sa?.tabs?.history ?? "Historial"}</span>
            </button>
          </div>

          {/** Operational summary */}
          {showAlertsView("prefs") && (
            <Fragment>
              <div id="sa-pane-prefs" className="flex flex-col gap-4 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground">
                      {sa?.overview?.myAlerts ?? "Mis avisos"}
                    </p>
                    <p
                      id="sa-overview-prefs"
                      className="mt-2 text-sm font-semibold"
                    >
                      —
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground">
                      {sa?.overview?.devices ?? "Dispositivos registrados"}
                    </p>
                    <p
                      id="sa-overview-devices"
                      className="mt-2 text-sm font-semibold"
                    >
                      —
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground">
                      {sa?.overview?.last ?? "Último aviso"}
                    </p>
                    <p
                      id="sa-overview-last"
                      className="mt-2 text-sm font-semibold"
                    >
                      —
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 p-4">
                  <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                    {sa?.overview?.help ??
                      "Configura tus avisos y comprueba la entrega antes de crear una programación."}
                  </p>
                  <button
                    id="sa-open-settings"
                    type="button"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
                  >
                    {sa.settings.buttonLabel}
                  </button>
                </div>
              </div>
            </Fragment>
          )}

          {/** Send now tab */}
          {showAlertsView("send") && (
            <Fragment>
              <div id="sa-pane-send" className="hidden flex-col gap-5 p-4">
                <p className="text-xs text-muted-foreground">
                  {t.serverAlerts.send.hint}
                </p>
                <div className="max-w-xl space-y-4 rounded-lg border border-border p-4">
                  <div>
                    <label
                      htmlFor="sa-send-title"
                      className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                    >
                      {t.serverAlerts.send.title}
                    </label>
                    <input
                      id="sa-send-title"
                      type="text"
                      autoComplete="off"
                      maxLength={200}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sa-send-body"
                      className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                    >
                      {t.serverAlerts.send.body}
                    </label>
                    <textarea
                      id="sa-send-body"
                      rows={4}
                      maxLength={2000}
                      className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    ></textarea>
                  </div>
                  <div>
                    <label
                      htmlFor="sa-send-signals"
                      className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                    >
                      {t.serverAlerts.send.signals}
                    </label>
                    <input
                      id="sa-send-signals"
                      type="text"
                      autoComplete="off"
                      placeholder={t.serverAlerts.send.signalsPlaceholder}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t.serverAlerts.send.signalsHint}
                    </p>
                  </div>
                  <div className="border-t border-border pt-4">
                    <button
                      id="sa-send-btn"
                      type="button"
                      disabled={!isAdmin}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      <i className="ti ti-send text-base"></i>{" "}
                      {t.serverAlerts.send.submit}
                    </button>
                    {!isAdmin && (
                      <Fragment>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {sa?.send?.adminOnly ??
                            "Solo un administrador puede enviar avisos a todos los usuarios."}
                        </p>
                      </Fragment>
                    )}
                  </div>
                </div>
              </div>
            </Fragment>
          )}

          {/** Scheduled tab */}
          {showAlertsView("scheduled") && (
            <Fragment>
              <div id="sa-pane-scheduled" className="hidden p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {t.serverAlerts.scheduled.title}
                  </h3>
                  {isAdmin && (
                    <Fragment>
                      <button
                        id="sa-sched-add"
                        className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        <i className="ti ti-plus text-sm"></i>{" "}
                        {t.serverAlerts.scheduled.add}
                      </button>
                    </Fragment>
                  )}
                </div>
                <DataTable
                  i18n={dataTableI18n}
                  tableId="sa-scheduled-table"
                  title={t.serverAlerts.scheduled.title}
                  columns={buildScheduledTableColumns(sa)}
                  data={[]}
                  rowActions={isAdmin ? buildScheduledTableRowActions(sa) : []}
                  selectable={false}
                />
              </div>
            </Fragment>
          )}

          {/** Rules tab */}
          {showAlertsView("rules") && (
            <Fragment>
              <div id="sa-pane-rules" className="hidden p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {t.serverAlerts.rules.title}
                  </h3>
                  {isAdmin && (
                    <Fragment>
                      <button
                        id="sa-rule-add"
                        className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        <i className="ti ti-plus text-sm"></i>{" "}
                        {t.serverAlerts.rules.add}
                      </button>
                    </Fragment>
                  )}
                </div>
                <DataTable
                  i18n={dataTableI18n}
                  tableId="sa-rules-table"
                  title={t.serverAlerts.rules.title}
                  columns={buildRulesTableColumns(sa)}
                  data={[]}
                  rowActions={isAdmin ? buildRulesTableRowActions(sa) : []}
                  selectable={false}
                />
              </div>
            </Fragment>
          )}
          {showAlertsView("history") && (
            <Fragment>
              <div id="sa-pane-history" className="hidden p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {sa?.history?.title ?? "Historial de entrega"}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {sa?.history?.hint ??
                        "Aceptado significa que el proveedor recibió el aviso; no confirma que el dispositivo lo haya mostrado."}
                    </p>
                  </div>
                  <button
                    id="sa-history-refresh"
                    type="button"
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
                  >
                    {sa?.history?.refresh ?? "Actualizar"}
                  </button>
                </div>
                <div
                  id="sa-history-list"
                  role="status"
                  aria-live="polite"
                  className="space-y-2 text-sm text-muted-foreground"
                >
                  {sa?.common?.loading ?? "Cargando…"}
                </div>
                <button
                  id="sa-history-more"
                  type="button"
                  className="mt-4 hidden rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
                >
                  {sa?.history?.more ?? "Cargar más"}
                </button>
              </div>
            </Fragment>
          )}
        </div>
      </PanelLayout>

      {/** Scheduled notification editor (create) */}
      {showAlertsView("scheduled") && (
        <Fragment>
          <dialog
            id="dlg-sa-sched"
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm h-fit"
          >
            <ModalNavbar
              title={t.serverAlerts.scheduled.add}
              closeId="sa-sched-x"
            />
            <div className="space-y-4 px-6 py-4">
              <div>
                <label
                  htmlFor="sa-sched-title"
                  className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {t.serverAlerts.scheduled.fieldTitle}
                </label>
                <input
                  id="sa-sched-title"
                  type="text"
                  autoComplete="off"
                  maxLength={200}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label
                  htmlFor="sa-sched-body"
                  className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {t.serverAlerts.scheduled.fieldBody}
                </label>
                <textarea
                  id="sa-sched-body"
                  rows={3}
                  maxLength={2000}
                  className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                ></textarea>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t.serverAlerts.scheduled.mode}
                </label>
                <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs">
                  <button
                    type="button"
                    data-sched-mode="once"
                    className="sa-sched-mode flex-1 rounded-md px-3 py-1.5 font-medium"
                  >
                    {t.serverAlerts.scheduled.modeOnce}
                  </button>
                  <button
                    type="button"
                    data-sched-mode="cron"
                    className="sa-sched-mode flex-1 rounded-md px-3 py-1.5 font-medium"
                  >
                    {t.serverAlerts.scheduled.modeCron}
                  </button>
                </div>
              </div>

              <div id="sa-sched-once-wrap">
                <label
                  htmlFor="sa-sched-at"
                  className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {t.serverAlerts.scheduled.scheduleAt}
                </label>
                <input
                  id="sa-sched-at"
                  type="datetime-local"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div id="sa-sched-cron-wrap" className="hidden">
                <label
                  htmlFor="sa-sched-cron"
                  className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {t.serverAlerts.scheduled.cron}
                </label>
                <input
                  id="sa-sched-cron"
                  type="text"
                  spellCheck="false"
                  autoComplete="off"
                  placeholder={t.serverAlerts.scheduled.cronPlaceholder}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t.serverAlerts.scheduled.cronHint}
                </p>
              </div>

              <p
                id="sa-sched-timezone"
                className="text-xs text-muted-foreground"
              ></p>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  id="sa-sched-enabled"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-input text-primary"
                />
                <span>{t.serverAlerts.scheduled.enabled}</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <button
                id="sa-sched-cancel"
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                {t.serverAlerts.common.cancel}
              </button>
              <button
                id="sa-sched-save"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <i className="ti ti-device-floppy text-base"></i>{" "}
                {t.serverAlerts.common.save}
              </button>
            </div>
          </dialog>
        </Fragment>
      )}

      {/** Metric rule editor (create) */}
      {showAlertsView("rules") && (
        <Fragment>
          <dialog
            id="dlg-sa-rule"
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm h-fit"
          >
            <ModalNavbar title={t.serverAlerts.rules.add} closeId="sa-rule-x" />
            <div className="space-y-4 px-6 py-4">
              <div>
                <label
                  htmlFor="sa-rule-name"
                  className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {t.serverAlerts.rules.name}
                </label>
                <input
                  id="sa-rule-name"
                  type="text"
                  autoComplete="off"
                  maxLength={120}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="sa-rule-metric"
                    className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                  >
                    {t.serverAlerts.rules.metric}
                  </label>
                  <select
                    id="sa-rule-metric"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="cpu">
                      {t.serverAlerts.rules.metricCpu}
                    </option>
                    <option value="ram">
                      {t.serverAlerts.rules.metricRam}
                    </option>
                    <option value="disk">
                      {t.serverAlerts.rules.metricDisk}
                    </option>
                    <option value="load">
                      {t.serverAlerts.rules.metricLoad}
                    </option>
                    <option value="service-down">
                      {t.serverAlerts.rules.metricServiceDown}
                    </option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="sa-rule-op"
                    className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                  >
                    {t.serverAlerts.rules.op}
                  </label>
                  <select
                    id="sa-rule-op"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value=">=">&ge;</option>
                    <option value="<=">&le;</option>
                    <option value="==">=</option>
                    <option value="down">{t.serverAlerts.rules.opDown}</option>
                  </select>
                </div>
              </div>

              <div id="sa-rule-threshold-wrap">
                <label
                  htmlFor="sa-rule-threshold"
                  className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {t.serverAlerts.rules.threshold}
                </label>
                <input
                  id="sa-rule-threshold"
                  type="number"
                  min="0"
                  step="1"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t.serverAlerts.rules.thresholdHint}
                </p>
              </div>

              <div id="sa-rule-service-wrap" className="hidden">
                <label
                  htmlFor="sa-rule-service"
                  className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {t.serverAlerts.rules.service}
                </label>
                <input
                  id="sa-rule-service"
                  type="text"
                  spellCheck="false"
                  autoComplete="off"
                  placeholder={t.serverAlerts.rules.servicePlaceholder}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t.serverAlerts.rules.serviceHint}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="sa-rule-cooldown"
                    className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                  >
                    {t.serverAlerts.rules.cooldown}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="sa-rule-cooldown"
                      type="number"
                      min="0"
                      max="10080"
                      step="1"
                      defaultValue="15"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <span className="text-sm text-muted-foreground">
                      {t.serverAlerts.rules.minutes}
                    </span>
                  </div>
                </div>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      id="sa-rule-enabled"
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 rounded border-input text-primary"
                    />
                    <span>{t.serverAlerts.rules.enabled}</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <button
                id="sa-rule-cancel"
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                {t.serverAlerts.common.cancel}
              </button>
              <button
                id="sa-rule-save"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <i className="ti ti-device-floppy text-base"></i>{" "}
                {t.serverAlerts.common.save}
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
        id="server-alerts-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["serverAlerts"]) }}
      ></script>
    </Fragment>
  );
}
