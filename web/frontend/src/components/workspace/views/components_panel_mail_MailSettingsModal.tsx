// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/panel-mail/MailSettingsModal.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import DataTable from "@/components/ui/DataTable";
export default function components_panel_mail_MailSettingsModal(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const {
    t,
    dataTableI18n,
    MAIL_REDIRECT_COLUMNS,
    MAIL_REDIRECT_FILTERS,
    MAIL_REDIRECT_ROW_ACTIONS,
    MAIL_ENCRYPTION_COLUMNS,
    MAIL_ENCRYPTION_FILTERS,
    MAIL_ENCRYPTION_ROW_ACTIONS,
    MAIL_ACCOUNTS_ROW_ACTIONS = [],
  } = Astro.props;
  // Left-nav sections for the settings drawer (reemplaza el antiguo menú de cards).
  const settingsNav = [
    { view: "table", icon: "ti-table", label: t.mail.settingsModal.tableLabel },
    {
      view: "routing",
      icon: "ti-route",
      label: t.mail.settingsModal.routingCard.label,
    },
    {
      view: "domain-redirect",
      icon: "ti-send",
      label: t.mail.settingsModal.domainRedirectCard.label,
    },
    {
      view: "encryption",
      icon: "ti-key",
      label: t.mail.settingsModal.encryptionCard.label,
    },
    {
      view: "archive",
      icon: "ti-archive",
      label: t.mail.settingsModal.archiveCard.label,
    },
    {
      view: "default-address",
      icon: "ti-mail-question",
      label: t.mail.settingsModal.defaultAddressCard.label,
    },
    {
      view: "outbound",
      icon: "ti-mail-forward",
      label: t.mail.outbound.cardTitle,
    },
  ];
  const pageSizes = [10, 25, 50, 100];

  return (
    <Fragment>
      <ViewSettingsModal
        id="mail-settings-modal"
        title={t.mail.settingsModal.title}
        buttonLabel={t.mail.settingsModal.buttonLabel}
        description={t.mail.settingsModal.description}
        hideTrigger={true}
        hideFooter={true}
        variant="drawer"
      >
        <div className="flex h-full min-h-0 w-full @container">
          {/** Menú lateral izquierdo (estilo Agentes IA / DrawerSectionNav). */}
          <nav className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52">
            {settingsNav.map((item: any) => (
              <Fragment>
                <button
                  type="button"
                  data-mail-settings-open={item.view}
                  data-mail-settings-nav={item.view}
                  title={item.label}
                  className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 ease-out hover:bg-accent hover:text-foreground @xl:justify-start"
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

          {/** Columna de contenido: cada vista se muestra/oculta por el script. */}
          <div className="min-w-0 flex-1 overflow-y-auto px-5 py-5">
            <section data-mail-settings-view="table" className="mt-0 space-y-5">
              <div>
                <h4 className="text-sm font-semibold">Paginación</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Filas por página en la tabla de cuentas.
                </p>
                <div className="mt-3 inline-flex rounded-lg border border-border p-1">
                  {pageSizes.map((n: any) => (
                    <Fragment>
                      <button
                        type="button"
                        data-mail-pagesize={String(n)}
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
                      >
                        {n}
                      </button>
                    </Fragment>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Acciones a mostrar</h4>
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      data-mail-actions-all="show"
                      className="font-medium text-primary hover:underline"
                    >
                      Mostrar todas
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      data-mail-actions-all="hide"
                      className="font-medium text-muted-foreground hover:underline"
                    >
                      Ocultar todas
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Elige qué acciones aparecen en el menú «···» de cada fila.
                </p>
                <div className="mt-3 space-y-1">
                  {MAIL_ACCOUNTS_ROW_ACTIONS.map((a: any) => (
                    <Fragment>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/50">
                        <input
                          type="checkbox"
                          data-mail-action-toggle={a.id}
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
            <section
              data-mail-settings-view="outbound"
              className="hidden mt-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  {t.mail.outbound.cardTitle}
                </h4>
                <button
                  type="button"
                  data-mail-settings-back
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  <i className="ti ti-arrow-left text-sm"></i>{" "}
                  {t.mail.outbound.back}
                </button>
              </div>
              <div className="rounded-xl border border-border bg-background p-4 space-y-4">
                <p className="text-xs text-muted-foreground">
                  {t.mail.outbound.intro}
                </p>
                <div className="space-y-1.5">
                  <label
                    className="text-sm font-medium"
                    htmlFor="mail-outbound-mode"
                  >
                    {t.mail.outbound.modeLabel}
                  </label>
                  <select
                    id="mail-outbound-mode"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="disabled">
                      {t.mail.outbound.modeDisabled}
                    </option>
                    <option value="account">
                      {t.mail.outbound.modeAccount}
                    </option>
                    <option value="external">
                      {t.mail.outbound.modeExternal}
                    </option>
                  </select>
                </div>

                <div
                  id="mail-outbound-account-box"
                  className="hidden space-y-1.5"
                >
                  <label
                    className="text-sm font-medium"
                    htmlFor="mail-outbound-account"
                  >
                    {t.mail.outbound.accountLabel}
                  </label>
                  <select
                    id="mail-outbound-account"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                  ></select>
                  <p className="text-xs text-muted-foreground">
                    {t.mail.outbound.accountHint}
                  </p>
                </div>

                <div
                  id="mail-outbound-external-box"
                  className="hidden space-y-3"
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-1.5 md:col-span-2">
                      <label
                        className="text-sm font-medium"
                        htmlFor="mail-outbound-host"
                      >
                        {t.mail.outbound.hostLabel}
                      </label>
                      <input
                        id="mail-outbound-host"
                        type="text"
                        placeholder={t.mail.outbound.hostPlaceholder}
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        className="text-sm font-medium"
                        htmlFor="mail-outbound-port"
                      >
                        {t.mail.outbound.portLabel}
                      </label>
                      <input
                        id="mail-outbound-port"
                        type="number"
                        defaultValue="587"
                        min="1"
                        max="65535"
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label
                        className="text-sm font-medium"
                        htmlFor="mail-outbound-user"
                      >
                        {t.mail.outbound.userLabel}
                      </label>
                      <input
                        id="mail-outbound-user"
                        type="text"
                        autoComplete="off"
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        className="text-sm font-medium"
                        htmlFor="mail-outbound-pass"
                      >
                        {t.mail.outbound.passLabel}
                      </label>
                      <input
                        id="mail-outbound-pass"
                        type="password"
                        autoComplete="new-password"
                        placeholder={t.mail.outbound.passPlaceholder}
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label
                        className="text-sm font-medium"
                        htmlFor="mail-outbound-from"
                      >
                        {t.mail.outbound.fromLabel}
                      </label>
                      <input
                        id="mail-outbound-from"
                        type="email"
                        placeholder={t.mail.outbound.fromPlaceholder}
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        className="text-sm font-medium"
                        htmlFor="mail-outbound-fromname"
                      >
                        {t.mail.outbound.fromNameLabel}
                      </label>
                      <input
                        id="mail-outbound-fromname"
                        type="text"
                        placeholder={t.mail.outbound.fromNamePlaceholder}
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      id="mail-outbound-secure"
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                    />{" "}
                    {t.mail.outbound.secureLabel}
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <button
                    id="mail-outbound-save"
                    type="button"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {t.mail.outbound.save}
                  </button>
                  <input
                    id="mail-outbound-test-to"
                    type="email"
                    placeholder={t.mail.outbound.testPlaceholder}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                  />
                  <button
                    id="mail-outbound-test"
                    type="button"
                    className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
                  >
                    {t.mail.outbound.test}
                  </button>
                  <span
                    id="mail-outbound-msg"
                    className="text-xs text-muted-foreground"
                  ></span>
                </div>
              </div>
            </section>

            <section
              data-mail-settings-view="routing"
              className="hidden mt-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  {t.mail.settingsModal.routing.sectionTitle}
                </h4>
                <button
                  type="button"
                  data-mail-settings-back
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  <i className="ti ti-arrow-left text-sm"></i>
                  {t.mail.settingsModal.backToMenu}
                </button>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <h4 className="text-sm font-semibold">
                  {t.mail.settingsModal.routing.configTitle}
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.mail.settingsModal.routing.configDescription}
                </p>

                <div className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
                  {t.mail.settingsModal.routing.mxNote}
                </div>

                <div
                  id="mail-routing-error"
                  className="mt-3 hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
                ></div>

                <div className="mt-4 space-y-1.5">
                  <label
                    htmlFor="mail-routing-domain"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {t.mail.settingsModal.routing.labelDomain}
                  </label>
                  <select
                    id="mail-routing-domain"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="">
                      {t.mail.settingsModal.routing.selectDomain}
                    </option>
                  </select>
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t.mail.settingsModal.routing.configureLabel}
                  </p>
                  <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                    <input
                      id="mail-routing-mode-auto"
                      type="radio"
                      name="mail-routing-mode"
                      defaultValue="auto_remote"
                      className="mt-0.5 h-4 w-4"
                      defaultChecked
                    />
                    <span>
                      <span className="font-medium">
                        {t.mail.settingsModal.routing.modeAutoLabel}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t.mail.settingsModal.routing.modeAutoDesc}
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                    <input
                      id="mail-routing-mode-local"
                      type="radio"
                      name="mail-routing-mode"
                      defaultValue="local"
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>
                      <span className="font-medium">
                        {t.mail.settingsModal.routing.modeLocalLabel}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t.mail.settingsModal.routing.modeLocalDesc}
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                    <input
                      id="mail-routing-mode-backup"
                      type="radio"
                      name="mail-routing-mode"
                      defaultValue="backup"
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>
                      <span className="font-medium">
                        {t.mail.settingsModal.routing.modeBackupLabel}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t.mail.settingsModal.routing.modeBackupDesc}
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                    <input
                      id="mail-routing-mode-remote"
                      type="radio"
                      name="mail-routing-mode"
                      defaultValue="remote"
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>
                      <span className="font-medium">
                        {t.mail.settingsModal.routing.modeRemoteLabel}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t.mail.settingsModal.routing.modeRemoteDesc}
                      </span>
                    </span>
                  </label>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    id="mail-routing-save"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {t.mail.settingsModal.routing.btnSave}
                  </button>
                  <p
                    id="mail-routing-current"
                    className="text-xs text-muted-foreground"
                  ></p>
                </div>
              </div>
            </section>

            <section
              data-mail-settings-view="domain-redirect"
              className="hidden mt-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  {t.mail.settingsModal.domainRedirect.sectionTitle}
                </h4>
                <button
                  type="button"
                  data-mail-settings-back
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  <i className="ti ti-arrow-left text-sm"></i>
                  {t.mail.settingsModal.backToMenu}
                </button>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <h4 className="text-sm font-semibold">
                  {t.mail.settingsModal.domainRedirect.configTitle}
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.mail.settingsModal.domainRedirect.configDescription}
                </p>

                <div
                  id="mail-domain-redirect-error"
                  className="mt-3 hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
                ></div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="mail-domain-redirect-domain"
                      className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {t.mail.settingsModal.domainRedirect.labelDomain}
                    </label>
                    <select
                      id="mail-domain-redirect-domain"
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="">
                        {t.mail.settingsModal.domainRedirect.selectDomain}
                      </option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      id="mail-domain-redirect-add-destination"
                      className="h-10 rounded-lg border border-border px-3 text-sm hover:bg-accent"
                    >
                      {t.mail.settingsModal.domainRedirect.btnAddDestination}
                    </button>
                  </div>
                </div>

                <div
                  id="mail-domain-redirect-destinations"
                  className="mt-3 space-y-2"
                ></div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    id="mail-domain-redirect-save"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {t.mail.settingsModal.domainRedirect.btnSave}
                  </button>
                  <button
                    type="button"
                    id="mail-domain-redirect-reset"
                    className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
                  >
                    {t.mail.settingsModal.domainRedirect.btnReset}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-4 py-2 text-sm font-medium">
                  {t.mail.settingsModal.domainRedirect.tableHeader}
                </div>
                <div className="p-3">
                  <DataTable
                    i18n={dataTableI18n}
                    tableId="mail-redirect-table"
                    title={t.mail.dataTableTitles.rules}
                    columns={MAIL_REDIRECT_COLUMNS}
                    data={[]}
                    filters={MAIL_REDIRECT_FILTERS}
                    rowActions={MAIL_REDIRECT_ROW_ACTIONS}
                  />
                </div>
              </div>
            </section>

            <section
              data-mail-settings-view="default-address"
              className="hidden mt-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  {t.mail.settingsModal.defaultAddress.sectionTitle}
                </h4>
                <button
                  type="button"
                  data-mail-settings-back
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  <i className="ti ti-arrow-left text-sm"></i>
                  {t.mail.settingsModal.backToMenu}
                </button>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <h4 className="text-sm font-semibold">
                  {t.mail.settingsModal.defaultAddress.configTitle}
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.mail.settingsModal.defaultAddress.configDescription}
                </p>

                <div
                  id="mail-default-address-error"
                  className="mt-3 hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
                ></div>

                <div className="mt-4 space-y-1.5">
                  <label
                    htmlFor="mail-default-address-domain"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {t.mail.settingsModal.defaultAddress.labelDomain}
                  </label>
                  <select
                    id="mail-default-address-domain"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="">
                      {t.mail.settingsModal.defaultAddress.selectDomain}
                    </option>
                  </select>
                </div>

                <p
                  id="mail-default-address-current"
                  className="mt-2 text-xs text-muted-foreground"
                ></p>

                <div className="mt-3 space-y-3">
                  <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                    <input
                      id="mail-default-address-mode-fail"
                      type="radio"
                      name="mail-default-address-mode"
                      defaultValue="fail"
                      className="mt-0.5 h-4 w-4"
                      defaultChecked
                    />
                    <span className="flex-1">
                      <span className="font-medium">
                        {t.mail.settingsModal.defaultAddress.modeFailLabel}
                      </span>
                      <span className="mt-2 block text-xs text-muted-foreground">
                        {t.mail.settingsModal.defaultAddress.modeFailMsgLabel}
                      </span>
                      <input
                        id="mail-default-address-failure-message"
                        type="text"
                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue={t.mail.defaultAddress.defaultFailMessage}
                      />
                    </span>
                  </label>

                  <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                    <input
                      id="mail-default-address-mode-forward"
                      type="radio"
                      name="mail-default-address-mode"
                      defaultValue="forward"
                      className="mt-0.5 h-4 w-4"
                    />
                    <span className="flex-1">
                      <span className="font-medium">
                        {t.mail.settingsModal.defaultAddress.modeForwardLabel}
                      </span>
                      <span className="mt-2 block text-xs text-muted-foreground">
                        {
                          t.mail.settingsModal.defaultAddress
                            .modeForwardAddressLabel
                        }
                      </span>
                      <input
                        id="mail-default-address-forward-to"
                        type="email"
                        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        placeholder={
                          t.mail.settingsModal.defaultAddress
                            .placeholderForwardTo
                        }
                      />
                    </span>
                  </label>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    id="mail-default-address-save"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {t.mail.settingsModal.defaultAddress.btnSave}
                  </button>
                </div>
              </div>
            </section>

            <section
              data-mail-settings-view="encryption"
              className="hidden mt-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  {t.mail.settingsModal.encryption.sectionTitle}
                </h4>
                <button
                  type="button"
                  data-mail-settings-back
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  <i className="ti ti-arrow-left text-sm"></i>
                  {t.mail.settingsModal.backToMenu}
                </button>
              </div>

              <div className="rounded-xl border border-border bg-background p-4 space-y-4">
                <h4 className="text-sm font-semibold">
                  {t.mail.settingsModal.encryption.createKeyTitle}
                </h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    id="mail-encryption-name"
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                    placeholder={
                      t.mail.settingsModal.encryption.placeholderName
                    }
                  />
                  <input
                    id="mail-encryption-email"
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                    placeholder={
                      t.mail.settingsModal.encryption.placeholderEmail
                    }
                  />
                  <input
                    id="mail-encryption-comment"
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                    placeholder={
                      t.mail.settingsModal.encryption.placeholderComment
                    }
                  />
                  <input
                    id="mail-encryption-pass"
                    type="password"
                    minLength={12}
                    autoComplete="new-password"
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                    placeholder={
                      t.mail.settingsModal.encryption.placeholderPass
                    }
                  />
                  <input
                    id="mail-encryption-pass-confirm"
                    type="password"
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                    placeholder={
                      t.mail.settingsModal.encryption.placeholderPassConfirm
                    }
                  />
                  <div></div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_140px_auto] md:items-end">
                  <input
                    id="mail-encryption-expire-value"
                    type="number"
                    min="1"
                    max="100"
                    defaultValue="1"
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                  />
                  <select
                    id="mail-encryption-expire-unit"
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="d">
                      {t.mail.settingsModal.encryption.expireDays}
                    </option>
                    <option value="w">
                      {t.mail.settingsModal.encryption.expireWeeks}
                    </option>
                    <option value="m">
                      {t.mail.settingsModal.encryption.expireMonths}
                    </option>
                    <option selected value="y">
                      {t.mail.settingsModal.encryption.expireYears}
                    </option>
                  </select>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      id="mail-encryption-no-expire"
                      type="checkbox"
                      className="h-4 w-4"
                    />{" "}
                    {t.mail.settingsModal.encryption.noExpireLabel}
                  </label>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    {t.mail.settingsModal.encryption.keySizeLabel}
                  </label>
                  <select
                    id="mail-encryption-keysize"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option selected value="3072">
                      3072
                    </option>
                    <option value="4096">4096</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    id="mail-encryption-generate"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {t.mail.settingsModal.encryption.btnGenerate}
                  </button>
                  <button
                    type="button"
                    id="mail-encryption-import-open"
                    className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
                  >
                    {t.mail.settingsModal.encryption.btnImportOpen}
                  </button>
                </div>
                <div
                  id="mail-encryption-import-wrap"
                  className="hidden space-y-2"
                >
                  <textarea
                    id="mail-encryption-import-text"
                    className="min-h-[140px] w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                    placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
                  ></textarea>
                  <button
                    type="button"
                    id="mail-encryption-import-save"
                    className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
                  >
                    {t.mail.settingsModal.encryption.btnImport}
                  </button>
                </div>
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-medium">
                    {t.mail.settingsModal.encryption.importProtectedPrivateKey}
                  </p>
                  <textarea
                    id="mail-encryption-private-import-text"
                    className="min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                    placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----"
                  ></textarea>
                  <input
                    id="mail-encryption-private-import-pass"
                    type="password"
                    autoComplete="off"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    placeholder={
                      t.mail.settingsModal.encryption.privateKeyPassphrase
                    }
                  />
                  <button
                    type="button"
                    id="mail-encryption-private-import-save"
                    className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
                  >
                    {t.mail.settingsModal.encryption.importPrivateKey}
                  </button>
                </div>
                <p
                  id="mail-encryption-error"
                  role="status"
                  className="hidden text-sm text-destructive"
                ></p>
                <p
                  id="mail-encryption-warning"
                  className="hidden text-xs text-amber-500"
                ></p>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <h4 className="text-sm font-semibold">
                  {t.mail.settingsModal.encryption.publicKeysTitle}
                </h4>
                <div className="mt-2">
                  <DataTable
                    tableId="mail-encryption-public-table"
                    title={t.mail.dataTableTitles.publicKeys}
                    columns={MAIL_ENCRYPTION_COLUMNS}
                    data={[]}
                    filters={MAIL_ENCRYPTION_FILTERS}
                    rowActions={MAIL_ENCRYPTION_ROW_ACTIONS}
                    i18n={dataTableI18n}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <h4 className="text-sm font-semibold">
                  {t.mail.settingsModal.encryption.privateKeysTitle}
                </h4>
                <div className="mt-2">
                  <DataTable
                    tableId="mail-encryption-private-table"
                    title={t.mail.dataTableTitles.privateKeys}
                    columns={MAIL_ENCRYPTION_COLUMNS}
                    data={[]}
                    filters={MAIL_ENCRYPTION_FILTERS}
                    rowActions={MAIL_ENCRYPTION_ROW_ACTIONS}
                    i18n={dataTableI18n}
                  />
                </div>
              </div>

              <div
                id="mail-encryption-view-wrap"
                className="hidden rounded-xl border border-border bg-background p-4"
              >
                <h4 className="text-sm font-semibold">
                  {t.mail.settingsModal.encryption.viewKeyTitle}
                </h4>
                <textarea
                  id="mail-encryption-view-text"
                  readOnly
                  className="mt-2 min-h-[220px] w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                ></textarea>
              </div>
            </section>

            <section
              data-mail-settings-view="archive"
              className="hidden mt-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  {t.mail.settingsModal.archive.sectionTitle}
                </h4>
                <button
                  type="button"
                  data-mail-settings-back
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  <i className="ti ti-arrow-left text-sm"></i>
                  {t.mail.settingsModal.backToMenu}
                </button>
              </div>
              <p
                id="mail-archive-status"
                role="status"
                className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
              ></p>

              <div className="rounded-xl border border-border bg-background p-4">
                <h4 className="text-sm font-semibold">
                  {t.mail.settingsModal.archive.defaultConfigTitle}
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.mail.settingsModal.archive.defaultConfigDesc}
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      id="mail-archive-default-incoming"
                      type="checkbox"
                      className="h-4 w-4"
                    />{" "}
                    {t.mail.settingsModal.archive.incomingLabel}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      id="mail-archive-default-outgoing-list"
                      type="checkbox"
                      className="h-4 w-4"
                    />{" "}
                    {t.mail.settingsModal.archive.outgoingListLabel}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      id="mail-archive-default-outgoing"
                      type="checkbox"
                      className="h-4 w-4"
                    />{" "}
                    {t.mail.settingsModal.archive.outgoingLabel}
                  </label>
                </div>
                <button
                  type="button"
                  id="mail-archive-default-save"
                  className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {t.mail.settingsModal.archive.btnApplyAll}
                </button>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <h4 className="text-sm font-semibold">
                  {t.mail.settingsModal.archive.manageTitle}
                </h4>
                <div
                  className="mt-3 grid gap-2"
                  id="mail-archive-domain-rows"
                ></div>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <h4 className="text-sm font-semibold">
                  {t.mail.settingsModal.archive.browseArchive}
                </h4>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="mail-archive-browse-domain"
                    className="sr-only"
                  >
                    {t.mail.settingsModal.archive.domainLabel}
                  </label>
                  <select
                    id="mail-archive-browse-domain"
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  ></select>
                  <label
                    htmlFor="mail-archive-browse-direction"
                    className="sr-only"
                  >
                    {t.mail.settingsModal.archive.directionLabel}
                  </label>
                  <select
                    id="mail-archive-browse-direction"
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="incoming">
                      {t.mail.settingsModal.archive.incomingOption}
                    </option>
                    <option value="outgoing">
                      {t.mail.settingsModal.archive.outgoingOption}
                    </option>
                  </select>
                  <button
                    type="button"
                    id="mail-archive-browse-refresh"
                    className="rounded-md border border-border px-3 py-2 text-xs hover:bg-accent"
                  >
                    Actualizar
                  </button>
                </div>
                <p
                  id="mail-archive-browse-error"
                  role="alert"
                  className="mt-2 hidden text-xs text-destructive"
                ></p>
                <div
                  id="mail-archive-message-rows"
                  className="mt-3 max-h-80 space-y-2 overflow-auto"
                ></div>
              </div>
            </section>
          </div>
          {/** /content column */}
        </div>
        {/** /flex nav+content */}
      </ViewSettingsModal>
    </Fragment>
  );
}
