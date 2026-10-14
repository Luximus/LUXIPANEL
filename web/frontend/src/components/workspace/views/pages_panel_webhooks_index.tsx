// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/webhooks/index.astro.
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
 * Webhooks — /panel/webhooks
 *
 * Organised into three product categories (receive-data / mailhook / response).
 * Only "receive-data" is functional today: panel-hosted inbound gateway
 * webhooks (Make.com style) + receivers detected by the server scan.
 * "mailhook" and "response" are reserved placeholders. The legacy outbound
 * event webhooks, API keys and the full detected list remain available as
 * secondary tabs.
 */
import PanelLayout from "../module-frame";
import ModalNavbar from "./components_ui_ModalNavbar";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import DataTable from "@/components/ui/DataTable";
import {
  buildApiKeysTableColumns,
  buildApiKeysTableFilters,
  buildApiKeysTableRowActions,
  buildDiscoveredTableColumns,
  buildDiscoveredTableFilters,
  buildDiscoveredTableRowActions,
  DISCOVERED_TABLE_VALUE_BADGES,
  buildGatewayTableColumns,
  buildGatewayTableFilters,
  buildGatewayTableRowActions,
  GATEWAY_TABLE_VALUE_BADGES,
  buildWebhooksTableColumns,
  buildWebhooksTableFilters,
  buildWebhooksTableRowActions,
  WEBHOOKS_TABLE_VALUE_BADGES,
} from "@/config/tables/webhooks-table-config";
import { getPageMessages, moduleAccessRedirect } from "../view-context";
export default function pages_panel_webhooks_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const denied = moduleAccessRedirect(Astro, "webhooks");
  if (denied) return denied;
  if (Astro.locals.user?.kind !== "admin") return Astro.redirect("/panel");
  const t = getPageMessages(Astro, ["webhooks", "components"]);
  const dataTableI18n = t.components.dataTable;
  const w: any = t.webhooks;
  const tbl: any = w?.table;
  const cat = (k: string, fb: string) => (w?.categories?.[k] ?? fb) as string;
  const gw = (path: string, fb: string) => {
    const parts = path.split(".");
    let node: any = w?.gateway;
    for (const p of parts) node = node?.[p];
    return (typeof node === "string" ? node : fb) as string;
  };
  const gatewayActions = buildGatewayTableRowActions(tbl);
  const webhooksRowActions = buildWebhooksTableRowActions(tbl);
  const apikeysActions = buildApiKeysTableRowActions(tbl);
  const discoveredActions = buildDiscoveredTableRowActions(tbl);
  const WH_SETTINGS_SECTIONS = [
    {
      key: "gateway",
      label: w.settingsUi.gateway,
      icon: "ti-webhook",
      tableId: "gateway-table",
      actions: gatewayActions,
    },
    {
      key: "webhooks",
      label: w.settingsUi.webhooks,
      icon: "ti-arrow-guide",
      tableId: "webhooks-table",
      actions: webhooksRowActions,
    },
    {
      key: "apikeys",
      label: w.tabs.apiKeys,
      icon: "ti-key",
      tableId: "apikeys-table",
      actions: apikeysActions,
    },
    {
      key: "discovered",
      label: w.tabs.discovered,
      icon: "ti-radar",
      tableId: "discovered-table",
      actions: discoveredActions,
    },
  ];
  const webhookView = Astro.url.searchParams.get("workspaceView");
  const isolatedWebhookView =
    Astro.url.searchParams.get("embed") === "1" &&
    !Astro.url.searchParams.has("settingsOverlay") &&
    ["receive", "webhooks", "keys", "discovered"].includes(webhookView ?? "");
  const showWebhookView = (view: string) =>
    !isolatedWebhookView || webhookView === view;

  return (
    <Fragment>
      <PanelLayout title={t.webhooks.pageTitle} activeModule="webhooks">
        <div slot="title-actions">
          <ViewSettingsModal
            id="webhooks-settings-modal"
            title={w.settingsUi.title}
            description={w.settingsUi.description}
            variant="drawer"
            hideFooter={true}
          >
            <section className="flex h-full min-h-0 w-full @container">
              <nav className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52">
                {WH_SETTINGS_SECTIONS.map((sec: any, i: number) => (
                  <Fragment>
                    <button
                      type="button"
                      data-wh-nav={sec.key}
                      title={sec.label}
                      className={classList([
                        "flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 ease-out @xl:justify-start",
                        i === 0
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      ])}
                    >
                      <i
                        className={classList(["ti shrink-0 text-lg", sec.icon])}
                      ></i>
                      <span className="hidden truncate @xl:inline">
                        {sec.label}
                      </span>
                    </button>
                  </Fragment>
                ))}
              </nav>
              <div className="min-w-0 flex-1 overflow-y-auto px-4 py-4 @container">
                {WH_SETTINGS_SECTIONS.map((sec: any, i: number) => (
                  <Fragment>
                    <div
                      data-wh-view={sec.key}
                      className={classList([
                        i === 0 ? "" : "hidden",
                        "space-y-6",
                      ])}
                    >
                      <div>
                        <h3 className="text-sm font-semibold">
                          {t.components.tableSettings.pagination}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {t.components.tableSettings.rowsPerPage}
                        </p>
                        <div
                          className="mt-2 inline-flex overflow-hidden rounded-lg border border-border"
                          data-wh-pagesize
                          data-wh-table={sec.tableId}
                        >
                          {[10, 25, 50, 100].map((n: any) => (
                            <Fragment>
                              <button
                                type="button"
                                data-size={n}
                                className="border-r border-border px-3 py-1.5 text-sm last:border-r-0 hover:bg-accent"
                              >
                                {n}
                              </button>
                            </Fragment>
                          ))}
                        </div>
                      </div>
                      {sec.actions.length > 0 && (
                        <Fragment>
                          <div>
                            <h3 className="text-sm font-semibold">
                              {t.components.tableSettings.visibleActions}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {t.components.tableSettings.actionsHint}
                            </p>
                            <div className="mt-2 space-y-1.5">
                              {sec.actions.map((a: any) => (
                                <Fragment>
                                  <label className="flex items-center gap-2.5 text-sm">
                                    <input
                                      type="checkbox"
                                      data-wh-action={a.id}
                                      data-wh-table={sec.tableId}
                                      className="h-4 w-4 rounded border-border"
                                      defaultChecked
                                    />
                                    <i
                                      className={classList([
                                        "ti text-base text-muted-foreground",
                                        a.icon ?? "ti-dots",
                                      ])}
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
          </ViewSettingsModal>
        </div>

        {/** Tabs: 3 categories + legacy */}
        <div
          className={
            isolatedWebhookView
              ? "sr-only"
              : "mb-6 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit"
          }
        >
          <button
            id="tab-receive"
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all bg-card text-foreground shadow-sm"
            data-tab="receive"
          >
            <i className="ti ti-arrow-bar-to-down mr-1.5 text-sm"></i>
            {cat("receiveData", "Recibir datos")}
          </button>
          <span className="mx-1 h-6 w-px bg-border"></span>
          <button
            id="tab-webhooks"
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all text-muted-foreground hover:text-foreground"
            data-tab="webhooks"
          >
            <i className="ti ti-webhook mr-1.5 text-sm"></i>
            {t.webhooks.tabs.webhooks}
          </button>
          <button
            id="tab-keys"
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all text-muted-foreground hover:text-foreground"
            data-tab="keys"
          >
            <i className="ti ti-key mr-1.5 text-sm"></i>
            {t.webhooks.tabs.apiKeys}
          </button>
          <button
            id="tab-discovered"
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all text-muted-foreground hover:text-foreground"
            data-tab="discovered"
          >
            <i className="ti ti-radar mr-1.5 text-sm"></i>
            {t.webhooks.tabs.discovered}
          </button>
        </div>

        {/** ══ Category: Receive data (functional) ══ */}
        {showWebhookView("receive") && (
          <Fragment>
            <div id="panel-receive">
              <div className="mb-4 flex justify-between items-start gap-4">
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {gw(
                    "description",
                    "Endpoints que el panel aloja para recibir datos entrantes.",
                  )}
                </p>
                <button
                  id="btn-new-gateway"
                  className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 active:scale-[0.98]"
                >
                  <i className="ti ti-plus text-base"></i>
                  {gw("btnNew", "Nuevo webhook")}
                </button>
              </div>

              {/** URL reveal (shown after creation) */}
              <div
                id="gw-url-reveal"
                className="hidden mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"
              >
                <p className="text-sm font-semibold text-emerald-500 mb-2">
                  <i className="ti ti-check mr-1.5"></i>
                  {gw(
                    "urlReveal",
                    "URL del webhook — envía las peticiones aquí",
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <code
                    id="gw-url-value"
                    className="flex-1 rounded-lg bg-card border border-border px-3 py-2 text-xs font-mono break-all"
                  ></code>
                  <button
                    id="gw-url-copy"
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent transition-colors shrink-0"
                  >
                    <i className="ti ti-copy mr-1"></i>
                    {t.webhooks.newKeyReveal.btnCopy}
                  </button>
                </div>
              </div>

              <DataTable
                scopedPreferences={true}
                i18n={dataTableI18n}
                tableId="gateway-table"
                title={w.categories.receiveData}
                columns={buildGatewayTableColumns(tbl)}
                data={[]}
                filters={buildGatewayTableFilters(tbl)}
                rowActions={buildGatewayTableRowActions(tbl)}
                valueBadges={GATEWAY_TABLE_VALUE_BADGES}
              />

              {/** Detected receivers on the server */}
              <div className="mt-8 mb-3 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-foreground">
                  <i className="ti ti-radar mr-1.5"></i>
                  {gw("detectedTitle", "Receptores detectados en el servidor")}
                </h3>
                <button
                  id="btn-rescan-gw"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent active:scale-[0.98]"
                >
                  <i className="ti ti-refresh text-sm"></i>
                  {t.webhooks.discovered.btnRescan}
                </button>
              </div>
              <DataTable
                scopedPreferences={true}
                i18n={dataTableI18n}
                tableId="gw-detected-table"
                title={w.gateway.detectedTitle}
                columns={buildDiscoveredTableColumns(tbl)}
                data={[]}
                filters={buildDiscoveredTableFilters(tbl)}
                rowActions={[
                  {
                    id: "detail",
                    label: t.webhooks.discovered.actions.detail,
                    icon: "ti-eye",
                  },
                ]}
                valueBadges={DISCOVERED_TABLE_VALUE_BADGES}
              />
            </div>
          </Fragment>
        )}

        {/** ══ Category: Mailhook (placeholder) ══ */}
        {!isolatedWebhookView && (
          <Fragment>
            <div id="panel-mailhook" className="hidden">
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
                <i className="ti ti-mail text-4xl text-muted-foreground"></i>
                <h3 className="mt-3 text-base font-semibold">
                  {cat("mailhook", "Mailhook")} · {cat("soon", "Próximamente")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                  {cat(
                    "soonDesc",
                    "La configuración y el escaneo de esta categoría se definirán en una fase posterior.",
                  )}
                </p>
              </div>
            </div>
          </Fragment>
        )}

        {/** ══ Category: Webhook response (placeholder) ══ */}
        {!isolatedWebhookView && (
          <Fragment>
            <div id="panel-response" className="hidden">
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
                <i className="ti ti-arrow-back-up text-4xl text-muted-foreground"></i>
                <h3 className="mt-3 text-base font-semibold">
                  {cat("response", "Respuesta a webhook")} ·{" "}
                  {cat("soon", "Próximamente")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                  {cat(
                    "soonDesc",
                    "La configuración y el escaneo de esta categoría se definirán en una fase posterior.",
                  )}
                </p>
              </div>
            </div>
          </Fragment>
        )}

        {/** Legacy: outbound webhooks */}
        {showWebhookView("webhooks") && (
          <Fragment>
            <div id="panel-webhooks" className="hidden">
              <div className="mb-4 flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {t.webhooks.webhooksPanel.description}
                </p>
                <button
                  id="btn-new-webhook"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 active:scale-[0.98]"
                >
                  <i className="ti ti-plus text-base"></i>
                  {t.webhooks.webhooksPanel.btnNew}
                </button>
              </div>
              <div
                id="wh-secret-reveal"
                className="mb-4 hidden rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm"
              >
                <p className="font-semibold">{w.settingsUi.signingSecret}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {w.settingsUi.signingSecretHint}
                </p>
                <code
                  id="wh-secret-value"
                  className="mt-2 block break-all rounded-lg bg-background p-2 font-mono text-xs"
                ></code>
              </div>
              <DataTable
                scopedPreferences={true}
                i18n={dataTableI18n}
                tableId="webhooks-table"
                title={w.tabs.webhooks}
                columns={buildWebhooksTableColumns(tbl)}
                data={[]}
                filters={buildWebhooksTableFilters(tbl)}
                rowActions={buildWebhooksTableRowActions(tbl)}
                valueBadges={WEBHOOKS_TABLE_VALUE_BADGES}
              />
              <div
                id="wh-history"
                className="mt-4 hidden rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 id="wh-history-title" className="text-sm font-semibold">
                    {w.settingsUi.recentDeliveries}
                  </h3>
                  <button
                    id="wh-history-close"
                    type="button"
                    className="text-xs text-primary"
                  >
                    {w.gateway.payloads.btnClose}
                  </button>
                </div>
                <div
                  id="wh-history-content"
                  className="mt-3 text-xs text-muted-foreground"
                ></div>
              </div>
            </div>
          </Fragment>
        )}

        {/** API Keys panel */}
        {showWebhookView("keys") && (
          <Fragment>
            <div id="panel-keys" className="hidden">
              <div className="mb-4 flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {t.webhooks.apiKeysPanel.description}
                </p>
                <button
                  id="btn-new-key"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 active:scale-[0.98]"
                >
                  <i className="ti ti-plus text-base"></i>
                  {t.webhooks.apiKeysPanel.btnNew}
                </button>
              </div>

              {/** New key reveal (shown after creation) */}
              <div
                id="new-key-reveal"
                className="hidden mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"
              >
                <p className="text-sm font-semibold text-emerald-500 mb-2">
                  <i className="ti ti-check mr-1.5"></i>
                  {t.webhooks.newKeyReveal.message}
                </p>
                <div className="flex items-center gap-2">
                  <code
                    id="new-key-value"
                    className="flex-1 rounded-lg bg-card border border-border px-3 py-2 text-xs font-mono break-all"
                  ></code>
                  <button
                    id="btn-copy-key"
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent transition-colors shrink-0"
                  >
                    <i className="ti ti-copy mr-1"></i>
                    {t.webhooks.newKeyReveal.btnCopy}
                  </button>
                </div>
              </div>

              <DataTable
                scopedPreferences={true}
                i18n={dataTableI18n}
                tableId="apikeys-table"
                title={w.tabs.apiKeys}
                columns={buildApiKeysTableColumns(tbl)}
                data={[]}
                filters={buildApiKeysTableFilters(tbl)}
                rowActions={buildApiKeysTableRowActions(tbl)}
              />
            </div>
          </Fragment>
        )}

        {/** Detected webhooks panel (full) */}
        {showWebhookView("discovered") && (
          <Fragment>
            <div id="panel-discovered" className="hidden">
              <div className="mb-4 flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {t.webhooks.discovered.description}
                </p>
                <button
                  id="btn-rescan-discovered"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent active:scale-[0.98]"
                >
                  <i className="ti ti-refresh text-base"></i>
                  {t.webhooks.discovered.btnRescan}
                </button>
              </div>
              <DataTable
                scopedPreferences={true}
                i18n={dataTableI18n}
                tableId="discovered-table"
                title={w.tabs.discovered}
                columns={buildDiscoveredTableColumns(tbl)}
                data={[]}
                filters={buildDiscoveredTableFilters(tbl)}
                rowActions={buildDiscoveredTableRowActions(tbl)}
                valueBadges={DISCOVERED_TABLE_VALUE_BADGES}
              />
            </div>
          </Fragment>
        )}
      </PanelLayout>

      {/** ══ Gateway (receive-data) dialog — Make.com style ══ */}
      {showWebhookView("receive") && (
        <Fragment>
          <dialog
            id="dialog-gateway"
            className="w-full max-w-xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          >
            <ModalNavbar
              title={gw("dialog.titleNew", "Crear un webhook")}
              titleId="gw-dialog-title"
              closeId="gw-close"
            />
            <form
              id="form-gateway"
              className="flex flex-col gap-5 px-6 py-5 max-h-[80vh] overflow-y-auto"
            >
              <div
                id="gw-error"
                className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
              ></div>

              {/** Name */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="gw-name">
                  {gw("dialog.name", "Nombre del webhook")}{" "}
                  <span className="text-destructive">*</span>
                </label>
                <input
                  id="gw-name"
                  type="text"
                  required
                  maxLength={128}
                  placeholder={gw(
                    "dialog.namePlaceholder",
                    "Mi webhook gateway",
                  )}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-muted-foreground">
                  {gw(
                    "dialog.nameHint",
                    "Debe tener entre 1 y 128 caracteres.",
                  )}
                </p>
              </div>

              {/** API key authentication */}
              <div className="space-y-2 rounded-xl border border-border p-4">
                <label className="text-sm font-semibold">
                  <i className="ti ti-key mr-1.5 text-primary"></i>
                  {gw("dialog.apiAuth", "Autenticación por API key")}
                </label>
                <div id="gw-apikeys" className="space-y-2"></div>
                <button
                  type="button"
                  id="gw-add-apikey"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  <i className="ti ti-plus mr-1"></i>
                  {gw("dialog.addApiKey", "Añadir API key")}
                </button>
                <p className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground">
                  {gw(
                    "dialog.apiAuthHint",
                    "Envía la API key en la cabecera x-make-apikey. Si alguna coincide, se concede el acceso.",
                  )}
                </p>
              </div>

              {/** IP restrictions */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="gw-ips">
                  {gw("dialog.ipTitle", "Restricciones de IP")}
                </label>
                <input
                  id="gw-ips"
                  type="text"
                  placeholder="203.0.113.4, 10.0.0.0/8"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-muted-foreground">
                  {gw(
                    "dialog.ipHint",
                    "Lista de IPs separadas por coma. Puedes usar notación CIDR. Vacío = sin comprobación.",
                  )}
                </p>
              </div>

              {/** Data structure */}
              <div className="space-y-2 rounded-xl border border-border p-4">
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input
                    id="gw-ds-validate"
                    type="checkbox"
                    className="h-4 w-4 rounded border-input text-primary"
                  />
                  {gw("dialog.dsValidate", "Validar estructura de datos")}
                </label>
                <p className="text-xs text-muted-foreground">
                  {gw(
                    "dialog.dataStructureHint",
                    "Validación de los datos entrantes. Vacío = se aceptan sin validar.",
                  )}
                </p>
                <div id="gw-ds-section" className="hidden space-y-3 pt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      id="gw-ds-strict"
                      type="checkbox"
                      className="h-4 w-4 rounded border-input text-primary"
                    />
                    {gw(
                      "dialog.dsStrict",
                      "Estricto (rechazar campos no especificados)",
                    )}
                  </label>
                  <div id="gw-ds-fields" className="space-y-3"></div>
                  <button
                    type="button"
                    id="gw-ds-add"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    <i className="ti ti-plus mr-1"></i>
                    {gw("dialog.addItem", "Añadir campo")}
                  </button>
                </div>
              </div>

              {/** Advanced toggles */}
              <div className="space-y-3 rounded-xl border border-border p-4">
                <label className="text-sm font-semibold">
                  {gw("dialog.advanced", "Ajustes avanzados")}
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    id="gw-get-headers"
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-input text-primary"
                  />
                  <span>
                    {gw(
                      "dialog.getHeaders",
                      "Obtener cabeceras de la petición",
                    )}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {gw(
                        "dialog.getHeadersHint",
                        "Las cabeceras se añadirán al cuerpo.",
                      )}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    id="gw-get-method"
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-input text-primary"
                  />
                  <span>
                    {gw("dialog.getMethod", "Obtener método HTTP")}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {gw(
                        "dialog.getMethodHint",
                        "El método (verbo) se añadirá al cuerpo.",
                      )}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    id="gw-json-passthrough"
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-input text-primary"
                  />
                  <span>
                    {gw("dialog.jsonPassthrough", "Guardar JSON como texto")}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {gw(
                        "dialog.jsonPassthroughHint",
                        "Si se activa, el contenido JSON se guarda como texto.",
                      )}
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="gw-enabled"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-input text-primary"
                />
                <label htmlFor="gw-enabled" className="text-sm">
                  {gw("dialog.enabled", "Webhook activo")}
                </label>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  id="gw-cancel"
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  {gw("dialog.btnCancel", "Cancelar")}
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {gw("dialog.btnSave", "Guardar")}
                </button>
              </div>
            </form>
          </dialog>
        </Fragment>
      )}

      {/** Gateway payloads dialog */}
      {showWebhookView("receive") && (
        <Fragment>
          <dialog
            id="dialog-gw-payloads"
            className="w-full max-w-2xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          >
            <ModalNavbar
              title={gw("payloads.title", "Payloads recibidos")}
              closeId="gwp-close"
            />
            <div className="flex flex-col gap-3 px-6 py-5 max-h-[75vh] overflow-y-auto">
              <div
                id="gwp-empty"
                className="hidden rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
              >
                {gw("payloads.empty", "Aún no se ha recibido ningún payload.")}
              </div>
              <div id="gwp-list" className="space-y-3"></div>
              <div className="flex pt-1">
                <button
                  type="button"
                  id="gwp-cancel"
                  className="ml-auto rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  {gw("payloads.btnClose", "Cerrar")}
                </button>
              </div>
            </div>
          </dialog>
        </Fragment>
      )}

      {/** Legacy webhook dialog */}
      {showWebhookView("webhooks") && (
        <Fragment>
          <dialog
            id="dialog-webhook"
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          >
            <ModalNavbar
              title={t.webhooks.webhookDialog.title}
              titleId="wh-dialog-title"
              closeId="wh-close"
            />
            <form
              id="form-webhook"
              className="flex flex-col gap-4 px-6 py-5 max-h-[80vh] overflow-y-auto"
            >
              <div
                id="wh-error"
                className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
              ></div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="wh-name">
                  {t.webhooks.webhookDialog.labelName}
                </label>
                <input
                  id="wh-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={128}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  placeholder={t.webhooks.webhookDialog.placeholderName}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="wh-url">
                  {t.webhooks.webhookDialog.labelUrl}
                </label>
                <input
                  id="wh-url"
                  type="url"
                  required
                  placeholder={t.webhooks.webhookDialog.placeholderUrl}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t.webhooks.webhookDialog.labelEvents}
                </label>
                <div
                  id="events-checkboxes"
                  className="grid grid-cols-2 gap-1.5 text-sm"
                ></div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="wh-enabled"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-input text-primary"
                />
                <label htmlFor="wh-enabled" className="text-sm">
                  {t.webhooks.webhookDialog.labelEnabled}
                </label>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  id="wh-cancel"
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  {t.webhooks.webhookDialog.btnCancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {t.webhooks.webhookDialog.btnSave}
                </button>
              </div>
            </form>
          </dialog>
        </Fragment>
      )}

      {/** API Key dialog */}
      {showWebhookView("keys") && (
        <Fragment>
          <dialog
            id="dialog-key"
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          >
            <ModalNavbar
              title={t.webhooks.apiKeyDialog.title}
              closeId="key-close"
            />
            <form id="form-key" className="flex flex-col gap-4 px-6 py-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="key-name">
                  {t.webhooks.apiKeyDialog.labelName}
                </label>
                <input
                  id="key-name"
                  type="text"
                  required
                  placeholder={t.webhooks.apiKeyDialog.placeholderName}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="key-expires">
                  {t.webhooks.apiKeyDialog.labelExpires}
                </label>
                <input
                  id="key-expires"
                  type="date"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  id="key-cancel"
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  {t.webhooks.apiKeyDialog.btnCancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {t.webhooks.apiKeyDialog.btnCreate}
                </button>
              </div>
            </form>
          </dialog>
        </Fragment>
      )}

      {/** Discovered detail dialog */}
      {showWebhookView("discovered") && (
        <Fragment>
          <dialog
            id="dialog-discovered"
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          >
            <ModalNavbar
              title={t.webhooks.discovered.detail.title}
              closeId="disc-close"
            />
            <div className="flex flex-col gap-4 px-6 py-5 max-h-[80vh] overflow-y-auto">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.webhooks.discovered.detail.source}
                </span>
                <p id="disc-source" className="text-sm"></p>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.webhooks.discovered.detail.target}
                </span>
                <p id="disc-target" className="text-sm break-all"></p>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.webhooks.discovered.detail.location}
                </span>
                <p id="disc-location" className="text-sm break-all"></p>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.webhooks.discovered.detail.info}
                </span>
                <p id="disc-info" className="text-sm break-all"></p>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {t.webhooks.discovered.detail.raw}
                </span>
                <pre
                  id="disc-raw"
                  className="rounded-lg bg-card border border-border px-3 py-2 text-xs font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto"
                ></pre>
              </div>
              <div
                id="disc-note"
                className="hidden rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground"
              ></div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  id="disc-cancel"
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  {t.webhooks.discovered.detail.btnClose}
                </button>
              </div>
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
        id="webhooks-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["webhooks"]) }}
      ></script>
    </Fragment>
  );
}
